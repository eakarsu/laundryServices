const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');
const { sendSubscriptionEmail } = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_SUB_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';

// Billing cycle → Stripe interval mapping
const BILLING_CYCLE_MAP = {
  WEEKLY: { interval: 'week', interval_count: 1 },
  BIWEEKLY: { interval: 'week', interval_count: 2 },
  MONTHLY: { interval: 'month', interval_count: 1 },
  YEARLY: { interval: 'year', interval_count: 1 }
};

// ── Stripe: Create Subscription ─────────────────────────────────────────────
// POST /api/subscriptions/create
// Body: { customerId, planId, paymentMethodId (Stripe PM id) }
router.post('/create', authenticateToken, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const { customerId, planId, paymentMethodId } = req.body;
    const actualCustomerId = req.user.type === 'customer' ? req.user.id : customerId;

    // Check for existing active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: { customerId: actualCustomerId, status: 'ACTIVE' }
    });
    if (existingSubscription) {
      return res.status(400).json({ error: 'Customer already has an active subscription' });
    }

    const [plan, customer] = await Promise.all([
      prisma.subscriptionPlan.findUnique({ where: { id: planId } }),
      prisma.customer.findUnique({ where: { id: actualCustomerId } })
    ]);

    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const cycleConfig = BILLING_CYCLE_MAP[plan.billingCycle] || BILLING_CYCLE_MAP.MONTHLY;

    // Get or create Stripe customer
    let stripeCustomerId = customer.stripeCustomerId;
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: customer.email,
        name: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone || undefined,
        metadata: { customerId: customer.id }
      });
      stripeCustomerId = stripeCustomer.id;

      // Store stripe customer id on our customer record (add field if it doesn't exist yet)
      try {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { stripeCustomerId }
        });
      } catch (_) {
        // Field may not exist in schema — silently continue
      }
    }

    // Attach payment method if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
    }

    // Create Stripe Price (inline) for this plan
    const stripePrice = await stripe.prices.create({
      unit_amount: Math.round(parseFloat(plan.price) * 100),
      currency: 'usd',
      recurring: {
        interval: cycleConfig.interval,
        interval_count: cycleConfig.interval_count
      },
      product_data: { name: plan.name }
    });

    // Create the Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: stripePrice.id }],
      metadata: { planId, customerId: actualCustomerId },
      expand: ['latest_invoice.payment_intent']
    });

    // Calculate dates
    const startDate = new Date();
    const renewalDate = new Date(stripeSubscription.current_period_end * 1000);

    const subscription = await prisma.subscription.create({
      data: {
        customerId: actualCustomerId,
        planId,
        startDate,
        renewalDate,
        stripeSubId: stripeSubscription.id
      },
      include: { plan: true, customer: true }
    });

    // Send confirmation email (non-blocking)
    if (customer.email) {
      sendSubscriptionEmail(customer.email, 'created', {
        customerName: `${customer.firstName} ${customer.lastName}`,
        planName: plan.name,
        amount: parseFloat(plan.price).toFixed(2),
        nextRenewalDate: renewalDate.toLocaleDateString()
      }).catch(err => console.error('Subscription email failed:', err.message));
    }

    res.status(201).json({
      subscription,
      stripeSubscriptionId: stripeSubscription.id,
      clientSecret: stripeSubscription.latest_invoice?.payment_intent?.client_secret
    });
  } catch (error) {
    console.error('Stripe subscription create error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ── Stripe: Subscription Webhook ────────────────────────────────────────────
// POST /api/subscriptions/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    if (STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(req.body.toString());
      console.warn('⚠️  STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
    }
  } catch (err) {
    console.error('Subscription webhook verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'invoice.paid': {
        // Subscription renewal succeeded
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;

        if (stripeSubId) {
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubId },
            include: { plan: true, customer: true }
          });

          if (subscription) {
            // Update renewal date from Stripe subscription period end
            const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
            const newRenewalDate = new Date(stripeSub.current_period_end * 1000);

            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'ACTIVE', renewalDate: newRenewalDate }
            });

            // Send renewal success email
            if (subscription.customer?.email) {
              sendSubscriptionEmail(subscription.customer.email, 'renewal_success', {
                customerName: `${subscription.customer.firstName} ${subscription.customer.lastName}`,
                planName: subscription.plan?.name || 'Subscription',
                amount: (invoice.amount_paid / 100).toFixed(2),
                nextRenewalDate: newRenewalDate.toLocaleDateString()
              }).catch(err => console.error('Renewal email failed:', err.message));
            }

            console.log(`✅ Subscription ${stripeSubId} renewed successfully`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Renewal payment failed
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription;

        if (stripeSubId) {
          const subscription = await prisma.subscription.findFirst({
            where: { stripeSubId },
            include: { plan: true, customer: true }
          });

          if (subscription) {
            // Don't immediately cancel — Stripe retries; mark it so UI can show warning
            console.warn(`⚠️  Subscription renewal payment failed for ${stripeSubId}`);

            if (subscription.customer?.email) {
              sendSubscriptionEmail(subscription.customer.email, 'renewal_failed', {
                customerName: `${subscription.customer.firstName} ${subscription.customer.lastName}`,
                planName: subscription.plan?.name || 'Subscription',
                amount: (invoice.amount_due / 100).toFixed(2),
                nextRenewalDate: ''
              }).catch(err => console.error('Renewal failure email failed:', err.message));
            }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription cancelled in Stripe (e.g. after all retries exhausted)
        const stripeSub = event.data.object;

        const subscription = await prisma.subscription.findFirst({
          where: { stripeSubId: stripeSub.id },
          include: { customer: true, plan: true }
        });

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'CANCELLED', endDate: new Date() }
          });

          if (subscription.customer?.email) {
            sendSubscriptionEmail(subscription.customer.email, 'cancelled', {
              customerName: `${subscription.customer.firstName} ${subscription.customer.lastName}`,
              planName: subscription.plan?.name || 'Subscription',
              amount: '',
              nextRenewalDate: ''
            }).catch(err => console.error('Cancellation email failed:', err.message));
          }

          console.log(`🚫 Subscription ${stripeSub.id} cancelled`);
        }
        break;
      }

      default:
        console.log(`Stripe subscription webhook: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Subscription webhook handler error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
