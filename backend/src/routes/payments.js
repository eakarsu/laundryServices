const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// ── Stripe: Create PaymentIntent ────────────────────────────────────────────
// POST /api/payments/charge
// Body: { orderId, amount (in dollars), currency? }
// Returns: { clientSecret, paymentIntentId }
router.post('/charge', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const { orderId, amount, currency = 'usd' } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({ error: 'orderId and amount are required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Stripe amounts are in cents (integer)
    const amountInCents = Math.round(parseFloat(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      metadata: {
        orderId,
        orderNumber: order.orderNumber,
        customerId: order.customerId
      },
      description: `Laundry Services — Order ${order.orderNumber}`
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Stripe charge error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Stripe: Payment Webhook ─────────────────────────────────────────────────
// POST /api/payments/webhook
// Stripe sends events here; must use raw body for signature verification.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // No secret configured — parse the raw body directly (dev only)
      event = JSON.parse(req.body.toString());
      console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const { orderId } = intent.metadata;

        if (orderId) {
          const amountReceived = intent.amount_received / 100; // convert cents → dollars

          // Record the payment
          const order = await prisma.order.findUnique({ where: { id: orderId } });
          if (order) {
            await prisma.payment.create({
              data: {
                orderId,
                amount: amountReceived,
                type: 'CREDIT_CARD',
                status: 'COMPLETED',
                stripePaymentId: intent.id,
                reference: intent.id
              }
            });

            // Update order paid amount
            await prisma.order.update({
              where: { id: orderId },
              data: {
                paidAmount: { increment: amountReceived },
                stripePaymentId: intent.id
              }
            });

            console.log(`✅ Payment succeeded for order ${orderId} — amount: $${amountReceived}`);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object;
        const { orderId } = intent.metadata;
        if (orderId) {
          await prisma.payment.create({
            data: {
              orderId,
              amount: intent.amount / 100,
              type: 'CREDIT_CARD',
              status: 'FAILED',
              stripePaymentId: intent.id,
              reference: intent.last_payment_error?.message || 'Payment failed'
            }
          });
          console.warn(`❌ Payment failed for order ${orderId}`);
        }
        break;
      }

      default:
        console.log(`Stripe webhook event received: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
