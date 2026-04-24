const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Parser } = require('json2csv');

const router = express.Router();
const prisma = new PrismaClient();

// Get all staff
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { role, locationId, active = true } = req.query;
    const sortBy = req.query.sortBy || 'firstName';
    const sortOrder = req.query.sortOrder || 'desc';

    const where = {};
    if (role) where.role = role;
    if (locationId) where.locationId = locationId;
    if (active === 'true') where.isActive = true;

    const staff = await prisma.staff.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        location: true
      },
      orderBy: { [sortBy]: sortOrder }
    });

    if (req.query.format === 'csv') {
      const parser = new Parser();
      const csv = parser.parse(staff);
      res.header('Content-Type', 'text/csv');
      res.attachment('staff.csv');
      return res.send(csv);
    }

    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete staff
router.delete('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.staff.deleteMany({ where: { id: { in: ids } } });
    res.json({ message: `${result.count} items deleted`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update staff
router.patch('/bulk', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { ids, data } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }
    const result = await prisma.staff.updateMany({ where: { id: { in: ids } }, data });
    res.json({ message: `${result.count} items updated`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get staff by ID
router.get('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        location: true
      }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }

    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create staff
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { email, phone, firstName, lastName, password, role, locationId } = req.body;

    const existingStaff = await prisma.staff.findUnique({ where: { email } });
    if (existingStaff) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const staff = await prisma.staff.create({
      data: { email, phone, firstName, lastName, passwordHash, role, locationId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        location: true
      }
    });

    res.status(201).json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update staff
router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { phone, firstName, lastName, role, locationId, isActive } = req.body;

    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { phone, firstName, lastName, role, locationId, isActive },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        location: true
      }
    });

    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset staff password
router.post('/:id/reset-password', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { newPassword } = req.body;

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.staff.update({
      where: { id: req.params.id },
      data: { passwordHash }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate staff
router.post('/:id/deactivate', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.staff.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Staff deactivated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activate staff
router.post('/:id/activate', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.staff.update({
      where: { id: req.params.id },
      data: { isActive: true }
    });

    res.json({ message: 'Staff activated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get staff roles
router.get('/meta/roles', async (req, res) => {
  try {
    const roles = ['ADMIN', 'MANAGER', 'CLERK', 'PRESSER', 'CLEANER'];
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
