const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();
const prisma = new PrismaClient();

// Get all subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' }
    });

    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get plan by ID
router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: req.params.id }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create subscription plan
router.post('/plans', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, description, price, billingCycle, itemLimit, discountPercent, freePickups, freeDeliveries } = req.body;

    const plan = await prisma.subscriptionPlan.create({
      data: { name, description, price, billingCycle, itemLimit, discountPercent, freePickups, freeDeliveries }
    });

    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update subscription plan
router.put('/plans/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, description, price, billingCycle, itemLimit, discountPercent, freePickups, freeDeliveries, isActive } = req.body;

    const plan = await prisma.subscriptionPlan.update({
      where: { id: req.params.id },
      data: { name, description, price, billingCycle, itemLimit, discountPercent, freePickups, freeDeliveries, isActive }
    });

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer subscriptions
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { customerId: req.params.customerId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subscribe customer to plan
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { customerId, planId } = req.body;

    const actualCustomerId = req.user.type === 'customer' ? req.user.id : customerId;

    // Check for existing active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: { customerId: actualCustomerId, status: 'ACTIVE' }
    });

    if (existingSubscription) {
      return res.status(400).json({ error: 'Customer already has an active subscription' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Calculate dates based on billing cycle
    const startDate = new Date();
    const renewalDate = new Date(startDate);

    switch (plan.billingCycle) {
      case 'WEEKLY':
        renewalDate.setDate(renewalDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
        renewalDate.setDate(renewalDate.getDate() + 14);
        break;
      case 'MONTHLY':
        renewalDate.setMonth(renewalDate.getMonth() + 1);
        break;
      case 'YEARLY':
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        break;
    }

    const subscription = await prisma.subscription.create({
      data: {
        customerId: actualCustomerId,
        planId,
        startDate,
        renewalDate
      },
      include: { plan: true }
    });

    res.status(201).json(subscription);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete subscriptions
router.delete('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.subscription.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${result.count} items deleted`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update subscriptions
router.patch('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.subscription.updateMany({ where: { id: { in: ids } }, data });
    res.json({ message: `${result.count} items updated`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel subscription
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Check ownership
    if (req.user.type === 'customer' && subscription.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.subscription.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', endDate: new Date() }
    });

    res.json({ message: 'Subscription cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pause subscription
router.post('/:id/pause', authenticateToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (req.user.type === 'customer' && subscription.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.subscription.update({
      where: { id: req.params.id },
      data: { status: 'PAUSED' }
    });

    res.json({ message: 'Subscription paused' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resume subscription
router.post('/:id/resume', authenticateToken, async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (req.user.type === 'customer' && subscription.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate new renewal date
    const renewalDate = new Date();
    switch (subscription.plan.billingCycle) {
      case 'WEEKLY':
        renewalDate.setDate(renewalDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
        renewalDate.setDate(renewalDate.getDate() + 14);
        break;
      case 'MONTHLY':
        renewalDate.setMonth(renewalDate.getMonth() + 1);
        break;
      case 'YEARLY':
        renewalDate.setFullYear(renewalDate.getFullYear() + 1);
        break;
    }

    await prisma.subscription.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', renewalDate }
    });

    res.json({ message: 'Subscription resumed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active subscriptions (admin)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { status, planId, page = 1, limit = 20 } = req.query;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'asc';
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (planId) where.planId = planId;

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          plan: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.subscription.count({ where })
    ]);

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(subscriptions);
      res.header('Content-Type', 'text/csv');
      res.attachment('subscriptions.csv');
      return res.send(csv);
    }

    res.json({
      subscriptions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
