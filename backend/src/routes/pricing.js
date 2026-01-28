const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all service prices
router.get('/service-prices', async (req, res) => {
  try {
    const { serviceId, garmentTypeId } = req.query;

    const where = {};
    if (serviceId) where.serviceId = serviceId;
    if (garmentTypeId) where.garmentTypeId = garmentTypeId;

    const prices = await prisma.servicePrice.findMany({
      where,
      include: {
        service: true,
        garmentType: true
      }
    });

    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get price matrix (all services x all garment types)
router.get('/matrix', async (req, res) => {
  try {
    const [services, garmentTypes, prices] = await Promise.all([
      prisma.service.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.garmentType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.servicePrice.findMany()
    ]);

    // Create price lookup
    const priceLookup = {};
    prices.forEach(p => {
      priceLookup[`${p.serviceId}-${p.garmentTypeId}`] = parseFloat(p.price);
    });

    // Build matrix
    const matrix = services.map(service => ({
      service,
      prices: garmentTypes.map(garment => ({
        garmentType: garment,
        price: priceLookup[`${service.id}-${garment.id}`] || parseFloat(service.basePrice)
      }))
    }));

    res.json({ services, garmentTypes, matrix });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set service price for garment type
router.post('/service-prices', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { serviceId, garmentTypeId, price } = req.body;

    const servicePrice = await prisma.servicePrice.upsert({
      where: {
        serviceId_garmentTypeId: { serviceId, garmentTypeId }
      },
      update: { price },
      create: { serviceId, garmentTypeId, price }
    });

    res.json(servicePrice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update prices
router.post('/service-prices/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { prices } = req.body; // Array of { serviceId, garmentTypeId, price }

    const results = await Promise.all(
      prices.map(p =>
        prisma.servicePrice.upsert({
          where: {
            serviceId_garmentTypeId: { serviceId: p.serviceId, garmentTypeId: p.garmentTypeId }
          },
          update: { price: p.price },
          create: { serviceId: p.serviceId, garmentTypeId: p.garmentTypeId, price: p.price }
        })
      )
    );

    res.json({ message: `${results.length} prices updated` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete service price
router.delete('/service-prices/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.servicePrice.delete({ where: { id: req.params.id } });
    res.json({ message: 'Price deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all alteration types
router.get('/alterations', async (req, res) => {
  try {
    const alterationTypes = await prisma.alterationType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    res.json(alterationTypes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create alteration type
router.post('/alterations', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, description, basePrice } = req.body;

    const alterationType = await prisma.alterationType.create({
      data: { name, description, basePrice }
    });

    res.status(201).json(alterationType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alteration type
router.put('/alterations/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, description, basePrice, isActive } = req.body;

    const alterationType = await prisma.alterationType.update({
      where: { id: req.params.id },
      data: { name, description, basePrice, isActive }
    });

    res.json(alterationType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate order estimate
router.post('/estimate', async (req, res) => {
  try {
    const { items, isRush, couponCode } = req.body;

    let subtotal = 0;
    const itemDetails = [];

    for (const item of items) {
      const servicePrice = await prisma.servicePrice.findUnique({
        where: {
          serviceId_garmentTypeId: {
            serviceId: item.serviceId,
            garmentTypeId: item.garmentTypeId
          }
        },
        include: { service: true, garmentType: true }
      });

      let unitPrice;
      let serviceName, garmentName;

      if (servicePrice) {
        unitPrice = parseFloat(servicePrice.price);
        serviceName = servicePrice.service.name;
        garmentName = servicePrice.garmentType.name;
      } else {
        const service = await prisma.service.findUnique({ where: { id: item.serviceId } });
        const garment = await prisma.garmentType.findUnique({ where: { id: item.garmentTypeId } });
        unitPrice = parseFloat(service.basePrice);
        serviceName = service.name;
        garmentName = garment.name;
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      itemDetails.push({
        service: serviceName,
        garmentType: garmentName,
        quantity: item.quantity,
        unitPrice,
        totalPrice
      });
    }

    // Rush fee
    const rushFee = isRush ? subtotal * 0.5 : 0; // 50% rush fee

    // Apply coupon
    let discount = 0;
    let coupon = null;
    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (coupon && coupon.isActive && new Date() >= coupon.startDate && new Date() <= coupon.endDate) {
        if (!coupon.minOrderAmount || subtotal >= parseFloat(coupon.minOrderAmount)) {
          if (coupon.discountType === 'PERCENTAGE') {
            discount = subtotal * (parseFloat(coupon.discountValue) / 100);
            if (coupon.maxDiscount) {
              discount = Math.min(discount, parseFloat(coupon.maxDiscount));
            }
          } else {
            discount = parseFloat(coupon.discountValue);
          }
        }
      }
    }

    const tax = (subtotal - discount + rushFee) * 0.08;
    const total = subtotal - discount + rushFee + tax;

    res.json({
      items: itemDetails,
      subtotal,
      rushFee,
      discount,
      couponApplied: coupon ? { code: coupon.code, discount } : null,
      tax,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
