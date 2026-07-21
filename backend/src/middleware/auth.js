const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32 || ['secret', 'changeme'].includes(s.toLowerCase())) {
    throw new Error('JWT_SECRET must be set to at least 32 non-default characters');
  }
  return s;
}

function jwtOptions() {
  return {
    algorithms: ['HS256'],
    issuer: process.env.JWT_ISSUER || 'laundry-services',
    audience: process.env.JWT_AUDIENCE || 'laundry-services-api',
  };
}

function signToken(payload, expiresIn) {
  const options = jwtOptions();
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    issuer: options.issuer,
    audience: options.audience,
    expiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret(), jwtOptions());
}

async function resolveIdentity(claims) {
  if (!claims?.id || !claims?.type || !Number.isInteger(claims.ver)) return null;
  let user;
  if (claims.type === 'customer') {
    user = await prisma.customer.findUnique({ where: { id: claims.id }, select: { id: true, email: true, isActive: true, authVersion: true } });
  } else if (claims.type === 'staff') {
    user = await prisma.staff.findUnique({ where: { id: claims.id }, select: { id: true, email: true, role: true, isActive: true, authVersion: true } });
  } else if (claims.type === 'driver') {
    user = await prisma.driver.findUnique({ where: { id: claims.id }, select: { id: true, email: true, isActive: true, authVersion: true } });
  }
  if (!user?.isActive || user.authVersion !== claims.ver) return null;
  return { id: user.id, email: user.email, role: user.role, type: claims.type, ver: user.authVersion };
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const claims = verifyToken(token);
    const user = await resolveIdentity(claims);
    if (!user) return res.status(401).json({ error: 'Session has been revoked' });
    req.user = user;
    return next();
  } catch (_error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = await resolveIdentity(verifyToken(token));
      if (user) req.user = user;
    } catch (_error) {
      // Optional authentication deliberately continues without an identity.
    }
  }
  return next();
};

const disconnectAuthPrisma = () => prisma.$disconnect();

module.exports = { authenticateToken, authorizeRoles, optionalAuth, getJwtSecret, jwtOptions, resolveIdentity, signToken, verifyToken, disconnectAuthPrisma };
