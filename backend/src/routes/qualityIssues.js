const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();
const prisma = new PrismaClient();

// Get all quality issues with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, severity, type, customerId, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (type) where.issueType = type;
    if (customerId) where.customerId = customerId;

    const [issues, total] = await Promise.all([
      prisma.qualityIssue.findMany({
        where,
        include: {
          order: {
            select: { orderNumber: true, status: true }
          },
          customer: {
            select: { firstName: true, lastName: true, email: true, phone: true }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.qualityIssue.count({ where })
    ]);

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(issues);
      res.header('Content-Type', 'text/csv');
      res.attachment('quality-issues.csv');
      return res.send(csv);
    }

    res.json({
      data: issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get quality issue statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [byStatus, bySeverity, byType, recentResolved] = await Promise.all([
      prisma.qualityIssue.groupBy({
        by: ['status'],
        _count: { id: true }
      }),
      prisma.qualityIssue.groupBy({
        by: ['severity'],
        _count: { id: true }
      }),
      prisma.qualityIssue.groupBy({
        by: ['issueType'],
        _count: { id: true }
      }),
      prisma.qualityIssue.count({
        where: {
          status: 'RESOLVED',
          resolvedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    const openIssues = byStatus.find(s => s.status === 'OPEN')?._count?.id || 0;
    const criticalIssues = bySeverity.find(s => s.severity === 'CRITICAL')?._count?.id || 0;

    res.json({
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
      bySeverity: bySeverity.reduce((acc, s) => ({ ...acc, [s.severity]: s._count.id }), {}),
      byType: byType.reduce((acc, s) => ({ ...acc, [s.issueType]: s._count.id }), {}),
      summary: {
        openIssues,
        criticalIssues,
        resolvedThisWeek: recentResolved
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete quality issues
router.delete('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.qualityIssue.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${result.count} items deleted`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update quality issues
router.patch('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.qualityIssue.updateMany({ where: { id: { in: ids } }, data });
    res.json({ message: `${result.count} items updated`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single quality issue
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const issue = await prisma.qualityIssue.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            items: {
              include: {
                garmentType: true,
                service: true
              }
            }
          }
        },
        customer: true
      }
    });

    if (!issue) {
      return res.status(404).json({ error: 'Quality issue not found' });
    }

    res.json(issue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create quality issue
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      orderItemId,
      customerId,
      issueType,
      severity,
      title,
      description,
      photoUrls
    } = req.body;

    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const issue = await prisma.qualityIssue.create({
      data: {
        orderId,
        orderItemId,
        customerId: customerId || order.customerId,
        reportedBy: req.user.userType === 'staff' ? req.user.id : null,
        issueType,
        severity: severity || 'MEDIUM',
        title,
        description,
        photoUrls: photoUrls || []
      },
      include: {
        order: { select: { orderNumber: true } },
        customer: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('quality-issue:created', issue);
    }

    res.status(201).json(issue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update quality issue
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { status, resolution, compensationType, compensationAmount, customerNotified } = req.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (resolution) updateData.resolution = resolution;
    // Only set compensationType if it's a valid non-empty value
    if (compensationType && compensationType !== '') {
      updateData.compensationType = compensationType;
    } else if (compensationType === '') {
      updateData.compensationType = null;
    }
    // Only set compensationAmount if it's a valid number
    if (compensationAmount !== undefined && compensationAmount !== '' && compensationAmount !== null) {
      updateData.compensationAmount = parseFloat(compensationAmount);
    } else if (compensationAmount === '' || compensationAmount === null) {
      updateData.compensationAmount = null;
    }
    if (customerNotified !== undefined) updateData.customerNotified = customerNotified;

    // If resolving, set resolved fields
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const issue = await prisma.qualityIssue.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        order: { select: { orderNumber: true } },
        customer: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    // Apply compensation if specified
    if (compensationType && compensationAmount && issue.customerId) {
      if (compensationType === 'CREDIT') {
        await prisma.customer.update({
          where: { id: issue.customerId },
          data: { creditBalance: { increment: parseFloat(compensationAmount) } }
        });
      }
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('quality-issue:updated', issue);
    }

    res.json(issue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete quality issue
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.qualityIssue.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Quality issue deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get issues by customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const issues = await prisma.qualityIssue.findMany({
      where: { customerId: req.params.customerId },
      include: {
        order: { select: { orderNumber: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get issues by order
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const issues = await prisma.qualityIssue.findMany({
      where: { orderId: req.params.orderId },
      include: {
        customer: { select: { firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
