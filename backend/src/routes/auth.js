const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, signToken } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();
const internalError = (res, error) => {
  console.error('authentication route failed', error.message);
  return res.status(500).json({ error: 'INTERNAL_ERROR' });
};

// Password strength validation
const validatePassword = (password) => {
  const errors = [];
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain a special character');
  return errors;
};

// Customer Registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    const existingCustomer = await prisma.customer.findUnique({ where: { email } });
    if (existingCustomer) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password too weak', details: passwordErrors });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const customer = await prisma.customer.create({
      data: { email, passwordHash, firstName, lastName, phone, emailVerified: false, verificationToken }
    });

    const token = signToken({ id: customer.id, email: customer.email, type: 'customer', ver: customer.authVersion }, '12h');

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
    internalError(res, error);
  }
});

// Customer Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer || !customer.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, customer.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ id: customer.id, email: customer.email, type: 'customer', ver: customer.authVersion }, '12h');

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
    internalError(res, error);
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
    if (!staff || !staff.isActive) {
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

    const token = signToken({ id: staff.id, email: staff.email, role: staff.role, type: 'staff', ver: staff.authVersion }, '12h');

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
    internalError(res, error);
  }
});

// Driver Login
router.post('/driver/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const driver = await prisma.driver.findUnique({ where: { email } });
    if (!driver || !driver.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, driver.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ id: driver.id, email: driver.email, type: 'driver', ver: driver.authVersion }, '12h');

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
    internalError(res, error);
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
    internalError(res, error);
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

    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password too weak', details: passwordErrors });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    if (req.user.type === 'customer') {
      await prisma.customer.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash, authVersion: { increment: 1 } }
      });
    } else if (req.user.type === 'staff') {
      await prisma.staff.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash, authVersion: { increment: 1 } }
      });
    } else if (req.user.type === 'driver') {
      await prisma.driver.update({
        where: { id: req.user.id },
        data: { passwordHash: newPasswordHash, authVersion: { increment: 1 } }
      });
    }

    res.json({ message: 'Password changed successfully; sign in again' });
  } catch (error) {
    internalError(res, error);
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    internalError(res, error);
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if customer exists
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      // Don't reveal if email exists
      return res.json({ message: 'If an account exists with this email, a reset link has been sent' });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.create({
      data: { email, token, expiresAt }
    });

    // In production, send email here
    res.json({ message: 'If an account exists with this email, a reset link has been sent' });
  } catch (error) {
    internalError(res, error);
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password too weak', details: passwordErrors });
    }

    const resetRecord = await prisma.passwordReset.findUnique({ where: { token } });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.customer.update({
      where: { email: resetRecord.email },
      data: { passwordHash }
    });

    await prisma.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    internalError(res, error);
  }
});

// Verify Email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const customer = await prisma.customer.findFirst({
      where: { verificationToken: token }
    });

    if (!customer) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { emailVerified: true, verificationToken: null }
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    internalError(res, error);
  }
});

// Resend Verification Email
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    if (req.user.type !== 'customer') {
      return res.status(400).json({ error: 'Only customers can verify email' });
    }

    const customer = await prisma.customer.findUnique({ where: { id: req.user.id } });

    if (customer.emailVerified) {
      return res.json({ message: 'Email already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');

    await prisma.customer.update({
      where: { id: req.user.id },
      data: { verificationToken }
    });

    // In production, send verification email here
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    internalError(res, error);
  }
});

router.close = () => prisma.$disconnect();

module.exports = router;
