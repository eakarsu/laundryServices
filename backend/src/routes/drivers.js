const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all drivers
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { available, active = true } = req.query;

    const where = {};
    if (active === 'true') where.isActive = true;
    if (available === 'true') where.isAvailable = true;

    const drivers = await prisma.driver.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        licenseNumber: true,
        vehicleInfo: true,
        isActive: true,
        isAvailable: true,
        currentLat: true,
        currentLng: true,
        createdAt: true,
        _count: {
          select: {
            pickups: true,
            deliveries: true
          }
        }
      },
      orderBy: { firstName: 'asc' }
    });

    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        licenseNumber: true,
        vehicleInfo: true,
        isActive: true,
        isAvailable: true,
        currentLat: true,
        currentLng: true,
        createdAt: true,
        routes: {
          take: 10,
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create driver
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { email, phone, firstName, lastName, password, licenseNumber, vehicleInfo } = req.body;

    const existingDriver = await prisma.driver.findUnique({ where: { email } });
    if (existingDriver) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const driver = await prisma.driver.create({
      data: {
        email, phone, firstName, lastName, passwordHash, licenseNumber, vehicleInfo
      },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        licenseNumber: true,
        vehicleInfo: true,
        isActive: true,
        isAvailable: true
      }
    });

    res.status(201).json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { phone, firstName, lastName, licenseNumber, vehicleInfo, isActive, isAvailable } = req.body;

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { phone, firstName, lastName, licenseNumber, vehicleInfo, isActive, isAvailable },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        licenseNumber: true,
        vehicleInfo: true,
        isActive: true,
        isAvailable: true
      }
    });

    res.json(driver);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver location
router.patch('/:id/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    await prisma.driver.update({
      where: { id: req.params.id },
      data: { currentLat: latitude, currentLng: longitude }
    });

    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver availability
router.patch('/:id/availability', authenticateToken, async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { isAvailable }
    });

    res.json({ isAvailable: driver.isAvailable });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver's today's tasks
router.get('/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pickups, deliveries] = await Promise.all([
      prisma.pickup.findMany({
        where: {
          driverId: req.params.id,
          scheduledStart: { gte: today, lt: tomorrow },
          status: { not: 'CANCELLED' }
        },
        include: {
          order: {
            include: { customer: { select: { firstName: true, lastName: true, phone: true } } }
          },
          address: true
        },
        orderBy: { scheduledStart: 'asc' }
      }),
      prisma.delivery.findMany({
        where: {
          driverId: req.params.id,
          scheduledStart: { gte: today, lt: tomorrow },
          status: { not: 'CANCELLED' }
        },
        include: {
          order: {
            include: { customer: { select: { firstName: true, lastName: true, phone: true } } }
          },
          address: true
        },
        orderBy: { scheduledStart: 'asc' }
      })
    ]);

    res.json({ pickups, deliveries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete driver
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.driver.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Driver deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
