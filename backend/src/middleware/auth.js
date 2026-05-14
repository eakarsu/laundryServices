const jwt = require('jsonwebtoken');

// Fail-fast: don't silently fall back to 'secret' in production.
function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production');
    }
    if (!global.__jwtSecretWarned) {
      console.warn('⚠️  JWT_SECRET not set — using insecure default "secret" for development only');
      global.__jwtSecretWarned = true;
    }
    return 'secret';
  }
  return s;
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, getJwtSecret(), (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
};

module.exports = { authenticateToken, authorizeRoles, optionalAuth, getJwtSecret };
