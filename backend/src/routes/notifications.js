const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get notifications for customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const where = { customerId: req.params.customerId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, status: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      notifications,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all notifications (admin)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { status, type, channel, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (channel) where.channel = channel;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
          order: { select: { orderNumber: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      notifications,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create notification
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { customerId, orderId, type, channel, subject, message } = req.body;

    const notification = await prisma.notification.create({
      data: { customerId, orderId, type, channel, subject, message }
    });

    // Simulate sending (in production, integrate with SMS/Email provider)
    setTimeout(async () => {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() }
      });
    }, 1000);

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send bulk notification
router.post('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { customerIds, type, channel, subject, message } = req.body;

    const notifications = await Promise.all(
      customerIds.map(customerId =>
        prisma.notification.create({
          data: { customerId, type, channel, subject, message }
        })
      )
    );

    // Simulate sending
    setTimeout(async () => {
      await prisma.notification.updateMany({
        where: { id: { in: notifications.map(n => n.id) } },
        data: { status: 'SENT', sentAt: new Date() }
      });
    }, 2000);

    res.status(201).json({ message: `${notifications.length} notifications created`, notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resend notification
router.post('/:id/resend', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.id }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Create new notification with same content
    const newNotification = await prisma.notification.create({
      data: {
        customerId: notification.customerId,
        orderId: notification.orderId,
        type: notification.type,
        channel: notification.channel,
        subject: notification.subject,
        message: notification.message
      }
    });

    // Simulate sending
    setTimeout(async () => {
      await prisma.notification.update({
        where: { id: newNotification.id },
        data: { status: 'SENT', sentAt: new Date() }
      });
    }, 1000);

    res.json(newNotification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notification types
router.get('/types', async (req, res) => {
  try {
    const types = [
      'ORDER_CONFIRMATION',
      'ORDER_READY',
      'ORDER_DELIVERED',
      'PICKUP_REMINDER',
      'DELIVERY_UPDATE',
      'PROMOTION',
      'REACTIVATION',
      'CYCLE_COMPLETE'
    ];
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notification channels
router.get('/channels', async (req, res) => {
  try {
    const channels = ['EMAIL', 'SMS', 'PUSH'];
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notification stats
router.get('/stats', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [total, sent, failed, pending] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, status: 'SENT' } }),
      prisma.notification.count({ where: { ...where, status: 'FAILED' } }),
      prisma.notification.count({ where: { ...where, status: 'PENDING' } })
    ]);

    // By channel
    const byChannel = await prisma.notification.groupBy({
      by: ['channel'],
      where,
      _count: true
    });

    // By type
    const byType = await prisma.notification.groupBy({
      by: ['type'],
      where,
      _count: true
    });

    res.json({
      total,
      sent,
      failed,
      pending,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(1) : 0,
      byChannel: byChannel.map(c => ({ channel: c.channel, count: c._count })),
      byType: byType.map(t => ({ type: t.type, count: t._count }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
