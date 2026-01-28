const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Generate gift card code
const generateGiftCardCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get all gift cards
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { active, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (active === 'true') where.isActive = true;

    const [giftCards, total] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.giftCard.count({ where })
    ]);

    res.json({
      giftCards,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get gift card by code
router.get('/code/:code', async (req, res) => {
  try {
    const code = req.params.code.replace(/-/g, '').toUpperCase();
    const formattedCode = code.match(/.{1,4}/g)?.join('-') || code;

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: formattedCode }
    });

    if (!giftCard) {
      return res.status(404).json({ error: 'Gift card not found' });
    }

    res.json({
      code: giftCard.code,
      balance: giftCard.balance,
      isActive: giftCard.isActive,
      expiryDate: giftCard.expiryDate,
      isExpired: giftCard.expiryDate && new Date() > giftCard.expiryDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create gift card
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const { amount, customerId, expiryDate } = req.body;

    const code = generateGiftCardCode();

    const giftCard = await prisma.giftCard.create({
      data: {
        code,
        customerId,
        balance: amount,
        initialValue: amount,
        expiryDate: expiryDate ? new Date(expiryDate) : null
      }
    });

    res.status(201).json(giftCard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add balance to gift card
router.post('/:id/reload', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { amount } = req.body;

    const giftCard = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: {
        balance: { increment: parseFloat(amount) }
      }
    });

    res.json(giftCard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate gift card
router.post('/:id/deactivate', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    await prisma.giftCard.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Gift card deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer gift card to customer
router.post('/:id/transfer', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.body;

    const giftCard = await prisma.giftCard.update({
      where: { id: req.params.id },
      data: { customerId }
    });

    res.json(giftCard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer gift cards
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const giftCards = await prisma.giftCard.findMany({
      where: {
        customerId: req.params.customerId,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(giftCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check balance
router.post('/check-balance', async (req, res) => {
  try {
    const { code } = req.body;
    const formattedCode = code.replace(/-/g, '').toUpperCase().match(/.{1,4}/g)?.join('-') || code;

    const giftCard = await prisma.giftCard.findUnique({
      where: { code: formattedCode }
    });

    if (!giftCard) {
      return res.status(404).json({ error: 'Gift card not found' });
    }

    if (!giftCard.isActive) {
      return res.json({ valid: false, error: 'Gift card is inactive' });
    }

    if (giftCard.expiryDate && new Date() > giftCard.expiryDate) {
      return res.json({ valid: false, error: 'Gift card has expired' });
    }

    res.json({
      valid: true,
      balance: parseFloat(giftCard.balance),
      expiryDate: giftCard.expiryDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
