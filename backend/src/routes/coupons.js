const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all coupons
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { active, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (active === 'true') {
      where.isActive = true;
      where.endDate = { gte: new Date() };
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.coupon.count({ where })
    ]);

    res.json({
      coupons,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get coupon by code
router.get('/code/:code', async (req, res) => {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code: req.params.code.toUpperCase() }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Check if valid
    const now = new Date();
    const isValid = coupon.isActive &&
      now >= coupon.startDate &&
      now <= coupon.endDate &&
      (!coupon.usageLimit || coupon.usageCount < coupon.usageLimit);

    res.json({
      ...coupon,
      isValid,
      reason: !isValid ? (
        !coupon.isActive ? 'Coupon is inactive' :
        now < coupon.startDate ? 'Coupon not yet active' :
        now > coupon.endDate ? 'Coupon has expired' :
        'Usage limit reached'
      ) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create coupon
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue,
      minOrderAmount, maxDiscount, usageLimit, startDate, endDate
    } = req.body;

    const coupon = await prisma.coupon.create({
      data: {
        code: code.toUpperCase(),
        description,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    });

    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update coupon
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      code, description, discountType, discountValue,
      minOrderAmount, maxDiscount, usageLimit, startDate, endDate, isActive
    } = req.body;

    const coupon = await prisma.coupon.update({
      where: { id: req.params.id },
      data: {
        code: code?.toUpperCase(),
        description,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive
      }
    });

    res.json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete coupon
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.coupon.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Coupon deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate coupon for order
router.post('/validate', async (req, res) => {
  try {
    const { code, orderTotal } = req.body;

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() }
    });

    if (!coupon) {
      return res.status(404).json({ valid: false, error: 'Coupon not found' });
    }

    const now = new Date();

    if (!coupon.isActive) {
      return res.json({ valid: false, error: 'Coupon is inactive' });
    }

    if (now < coupon.startDate) {
      return res.json({ valid: false, error: 'Coupon not yet active' });
    }

    if (now > coupon.endDate) {
      return res.json({ valid: false, error: 'Coupon has expired' });
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return res.json({ valid: false, error: 'Coupon usage limit reached' });
    }

    if (coupon.minOrderAmount && orderTotal < parseFloat(coupon.minOrderAmount)) {
      return res.json({
        valid: false,
        error: `Minimum order amount of $${coupon.minOrderAmount} required`
      });
    }

    // Calculate discount
    let discount;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = orderTotal * (parseFloat(coupon.discountValue) / 100);
      if (coupon.maxDiscount) {
        discount = Math.min(discount, parseFloat(coupon.maxDiscount));
      }
    } else {
      discount = parseFloat(coupon.discountValue);
    }

    res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      calculatedDiscount: parseFloat(discount.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
