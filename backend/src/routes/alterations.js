const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all alteration types
router.get('/types', async (req, res) => {
  try {
    const types = await prisma.alterationType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create alteration type
router.post('/types', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, description, basePrice } = req.body;

    const type = await prisma.alterationType.create({
      data: { name, description, basePrice }
    });

    res.status(201).json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alteration type
router.put('/types/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, description, basePrice, isActive } = req.body;

    const type = await prisma.alterationType.update({
      where: { id: req.params.id },
      data: { name, description, basePrice, isActive }
    });

    res.json(type);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add alteration to order item
router.post('/order-item/:orderItemId', authenticateToken, async (req, res) => {
  try {
    const { typeId, price, notes } = req.body;

    // Get alteration type for default price if not provided
    let alterationPrice = price;
    if (!alterationPrice) {
      const alterationType = await prisma.alterationType.findUnique({ where: { id: typeId } });
      alterationPrice = alterationType.basePrice;
    }

    const alteration = await prisma.alteration.create({
      data: {
        orderItemId: req.params.orderItemId,
        typeId,
        price: alterationPrice,
        notes
      },
      include: { type: true }
    });

    // Update order total
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: req.params.orderItemId },
      include: { order: true }
    });

    const order = await prisma.order.findUnique({
      where: { id: orderItem.orderId },
      include: { items: { include: { alterations: true } } }
    });

    const alterationsTotal = order.items.reduce((sum, item) =>
      sum + item.alterations.reduce((aSum, a) => aSum + parseFloat(a.price), 0), 0
    );

    const newSubtotal = parseFloat(order.subtotal) + parseFloat(alterationPrice);
    const newTax = (newSubtotal - parseFloat(order.discount) + parseFloat(order.rushFee)) * 0.08;
    const newTotal = newSubtotal - parseFloat(order.discount) + parseFloat(order.rushFee) + newTax;

    await prisma.order.update({
      where: { id: orderItem.orderId },
      data: { subtotal: newSubtotal, tax: newTax, total: newTotal }
    });

    res.status(201).json(alteration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alteration status
router.patch('/:id/status', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const { status } = req.body;

    const alteration = await prisma.alteration.update({
      where: { id: req.params.id },
      data: { status },
      include: { type: true }
    });

    res.json(alteration);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove alteration from order item
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const alteration = await prisma.alteration.findUnique({
      where: { id: req.params.id },
      include: { orderItem: true }
    });

    if (!alteration) {
      return res.status(404).json({ error: 'Alteration not found' });
    }

    await prisma.alteration.delete({ where: { id: req.params.id } });

    // Recalculate order total
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: alteration.orderItemId },
      include: { order: true }
    });

    const order = await prisma.order.findUnique({
      where: { id: orderItem.orderId },
      include: { items: { include: { alterations: true } } }
    });

    const itemsTotal = order.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
    const alterationsTotal = order.items.reduce((sum, item) =>
      sum + item.alterations.reduce((aSum, a) => aSum + parseFloat(a.price), 0), 0
    );

    const newSubtotal = itemsTotal + alterationsTotal;
    const newTax = (newSubtotal - parseFloat(order.discount) + parseFloat(order.rushFee)) * 0.08;
    const newTotal = newSubtotal - parseFloat(order.discount) + parseFloat(order.rushFee) + newTax;

    await prisma.order.update({
      where: { id: orderItem.orderId },
      data: { subtotal: newSubtotal, tax: newTax, total: newTotal }
    });

    res.json({ message: 'Alteration removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alterations for order item
router.get('/order-item/:orderItemId', authenticateToken, async (req, res) => {
  try {
    const alterations = await prisma.alteration.findMany({
      where: { orderItemId: req.params.orderItemId },
      include: { type: true }
    });

    res.json(alterations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pending alterations
router.get('/pending', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const alterations = await prisma.alteration.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      include: {
        type: true,
        orderItem: {
          include: {
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true } }
              }
            },
            garmentType: true
          }
        }
      },
      orderBy: { orderItem: { createdAt: 'asc' } }
    });

    res.json(alterations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
