const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all routes
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { date, driverId, status } = req.query;

    const where = {};
    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: queryDate, lt: nextDay };
    }
    if (driverId) where.driverId = driverId;
    if (status) where.status = status;

    const routes = await prisma.route.findMany({
      where,
      include: {
        driver: {
          select: { id: true, firstName: true, lastName: true, phone: true }
        },
        pickups: {
          include: {
            order: { select: { orderNumber: true } },
            address: true
          }
        },
        deliveries: {
          include: {
            order: { select: { orderNumber: true } },
            address: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get route by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: req.params.id },
      include: {
        driver: {
          select: { id: true, firstName: true, lastName: true, phone: true }
        },
        pickups: {
          include: {
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, phone: true } }
              }
            },
            address: true
          }
        },
        deliveries: {
          include: {
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, phone: true } }
              }
            },
            address: true
          }
        }
      }
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create route
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { driverId, date, pickupIds, deliveryIds, pickupOrderIds, deliveryOrderIds } = req.body;

    // Create the route
    const route = await prisma.route.create({
      data: {
        driverId,
        date: new Date(date),
        status: 'PLANNED',
        totalStops: 0
      }
    });

    let totalStops = 0;

    // Assign existing pickups to route
    if (pickupIds?.length) {
      await prisma.pickup.updateMany({
        where: { id: { in: pickupIds } },
        data: { routeId: route.id, driverId }
      });
      totalStops += pickupIds.length;
    }

    // Assign existing deliveries to route
    if (deliveryIds?.length) {
      await prisma.delivery.updateMany({
        where: { id: { in: deliveryIds } },
        data: { routeId: route.id, driverId }
      });
      totalStops += deliveryIds.length;
    }

    // Create or assign pickups from order IDs
    if (pickupOrderIds?.length) {
      for (const orderId of pickupOrderIds) {
        // Check if pickup already exists for this order
        const existingPickup = await prisma.pickup.findUnique({
          where: { orderId }
        });

        if (existingPickup) {
          // Assign existing pickup to this route
          await prisma.pickup.update({
            where: { id: existingPickup.id },
            data: { routeId: route.id, driverId }
          });
          totalStops++;
        } else {
          // Create new pickup
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: { include: { addresses: true } } }
          });

          if (order && order.customer?.addresses?.[0]) {
            await prisma.pickup.create({
              data: {
                orderId,
                routeId: route.id,
                driverId,
                addressId: order.customer.addresses[0].id,
                scheduledStart: new Date(date),
                scheduledEnd: new Date(new Date(date).getTime() + 2 * 60 * 60 * 1000),
                status: 'SCHEDULED'
              }
            });
            totalStops++;
          }
        }
      }
    }

    // Create or assign deliveries from order IDs
    if (deliveryOrderIds?.length) {
      for (const orderId of deliveryOrderIds) {
        // Check if delivery already exists for this order
        const existingDelivery = await prisma.delivery.findUnique({
          where: { orderId }
        });

        if (existingDelivery) {
          // Assign existing delivery to this route
          await prisma.delivery.update({
            where: { id: existingDelivery.id },
            data: { routeId: route.id, driverId }
          });
          totalStops++;
        } else {
          // Create new delivery
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: { include: { addresses: true } } }
          });

          if (order && order.customer?.addresses?.[0]) {
            await prisma.delivery.create({
              data: {
                orderId,
                routeId: route.id,
                driverId,
                addressId: order.customer.addresses[0].id,
                scheduledStart: new Date(date),
                scheduledEnd: new Date(new Date(date).getTime() + 2 * 60 * 60 * 1000),
                status: 'SCHEDULED'
              }
            });
            totalStops++;
          }
        }
      }
    }

    // Update total stops
    await prisma.route.update({
      where: { id: route.id },
      data: { totalStops }
    });

    const fullRoute = await prisma.route.findUnique({
      where: { id: route.id },
      include: {
        driver: true,
        pickups: { include: { address: true, order: { select: { orderNumber: true } } } },
        deliveries: { include: { address: true, order: { select: { orderNumber: true } } } }
      }
    });

    res.status(201).json(fullRoute);
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update route status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    const updateData = { status };

    if (status === 'IN_PROGRESS') {
      updateData.startTime = new Date();
    } else if (status === 'COMPLETED') {
      updateData.endTime = new Date();
    }

    const route = await prisma.route.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Nearest neighbor algorithm for route optimization
function nearestNeighborOptimization(stops, startLat = 40.7128, startLng = -74.0060) {
  if (stops.length === 0) return [];

  const optimized = [];
  const remaining = [...stops];
  let currentLat = startLat;
  let currentLng = startLng;

  // Prioritize pickups first, then deliveries
  const pickups = remaining.filter(s => s.type === 'pickup');
  const deliveries = remaining.filter(s => s.type === 'delivery');

  // Optimize pickups first using nearest neighbor
  while (pickups.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    pickups.forEach((stop, index) => {
      const distance = calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const nearest = pickups.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  // Then optimize deliveries using nearest neighbor
  while (deliveries.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    deliveries.forEach((stop, index) => {
      const distance = calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const nearest = deliveries.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  return optimized;
}

// Calculate total route distance
function calculateTotalDistance(stops) {
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    total += calculateDistance(stops[i-1].lat, stops[i-1].lng, stops[i].lat, stops[i].lng);
  }
  return total;
}

// Optimize route using nearest neighbor algorithm
router.post('/:id/optimize', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: req.params.id },
      include: {
        pickups: { include: { address: true, order: { select: { orderNumber: true } } } },
        deliveries: { include: { address: true, order: { select: { orderNumber: true } } } }
      }
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Build stops array with location data
    const stops = [
      ...route.pickups.map(p => ({
        id: p.id,
        type: 'pickup',
        orderNumber: p.order.orderNumber,
        lat: p.address.latitude || 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: p.address.longitude || -74.0060 + (Math.random() - 0.5) * 0.1,
        address: `${p.address.street}, ${p.address.city}`
      })),
      ...route.deliveries.map(d => ({
        id: d.id,
        type: 'delivery',
        orderNumber: d.order.orderNumber,
        lat: d.address.latitude || 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: d.address.longitude || -74.0060 + (Math.random() - 0.5) * 0.1,
        address: `${d.address.street}, ${d.address.city}`
      }))
    ];

    // Calculate original distance
    const originalDistance = calculateTotalDistance(stops);

    // Optimize using nearest neighbor
    const optimizedStops = nearestNeighborOptimization(stops);
    const optimizedDistance = calculateTotalDistance(optimizedStops);

    // Calculate savings
    const distanceSaved = originalDistance - optimizedDistance;
    const percentSaved = originalDistance > 0 ? ((distanceSaved / originalDistance) * 100).toFixed(1) : 0;

    // Estimate time savings (assuming 30 km/h average speed in city)
    const timeSavedMinutes = Math.round((distanceSaved / 30) * 60);

    // Save optimized order
    const optimizedOrder = JSON.stringify(optimizedStops.map(s => s.id));

    await prisma.route.update({
      where: { id: req.params.id },
      data: {
        optimizedOrder,
        totalDistance: parseFloat(optimizedDistance.toFixed(2))
      }
    });

    res.json({
      message: 'Route optimized successfully',
      optimization: {
        originalDistance: parseFloat(originalDistance.toFixed(2)),
        optimizedDistance: parseFloat(optimizedDistance.toFixed(2)),
        distanceSaved: parseFloat(distanceSaved.toFixed(2)),
        percentSaved: parseFloat(percentSaved),
        estimatedTimeSavedMinutes: timeSavedMinutes,
        totalStops: optimizedStops.length
      },
      optimizedRoute: optimizedStops.map((s, index) => ({
        sequence: index + 1,
        type: s.type,
        id: s.id,
        orderNumber: s.orderNumber,
        address: s.address,
        coordinates: { lat: s.lat, lng: s.lng }
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add pickup to route
router.post('/:id/pickups', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { pickupId } = req.body;

    const route = await prisma.route.findUnique({ where: { id: req.params.id } });

    await prisma.pickup.update({
      where: { id: pickupId },
      data: { routeId: req.params.id, driverId: route.driverId }
    });

    await prisma.route.update({
      where: { id: req.params.id },
      data: { totalStops: { increment: 1 } }
    });

    res.json({ message: 'Pickup added to route' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add delivery to route
router.post('/:id/deliveries', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { deliveryId } = req.body;

    const route = await prisma.route.findUnique({ where: { id: req.params.id } });

    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { routeId: req.params.id, driverId: route.driverId }
    });

    await prisma.route.update({
      where: { id: req.params.id },
      data: { totalStops: { increment: 1 } }
    });

    res.json({ message: 'Delivery added to route' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned pickups
router.get('/unassigned/pickups', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { date } = req.query;

    const where = { routeId: null, status: 'SCHEDULED' };

    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduledStart = { gte: queryDate, lt: nextDay };
    }

    const pickups = await prisma.pickup.findMany({
      where,
      include: {
        order: {
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } }
          }
        },
        address: true
      },
      orderBy: { scheduledStart: 'asc' }
    });

    res.json(pickups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned deliveries
router.get('/unassigned/deliveries', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { date } = req.query;

    const where = { routeId: null, status: 'SCHEDULED' };

    if (date) {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(queryDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduledStart = { gte: queryDate, lt: nextDay };
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            customer: { select: { firstName: true, lastName: true, phone: true } }
          }
        },
        address: true
      },
      orderBy: { scheduledStart: 'asc' }
    });

    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
