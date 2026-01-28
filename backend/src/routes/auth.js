const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Customer Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    const existingCustomer = await prisma.customer.findUnique({ where: { email } });
    if (existingCustomer) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const customer = await prisma.customer.create({
      data: { email, passwordHash, firstName, lastName, phone }
    });

    const token = jwt.sign(
      { id: customer.id, email: customer.email, type: 'customer' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        type: 'customer'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, customer.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: customer.id, email: customer.email, type: 'customer' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        type: 'customer'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Staff Login
router.post('/staff/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await prisma.staff.findUnique({
      where: { email },
      include: { location: true }
    });
    if (!staff) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, staff.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLogin: new Date() }
    });

    const token = jwt.sign(
      { id: staff.id, email: staff.email, role: staff.role, type: 'staff' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: staff.id,
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role,
        location: staff.location,
        type: 'staff'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Driver Login
router.post('/driver/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const driver = await prisma.driver.findUnique({ where: { email } });
    if (!driver) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, driver.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: driver.id, email: driver.email, type: 'driver' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: driver.id,
        email: driver.email,
        firstName: driver.firstName,
        lastName: driver.lastName,
        type: 'driver'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    let user;
    if (req.user.type === 'customer') {
      user = await prisma.customer.findUnique({
        where: { id: req.user.id },
        include: { addresses: true, paymentMethods: true }
      });
    } else if (req.user.type === 'staff') {
      user = await prisma.staff.findUnique({
        where: { id: req.user.id },
        include: { location: true }
      });
    } else if (req.user.type === 'driver') {
      user = await prisma.driver.findUnique({
        where: { id: req.user.id }
      });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...userData } = user;
    res.json({ ...userData, type: req.user.type });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    let user;
    if (req.user.type === 'customer') {
      user = await prisma.customer.findUnique({ where: { id: req.user.id } });
    } else if (req.user.type === 'staff') {
      user = await prisma.staff.findUnique({ where: { id: req.user.id } });
    } else if (req.user.type === 'driver') {
      user = await prisma.driver.findUnique({ where: { id: req.user.id } });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    if (req.user.type === 'customer') {
      await prisma.customer.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash }
      });
    } else if (req.user.type === 'staff') {
      await prisma.staff.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash }
      });
    } else if (req.user.type === 'driver') {
      await prisma.driver.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash }
      });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
