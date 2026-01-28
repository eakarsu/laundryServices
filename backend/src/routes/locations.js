const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all locations
router.get('/', async (req, res) => {
  try {
    const { active = true } = req.query;

    const where = {};
    if (active === 'true') where.isActive = true;

    const locations = await prisma.location.findMany({
      where,
      include: {
        _count: {
          select: { machines: true, staff: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get location by ID
router.get('/:id', async (req, res) => {
  try {
    const location = await prisma.location.findUnique({
      where: { id: req.params.id },
      include: {
        machines: true,
        staff: {
          select: { id: true, firstName: true, lastName: true, role: true, email: true }
        }
      }
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create location
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { name, address, city, state, zipCode, phone, openTime, closeTime } = req.body;

    const location = await prisma.location.create({
      data: { name, address, city, state, zipCode, phone, openTime, closeTime }
    });

    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update location
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { name, address, city, state, zipCode, phone, openTime, closeTime, isActive } = req.body;

    const location = await prisma.location.update({
      where: { id: req.params.id },
      data: { name, address, city, state, zipCode, phone, openTime, closeTime, isActive }
    });

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get location machines
router.get('/:id/machines', async (req, res) => {
  try {
    const machines = await prisma.machine.findMany({
      where: { locationId: req.params.id },
      orderBy: { machineNumber: 'asc' }
    });

    res.json(machines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get location staff
router.get('/:id/staff', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      where: { locationId: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true
      },
      orderBy: { firstName: 'asc' }
    });

    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete location
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.location.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Location deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
