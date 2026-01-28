const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all garment types
router.get('/', async (req, res) => {
  try {
    const { category, active = true } = req.query;

    const where = {};
    if (category) where.category = category;
    if (active === 'true') where.isActive = true;

    const garmentTypes = await prisma.garmentType.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    res.json(garmentTypes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get garment type by ID
router.get('/:id', async (req, res) => {
  try {
    const garmentType = await prisma.garmentType.findUnique({
      where: { id: req.params.id },
      include: {
        servicePrices: {
          include: { service: true }
        }
      }
    });

    if (!garmentType) {
      return res.status(404).json({ error: 'Garment type not found' });
    }

    res.json(garmentType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create garment type
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, category, basePrice } = req.body;

    const garmentType = await prisma.garmentType.create({
      data: { name, category, basePrice }
    });

    res.status(201).json(garmentType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update garment type
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, category, basePrice, isActive } = req.body;

    const garmentType = await prisma.garmentType.update({
      where: { id: req.params.id },
      data: { name, category, basePrice, isActive }
    });

    res.json(garmentType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete garment type
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.garmentType.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Garment type deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get garment categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await prisma.garmentType.findMany({
      select: { category: true },
      distinct: ['category']
    });

    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
