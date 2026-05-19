const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();
const prisma = new PrismaClient();

// Default NYC-ish anchor for deterministic placeholder coordinates.
const ANCHOR_LAT = 40.7484;
const ANCHOR_LNG = -73.9857;

function jitter(seed, scale = 0.04) {
  // Deterministic pseudo-random offset from a string seed.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const a = ((h & 0xffff) / 0xffff - 0.5) * scale;
  const b = (((h >>> 16) & 0xffff) / 0xffff - 0.5) * scale;
  return [a, b];
}

function pointFor(id, label) {
  const [dLat, dLng] = jitter(`${id}:${label}`);
  return { lat: ANCHOR_LAT + dLat, lng: ANCHOR_LNG + dLng };
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ────────────────────────────────────────────────────────────────────────────
// VIZ 1: Pickup/Dropoff Map data — markers for a given day
// GET /api/custom-views/pickup-map?date=YYYY-MM-DD
// ────────────────────────────────────────────────────────────────────────────
router.get('/pickup-map', authenticateToken, async (req, res) => {
  try {
    const dateStr = req.query.date;
    const day = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [pickups, deliveries] = await Promise.all([
      prisma.pickup.findMany({
        where: { scheduledStart: { gte: start, lt: end } },
        include: { address: true, order: { select: { orderNumber: true, customer: { select: { firstName: true, lastName: true } } } } },
        take: 50,
      }),
      prisma.delivery.findMany({
        where: { scheduledStart: { gte: start, lt: end } },
        include: { address: true, order: { select: { orderNumber: true, customer: { select: { firstName: true, lastName: true } } } } },
        take: 50,
      }),
    ]);

    const pickupMarkers = pickups.map((p) => {
      const fallback = pointFor(p.id, 'pickup');
      const lat = p.address?.latitude ?? fallback.lat;
      const lng = p.address?.longitude ?? fallback.lng;
      return {
        id: p.id,
        kind: 'pickup',
        lat,
        lng,
        label: p.order?.orderNumber || p.id.slice(0, 6),
        customer: p.order?.customer ? `${p.order.customer.firstName} ${p.order.customer.lastName}` : null,
        address: p.address ? `${p.address.street}, ${p.address.city}` : '',
        scheduledStart: p.scheduledStart,
        status: p.status,
      };
    });

    const dropoffMarkers = deliveries.map((d) => {
      const fallback = pointFor(d.id, 'dropoff');
      const lat = d.address?.latitude ?? fallback.lat;
      const lng = d.address?.longitude ?? fallback.lng;
      return {
        id: d.id,
        kind: 'dropoff',
        lat,
        lng,
        label: d.order?.orderNumber || d.id.slice(0, 6),
        customer: d.order?.customer ? `${d.order.customer.firstName} ${d.order.customer.lastName}` : null,
        address: d.address ? `${d.address.street}, ${d.address.city}` : '',
        scheduledStart: d.scheduledStart,
        status: d.status,
      };
    });

    // If DB has no rows for the chosen day, return a small demo set so the
    // map is never empty in fresh environments.
    if (pickupMarkers.length === 0 && dropoffMarkers.length === 0) {
      for (let i = 0; i < 6; i++) {
        const p = pointFor(`demo-pickup-${i}`, 'pickup');
        pickupMarkers.push({
          id: `demo-p-${i}`,
          kind: 'pickup',
          lat: p.lat,
          lng: p.lng,
          label: `ORD-DEMO-P${i + 1}`,
          customer: `Demo Customer ${i + 1}`,
          address: 'Demo address, NYC',
          scheduledStart: new Date(start.getTime() + i * 60 * 60 * 1000),
          status: 'SCHEDULED',
        });
        const d = pointFor(`demo-drop-${i}`, 'dropoff');
        dropoffMarkers.push({
          id: `demo-d-${i}`,
          kind: 'dropoff',
          lat: d.lat,
          lng: d.lng,
          label: `ORD-DEMO-D${i + 1}`,
          customer: `Demo Customer ${i + 1}`,
          address: 'Demo address, NYC',
          scheduledStart: new Date(start.getTime() + (i + 1) * 60 * 60 * 1000),
          status: 'SCHEDULED',
        });
      }
    }

    res.json({
      date: start.toISOString().slice(0, 10),
      center: { lat: ANCHOR_LAT, lng: ANCHOR_LNG },
      pickups: pickupMarkers,
      dropoffs: dropoffMarkers,
    });
  } catch (err) {
    console.error('pickup-map error', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// VIZ 2: Service Status Board — orders bucketed by stage
// GET /api/custom-views/service-status
// ────────────────────────────────────────────────────────────────────────────
const STAGES = [
  { key: 'intake', label: 'Intake', statuses: ['PENDING', 'PICKED_UP'] },
  { key: 'wash', label: 'Wash', statuses: ['PROCESSING', 'CLEANING'] },
  { key: 'dry', label: 'Dry', statuses: ['PRESSING'] },
  { key: 'fold', label: 'Fold / QC', statuses: ['QUALITY_CHECK'] },
  { key: 'ready', label: 'Ready', statuses: ['READY', 'OUT_FOR_DELIVERY'] },
  { key: 'delivered', label: 'Delivered', statuses: ['DELIVERED', 'COMPLETED'] },
];

router.get('/service-status', authenticateToken, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      orderBy: { updatedAt: 'desc' },
      take: 120,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        items: { select: { id: true } },
      },
    });

    const stages = STAGES.map((s) => ({ key: s.key, label: s.label, statuses: s.statuses, orders: [] }));

    const placed = new Set();
    for (const order of orders) {
      const idx = STAGES.findIndex((s) => s.statuses.includes(order.status));
      if (idx === -1) continue;
      placed.add(order.id);
      stages[idx].orders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'Unknown',
        itemCount: order.items.length,
        total: Number(order.total || 0),
        isRush: !!order.isRush,
        updatedAt: order.updatedAt,
        status: order.status,
      });
    }

    // Fill with deterministic demo cards if a fresh DB lacks orders.
    if (orders.length === 0) {
      stages.forEach((stage, i) => {
        for (let j = 0; j < 3; j++) {
          stage.orders.push({
            id: `demo-${i}-${j}`,
            orderNumber: `ORD-DEMO-${i}${j}`,
            customer: `Demo Customer ${i}${j}`,
            itemCount: 2 + j,
            total: 18 + i * 5 + j,
            isRush: j === 0 && i === 1,
            updatedAt: new Date(),
            status: stage.statuses[0],
          });
        }
      });
    }

    res.json({ stages, totalOrders: orders.length });
  } catch (err) {
    console.error('service-status error', err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// NON-VIZ 1: Order list (for picker) + Ticket PDF
// GET /api/custom-views/orders        — minimal list for picker
// GET /api/custom-views/ticket/:id    — streams PDF
// ────────────────────────────────────────────────────────────────────────────
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });
    res.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total || 0),
        createdAt: o.createdAt,
        customer: o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : 'Unknown',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ticket/:id', authenticateToken, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { include: { service: true, garmentType: true } },
        pickup: { include: { address: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="ticket-${order.orderNumber}.pdf"`
    );
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Laundry Services', { align: 'left' });
    doc.fontSize(10).fillColor('#666').text('Service Receipt / Ticket', { align: 'left' });
    doc.moveDown(0.5);
    doc.fillColor('#000');

    // Order meta
    doc.fontSize(12).text(`Order: ${order.orderNumber}`);
    doc.text(`Status: ${order.status}`);
    doc.text(
      `Customer: ${order.customer ? order.customer.firstName + ' ' + order.customer.lastName : '—'}`
    );
    if (order.customer?.email) doc.text(`Email: ${order.customer.email}`);
    doc.text(`Created: ${new Date(order.createdAt).toLocaleString()}`);
    if (order.pickup) {
      doc.text(`Pickup: ${new Date(order.pickup.scheduledStart).toLocaleString()}`);
      if (order.pickup.address) {
        doc.text(
          `Pickup Address: ${order.pickup.address.street}, ${order.pickup.address.city}`
        );
      }
    }
    doc.moveDown(0.5);

    // Items table
    doc.fontSize(12).text('Items', { underline: true });
    doc.moveDown(0.3);
    let estWeightLbs = 0;
    if (order.items && order.items.length) {
      order.items.forEach((item, idx) => {
        const line =
          `${idx + 1}. ${item.garmentType?.name || 'Item'} ` +
          `(${item.service?.name || 'Service'}) ` +
          `x${item.quantity}  $${Number(item.totalPrice || 0).toFixed(2)}`;
        doc.fontSize(11).text(line);
        if (item.specialNotes) doc.fontSize(9).fillColor('#555').text(`   note: ${item.specialNotes}`).fillColor('#000');
        // ~0.5 lb per garment for the weight estimate
        estWeightLbs += 0.5 * (item.quantity || 1);
      });
    } else {
      doc.fontSize(11).fillColor('#888').text('No itemised lines on this order.').fillColor('#000');
    }
    doc.moveDown(0.5);

    // Services summary
    const services = [...new Set((order.items || []).map((i) => i.service?.name).filter(Boolean))];
    doc.fontSize(12).text('Services', { underline: true });
    doc.fontSize(11).text(services.length ? services.join(', ') : '—');
    doc.moveDown(0.5);

    // Weight + total
    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(11).text(`Estimated weight: ${estWeightLbs.toFixed(1)} lb`);
    doc.text(`Subtotal: $${Number(order.subtotal || 0).toFixed(2)}`);
    doc.text(`Tax: $${Number(order.tax || 0).toFixed(2)}`);
    if (Number(order.discount || 0) > 0) {
      doc.text(`Discount: -$${Number(order.discount).toFixed(2)}`);
    }
    doc.fontSize(13).fillColor('#0a7').text(`TOTAL: $${Number(order.total || 0).toFixed(2)}`);
    doc.fillColor('#000');

    doc.moveDown(1);
    doc.fontSize(9).fillColor('#888').text(
      'Please retain this ticket for pickup. Thank you for choosing Laundry Services.',
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    console.error('ticket pdf error', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// NON-VIZ 2: Route Optimizer
// GET  /api/custom-views/drivers          — list drivers for picker
// POST /api/custom-views/optimize-route   — body: { driverId, stops:[{label,lat?,lng?,address?}] }
// ────────────────────────────────────────────────────────────────────────────
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currentLat: true,
        currentLng: true,
        vehicleInfo: true,
      },
      take: 50,
    });
    res.json({
      drivers: drivers.map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        vehicle: d.vehicleInfo || '—',
        lat: d.currentLat ?? ANCHOR_LAT,
        lng: d.currentLng ?? ANCHOR_LNG,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/optimize-route', authenticateToken, async (req, res) => {
  try {
    const { driverId, stops = [], avgSpeedKmh = 30, stopMinutes = 8 } = req.body || {};
    if (!Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ error: 'stops[] required' });
    }

    let origin = { lat: ANCHOR_LAT, lng: ANCHOR_LNG };
    if (driverId) {
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { firstName: true, lastName: true, currentLat: true, currentLng: true },
      });
      if (driver) {
        origin = {
          lat: driver.currentLat ?? ANCHOR_LAT,
          lng: driver.currentLng ?? ANCHOR_LNG,
          name: `${driver.firstName} ${driver.lastName}`,
        };
      }
    }

    // Materialise stops, attaching deterministic coords for any missing ones.
    const enriched = stops.map((s, i) => {
      const fallback = pointFor(`${driverId || 'anon'}:${s.label || i}`);
      return {
        label: s.label || `Stop ${i + 1}`,
        address: s.address || '',
        lat: typeof s.lat === 'number' ? s.lat : fallback.lat,
        lng: typeof s.lng === 'number' ? s.lng : fallback.lng,
      };
    });

    // Nearest-neighbour heuristic from origin
    const remaining = [...enriched];
    const ordered = [];
    let cursor = origin;
    while (remaining.length) {
      let bestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineKm(cursor, remaining[i]);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push({ ...next, legKm: bestD });
      cursor = next;
    }

    // ETA = cumulative drive time + stop service time
    let cumMin = 0;
    const now = new Date();
    const optimized = ordered.map((s, i) => {
      const driveMin = (s.legKm / avgSpeedKmh) * 60;
      cumMin += driveMin + (i === 0 ? 0 : stopMinutes);
      const eta = new Date(now.getTime() + cumMin * 60 * 1000);
      return {
        sequence: i + 1,
        label: s.label,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        legKm: +s.legKm.toFixed(2),
        eta: eta.toISOString(),
        etaMinutesFromStart: Math.round(cumMin),
      };
    });

    const totalKm = optimized.reduce((sum, s) => sum + s.legKm, 0);
    res.json({
      driverId: driverId || null,
      origin,
      avgSpeedKmh,
      stopMinutes,
      totalKm: +totalKm.toFixed(2),
      totalMinutes: Math.round(cumMin),
      optimized,
    });
  } catch (err) {
    console.error('optimize-route error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
