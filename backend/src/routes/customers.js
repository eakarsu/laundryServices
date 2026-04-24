const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();
const prisma = new PrismaClient();

// Get all customers (staff only)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          addresses: true,
          _count: { select: { orders: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.customer.count({ where })
    ]);

    const sanitizedCustomers = customers.map(c => {
      const { passwordHash, ...customer } = c;
      return customer;
    });

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(sanitizedCustomers);
      res.header('Content-Type', 'text/csv');
      res.attachment('customers.csv');
      return res.send(csv);
    }

    res.json({
      customers: sanitizedCustomers,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete customers
router.delete('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.customer.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${result.count} items deleted`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update customers
router.patch('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.customer.updateMany({ where: { id: { in: ids } }, data });
    res.json({ message: `${result.count} items updated`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single customer
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        addresses: true,
        paymentMethods: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { items: true }
        },
        subscriptions: { include: { plan: true } },
        giftCards: true
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { passwordHash, ...customerData } = customer;
    res.json(customerData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer profile
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.type === 'customer' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Cannot update other customer profiles' });
    }

    const {
      firstName, lastName, phone,
      starchPreference, hangerPreference, creasePreference, notes
    } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        firstName, lastName, phone,
        starchPreference, hangerPreference, creasePreference, notes
      }
    });

    const { passwordHash, ...customerData } = customer;
    res.json(customerData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add customer address
router.post('/:id/addresses', authenticateToken, async (req, res) => {
  try {
    const { label, street, apartment, city, state, zipCode, latitude, longitude, isDefault, instructions } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { customerId: req.params.id },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        customerId: req.params.id,
        label, street, apartment, city, state, zipCode,
        latitude, longitude, isDefault, instructions
      }
    });

    res.status(201).json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update address
router.put('/:id/addresses/:addressId', authenticateToken, async (req, res) => {
  try {
    const { label, street, apartment, city, state, zipCode, latitude, longitude, isDefault, instructions } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { customerId: req.params.id, NOT: { id: req.params.addressId } },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.update({
      where: { id: req.params.addressId },
      data: { label, street, apartment, city, state, zipCode, latitude, longitude, isDefault, instructions }
    });

    res.json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete address
router.delete('/:id/addresses/:addressId', authenticateToken, async (req, res) => {
  try {
    await prisma.address.delete({ where: { id: req.params.addressId } });
    res.json({ message: 'Address deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add payment method
router.post('/:id/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { type, lastFour, expiryMonth, expiryYear, stripePaymentId, isDefault } = req.body;

    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { customerId: req.params.id },
        data: { isDefault: false }
      });
    }

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        customerId: req.params.id,
        type, lastFour, expiryMonth, expiryYear, stripePaymentId, isDefault
      }
    });

    res.status(201).json(paymentMethod);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete payment method
router.delete('/:id/payment-methods/:methodId', authenticateToken, async (req, res) => {
  try {
    await prisma.paymentMethod.delete({ where: { id: req.params.methodId } });
    res.json({ message: 'Payment method deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer service history
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: req.params.id },
        include: {
          items: {
            include: { service: true, garmentType: true }
          },
          pickup: true,
          delivery: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where: { customerId: req.params.id } })
    ]);

    res.json({
      orders,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add credit to customer account
router.post('/:id/credit', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { amount, reason } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        creditBalance: { increment: parseFloat(amount) }
      }
    });

    res.json({ creditBalance: customer.creditBalance, message: `$${amount} credit added` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add loyalty points
router.post('/:id/loyalty-points', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { points, reason } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        loyaltyPoints: { increment: parseInt(points) }
      }
    });

    res.json({ loyaltyPoints: customer.loyaltyPoints, message: `${points} points added` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate customer
router.post('/:id/deactivate', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ message: 'Customer deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reactivate customer
router.post('/:id/activate', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: true }
    });
    res.json({ message: 'Customer activated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
