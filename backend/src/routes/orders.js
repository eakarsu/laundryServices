const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');
const { sendOrderStatusEmail } = require('../services/emailService');
const { sendOrderStatusSMS } = require('../services/smsService');

const router = express.Router();
const prisma = new PrismaClient();

// Generate order number
const generateOrderNumber = () => {
  const date = new Date();
  const prefix = `ORD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${suffix}`;
};

// Get all orders (staff) or customer orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, customerId, startDate, endDate, page = 1, limit = 20, isRush } = req.query;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const skip = (page - 1) * limit;

    let where = {};

    if (req.user.type === 'customer') {
      where.customerId = req.user.id;
    } else if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    if (isRush === 'true') {
      where.isRush = true;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true }
          },
          items: {
            include: {
              service: true,
              garmentType: true,
              alterations: { include: { type: true } }
            }
          },
          pickup: { include: { address: true, driver: true } },
          delivery: { include: { address: true, driver: true } },
          payments: true,
          coupon: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder }
      }),
      prisma.order.count({ where })
    ]);

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(orders);
      res.header('Content-Type', 'text/csv');
      res.attachment('orders.csv');
      return res.send(csv);
    }

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

// Bulk delete orders
router.delete('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.order.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${result.count} items deleted`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update orders
router.patch('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.order.updateMany({ where: { id: { in: ids } }, data });
    res.json({ message: `${result.count} items updated`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, starchPreference: true, hangerPreference: true }
        },
        items: {
          include: {
            service: true,
            garmentType: true,
            alterations: { include: { type: true } }
          }
        },
        pickup: { include: { address: true, driver: true } },
        delivery: { include: { address: true, driver: true, locker: true } },
        payments: { include: { paymentMethod: true } },
        coupon: true,
        notifications: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.type === 'customer' && order.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new order
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customerId,
      items,
      isRush,
      rushFee = 0,
      specialInstructions,
      couponCode,
      pickup,
      delivery
    } = req.body;

    const actualCustomerId = req.user.type === 'customer' ? req.user.id : customerId;

    // Calculate prices
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      // Get service price for garment type
      let unitPrice = item.unitPrice;

      if (!unitPrice) {
        const servicePrice = await prisma.servicePrice.findUnique({
          where: {
            serviceId_garmentTypeId: {
              serviceId: item.serviceId,
              garmentTypeId: item.garmentTypeId
            }
          }
        });

        if (servicePrice) {
          unitPrice = parseFloat(servicePrice.price);
        } else {
          const service = await prisma.service.findUnique({ where: { id: item.serviceId } });
          unitPrice = parseFloat(service.basePrice);
        }
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        serviceId: item.serviceId,
        garmentTypeId: item.garmentTypeId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        tagNumber: item.tagNumber || `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        barcode: item.barcode,
        specialNotes: item.specialNotes,
        stainNotes: item.stainNotes
      });
    }

    // Apply coupon if provided
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

    const tax = (subtotal - discount + parseFloat(rushFee || 0)) * 0.08; // 8% tax
    const total = subtotal - discount + parseFloat(rushFee || 0) + tax;

    // Estimate ready date
    const maxDays = isRush ? 1 : Math.max(...items.map(i => 2)); // Default 2 days
    const estimatedReady = new Date();
    estimatedReady.setDate(estimatedReady.getDate() + maxDays);

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerId: actualCustomerId,
        isRush: isRush || false,
        rushFee: parseFloat(rushFee || 0),
        specialInstructions,
        subtotal,
        discount,
        tax,
        total,
        estimatedReady,
        couponId: coupon?.id,
        items: {
          create: orderItems
        },
        ...(pickup && {
          pickup: {
            create: {
              addressId: pickup.addressId,
              scheduledStart: new Date(pickup.scheduledStart),
              scheduledEnd: new Date(pickup.scheduledEnd),
              notes: pickup.notes
            }
          }
        }),
        ...(delivery && {
          delivery: {
            create: {
              addressId: delivery.addressId,
              scheduledStart: new Date(delivery.scheduledStart),
              scheduledEnd: new Date(delivery.scheduledEnd),
              notes: delivery.notes,
              lockerId: delivery.lockerId
            }
          }
        })
      },
      include: {
        customer: true,
        items: { include: { service: true, garmentType: true } },
        pickup: { include: { address: true } },
        delivery: { include: { address: true } }
      }
    });

    // Update coupon usage
    if (coupon) {
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { usageCount: { increment: 1 } }
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        customerId: actualCustomerId,
        orderId: order.id,
        type: 'ORDER_CONFIRMATION',
        channel: 'EMAIL',
        subject: `Order Confirmation - ${order.orderNumber}`,
        message: `Your order ${order.orderNumber} has been placed successfully.`
      }
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/:id/status', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const { status } = req.body;

    const updateData = { status };

    if (status === 'READY') {
      updateData.actualReady = new Date();
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
      include: { customer: true }
    });

    // Send notifications for all status changes
    const notifyStatuses = ['PICKED_UP', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (notifyStatuses.includes(status)) {
      const typeMap = {
        PICKED_UP: 'ORDER_CONFIRMATION',
        READY: 'ORDER_READY',
        OUT_FOR_DELIVERY: 'DELIVERY_UPDATE',
        DELIVERED: 'ORDER_DELIVERED',
        CANCELLED: 'ORDER_CONFIRMATION'
      };

      const orderDetails = {
        orderNumber: order.orderNumber,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        total: order.total,
        estimatedReady: order.estimatedReady
      };

      // Create notification record
      await prisma.notification.create({
        data: {
          customerId: order.customerId,
          orderId: order.id,
          type: typeMap[status] || 'DELIVERY_UPDATE',
          channel: 'EMAIL',
          subject: `Order ${order.orderNumber} — ${status.replace(/_/g, ' ')}`,
          message: `Your order ${order.orderNumber} status has been updated to ${status.replace(/_/g, ' ')}.`
        }
      });

      // Send real email and SMS notifications (fire-and-forget, don't block response)
      if (order.customer.email) {
        sendOrderStatusEmail(order.customer.email, status, orderDetails).catch(err =>
          console.error(`Email notification failed for order ${order.id}:`, err.message)
        );
      }

      if (order.customer.phone) {
        sendOrderStatusSMS(order.customer.phone, status, orderDetails).catch(err =>
          console.error(`SMS notification failed for order ${order.id}:`, err.message)
        );
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order item status
router.patch('/:id/items/:itemId/status', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK', 'PRESSER', 'CLEANER'), async (req, res) => {
  try {
    const { status } = req.body;

    const item = await prisma.orderItem.update({
      where: { id: req.params.itemId },
      data: { status }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add item to order
router.post('/:id/items', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const { serviceId, garmentTypeId, quantity, specialNotes, stainNotes } = req.body;

    // Get price
    const servicePrice = await prisma.servicePrice.findUnique({
      where: { serviceId_garmentTypeId: { serviceId, garmentTypeId } }
    });

    let unitPrice;
    if (servicePrice) {
      unitPrice = parseFloat(servicePrice.price);
    } else {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      unitPrice = parseFloat(service.basePrice);
    }

    const totalPrice = unitPrice * quantity;

    const item = await prisma.orderItem.create({
      data: {
        orderId: req.params.id,
        serviceId,
        garmentTypeId,
        quantity,
        unitPrice,
        totalPrice,
        tagNumber: `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        specialNotes,
        stainNotes
      },
      include: { service: true, garmentType: true }
    });

    // Update order totals
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });

    const subtotal = order.items.reduce((sum, i) => sum + parseFloat(i.totalPrice), 0);
    const tax = (subtotal - parseFloat(order.discount) + parseFloat(order.rushFee)) * 0.08;
    const total = subtotal - parseFloat(order.discount) + parseFloat(order.rushFee) + tax;

    await prisma.order.update({
      where: { id: req.params.id },
      data: { subtotal, tax, total }
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove item from order
router.delete('/:id/items/:itemId', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.orderItem.delete({ where: { id: req.params.itemId } });

    // Recalculate order totals
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true }
    });

    const subtotal = order.items.reduce((sum, i) => sum + parseFloat(i.totalPrice), 0);
    const tax = (subtotal - parseFloat(order.discount) + parseFloat(order.rushFee)) * 0.08;
    const total = subtotal - parseFloat(order.discount) + parseFloat(order.rushFee) + tax;

    await prisma.order.update({
      where: { id: req.params.id },
      data: { subtotal, tax, total }
    });

    res.json({ message: 'Item removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.type === 'customer' && order.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['PENDING', 'PICKED_UP'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }

    await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' }
    });

    // Cancel pickup/delivery if scheduled
    await prisma.pickup.updateMany({
      where: { orderId: req.params.id },
      data: { status: 'CANCELLED' }
    });

    await prisma.delivery.updateMany({
      where: { orderId: req.params.id },
      data: { status: 'CANCELLED' }
    });

    res.json({ message: 'Order cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order by order number
router.get('/number/:orderNumber', authenticateToken, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        },
        items: {
          include: {
            service: true,
            garmentType: true,
            alterations: { include: { type: true } }
          }
        },
        pickup: { include: { address: true, driver: true } },
        delivery: { include: { address: true, driver: true } },
        payments: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
