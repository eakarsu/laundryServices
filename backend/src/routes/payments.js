const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Process payment for order
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { orderId, amount, type, paymentMethodId, reference } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orderId,
        paymentMethodId,
        amount,
        type,
        status: 'COMPLETED',
        reference
      }
    });

    // Update order paid amount
    const newPaidAmount = parseFloat(order.paidAmount) + parseFloat(amount);
    await prisma.order.update({
      where: { id: orderId },
      data: { paidAmount: newPaidAmount }
    });

    // If using credit balance, deduct from customer
    if (type === 'CREDIT_BALANCE') {
      await prisma.customer.update({
        where: { id: order.customerId },
        data: {
          creditBalance: { decrement: parseFloat(amount) }
        }
      });
    }

    // Add loyalty points (1 point per dollar)
    await prisma.customer.update({
      where: { id: order.customerId },
      data: {
        loyaltyPoints: { increment: Math.floor(parseFloat(amount)) }
      }
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payments for order
router.get('/order/:orderId', authenticateToken, async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { orderId: req.params.orderId },
      include: { paymentMethod: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refund payment
router.post('/:id/refund', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { amount, reason } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { order: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const refundAmount = amount || payment.amount;

    // Update payment status
    await prisma.payment.update({
      where: { id: req.params.id },
      data: {
        status: refundAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
      }
    });

    // Update order paid amount
    await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        paidAmount: { decrement: parseFloat(refundAmount) }
      }
    });

    // Add refund as credit to customer account
    await prisma.customer.update({
      where: { id: payment.order.customerId },
      data: {
        creditBalance: { increment: parseFloat(refundAmount) }
      }
    });

    res.json({ message: `Refund of $${refundAmount} processed` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate receipt
router.post('/receipt', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { service: true, garmentType: true } },
        payments: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const receipt = await prisma.receipt.create({
      data: {
        orderId,
        receiptNumber,
        amount: order.total,
        printedAt: new Date()
      }
    });

    res.json({
      receipt,
      order: {
        orderNumber: order.orderNumber,
        customer: `${order.customer.firstName} ${order.customer.lastName}`,
        items: order.items.map(i => ({
          service: i.service.name,
          garment: i.garmentType.name,
          quantity: i.quantity,
          price: i.totalPrice
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        tax: order.tax,
        total: order.total,
        paid: order.paidAmount,
        payments: order.payments
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payment types
router.get('/types', async (req, res) => {
  try {
    const types = ['CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'GIFT_CARD', 'CREDIT_BALANCE', 'CHECK'];
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply customer credit
router.post('/apply-credit', authenticateToken, async (req, res) => {
  try {
    const { orderId, amount } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const availableCredit = parseFloat(order.customer.creditBalance);
    const maxApplicable = Math.min(parseFloat(amount), availableCredit, parseFloat(order.total) - parseFloat(order.paidAmount));

    if (maxApplicable <= 0) {
      return res.status(400).json({ error: 'No credit available to apply' });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: maxApplicable,
        type: 'CREDIT_BALANCE',
        status: 'COMPLETED'
      }
    });

    // Update customer credit
    await prisma.customer.update({
      where: { id: order.customerId },
      data: {
        creditBalance: { decrement: maxApplicable }
      }
    });

    // Update order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paidAmount: { increment: maxApplicable }
      }
    });

    res.json({ payment, appliedAmount: maxApplicable });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply gift card
router.post('/apply-gift-card', authenticateToken, async (req, res) => {
  try {
    const { orderId, giftCardCode } = req.body;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const giftCard = await prisma.giftCard.findUnique({ where: { code: giftCardCode } });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!giftCard || !giftCard.isActive) {
      return res.status(400).json({ error: 'Invalid gift card' });
    }

    if (giftCard.expiryDate && new Date() > giftCard.expiryDate) {
      return res.status(400).json({ error: 'Gift card has expired' });
    }

    const balance = parseFloat(giftCard.balance);
    const remaining = parseFloat(order.total) - parseFloat(order.paidAmount);
    const amountToApply = Math.min(balance, remaining);

    if (amountToApply <= 0) {
      return res.status(400).json({ error: 'No balance to apply' });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        orderId,
        amount: amountToApply,
        type: 'GIFT_CARD',
        status: 'COMPLETED',
        reference: giftCardCode
      }
    });

    // Update gift card balance
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: {
        balance: { decrement: amountToApply }
      }
    });

    // Update order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paidAmount: { increment: amountToApply }
      }
    });

    res.json({ payment, appliedAmount: amountToApply, remainingBalance: balance - amountToApply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
