const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();
const prisma = new PrismaClient();

// Get all lockers
router.get('/', async (req, res) => {
  try {
    const { active = true } = req.query;
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder || 'asc';

    const where = {};
    if (active === 'true') where.isActive = true;

    const lockers = await prisma.locker.findMany({
      where,
      include: {
        _count: {
          select: { deliveries: { where: { status: 'IN_LOCKER' } } }
        }
      },
      orderBy: { [sortBy]: sortOrder }
    });

    const mappedLockers = lockers.map(locker => ({
      ...locker,
      occupiedUnits: locker._count.deliveries
    }));

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(mappedLockers);
      res.header('Content-Type', 'text/csv');
      res.attachment('lockers.csv');
      return res.send(csv);
    }

    res.json(mappedLockers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete lockers
router.delete('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.locker.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${result.count} items deleted`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update lockers
router.patch('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.locker.updateMany({ where: { id: { in: ids } }, data });
    res.json({ message: `${result.count} items updated`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get locker by ID
router.get('/:id', async (req, res) => {
  try {
    const locker = await prisma.locker.findUnique({
      where: { id: req.params.id },
      include: {
        deliveries: {
          where: { status: 'IN_LOCKER' },
          include: {
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, phone: true } }
              }
            }
          }
        }
      }
    });

    if (!locker) {
      return res.status(404).json({ error: 'Locker not found' });
    }

    res.json({
      ...locker,
      occupiedUnits: locker.deliveries.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create locker
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, location, address, totalUnits } = req.body;

    const locker = await prisma.locker.create({
      data: {
        name,
        location,
        address,
        totalUnits,
        availableUnits: totalUnits
      }
    });

    res.status(201).json(locker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update locker
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, location, address, totalUnits, isActive } = req.body;

    // Recalculate available units if total changed
    let availableUnits;
    if (totalUnits !== undefined) {
      const occupiedCount = await prisma.delivery.count({
        where: { lockerId: req.params.id, status: 'IN_LOCKER' }
      });
      availableUnits = totalUnits - occupiedCount;
    }

    const locker = await prisma.locker.update({
      where: { id: req.params.id },
      data: {
        name,
        location,
        address,
        totalUnits,
        availableUnits,
        isActive
      }
    });

    res.json(locker);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign delivery to locker
router.post('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { deliveryId } = req.body;

    const locker = await prisma.locker.findUnique({ where: { id: req.params.id } });

    if (!locker) {
      return res.status(404).json({ error: 'Locker not found' });
    }

    if (locker.availableUnits <= 0) {
      return res.status(400).json({ error: 'No available units in this locker' });
    }

    // Update delivery
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        lockerId: req.params.id,
        status: 'IN_LOCKER',
        actualTime: new Date()
      }
    });

    // Update locker availability
    await prisma.locker.update({
      where: { id: req.params.id },
      data: {
        availableUnits: { decrement: 1 }
      }
    });

    // Update order status
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { include: { customer: true } } }
    });

    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: 'DELIVERED' }
    });

    // Send notification
    await prisma.notification.create({
      data: {
        customerId: delivery.order.customerId,
        orderId: delivery.orderId,
        type: 'ORDER_DELIVERED',
        channel: 'SMS',
        message: `Your order ${delivery.order.orderNumber} has been placed in locker ${locker.name}. Location: ${locker.location}`
      }
    });

    res.json({ message: 'Delivery assigned to locker' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Release from locker (customer picked up)
router.post('/:id/release', authenticateToken, async (req, res) => {
  try {
    const { deliveryId } = req.body;

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId }
    });

    if (!delivery || delivery.lockerId !== req.params.id) {
      return res.status(404).json({ error: 'Delivery not found in this locker' });
    }

    // Update delivery
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: { status: 'DELIVERED' }
    });

    // Update locker availability
    await prisma.locker.update({
      where: { id: req.params.id },
      data: {
        availableUnits: { increment: 1 }
      }
    });

    // Update order status
    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: 'COMPLETED' }
    });

    res.json({ message: 'Item released from locker' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get locker availability
router.get('/:id/availability', async (req, res) => {
  try {
    const locker = await prisma.locker.findUnique({
      where: { id: req.params.id }
    });

    if (!locker) {
      return res.status(404).json({ error: 'Locker not found' });
    }

    res.json({
      totalUnits: locker.totalUnits,
      availableUnits: locker.availableUnits,
      occupiedUnits: locker.totalUnits - locker.availableUnits,
      utilizationRate: ((locker.totalUnits - locker.availableUnits) / locker.totalUnits * 100).toFixed(1)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete locker
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // Check if there are items in locker
    const deliveriesInLocker = await prisma.delivery.count({
      where: { lockerId: req.params.id, status: 'IN_LOCKER' }
    });

    if (deliveriesInLocker > 0) {
      return res.status(400).json({ error: 'Cannot delete locker with items inside' });
    }

    await prisma.locker.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Locker deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
