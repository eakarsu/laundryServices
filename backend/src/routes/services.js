const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all services
router.get('/', async (req, res) => {
  try {
    const { category, active = true } = req.query;

    const where = {};
    if (category) where.category = category;
    if (active === 'true') where.isActive = true;

    const services = await prisma.service.findMany({
      where,
      include: {
        servicePrices: {
          include: { garmentType: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get service by ID
router.get('/:id', async (req, res) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: {
        servicePrices: {
          include: { garmentType: true }
        }
      }
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create service
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, description, category, basePrice, estimatedDays } = req.body;

    const service = await prisma.service.create({
      data: { name, description, category, basePrice, estimatedDays }
    });

    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update service
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, description, category, basePrice, estimatedDays, isActive } = req.body;

    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: { name, description, category, basePrice, estimatedDays, isActive }
    });

    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete service
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.service.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Service deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get service categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = ['DRY_CLEANING', 'LAUNDRY', 'WASH_FOLD', 'PRESSING', 'ALTERATIONS', 'SPECIALTY'];
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
