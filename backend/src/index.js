const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { disconnectAuthPrisma, getJwtSecret, resolveIdentity, verifyToken } = require('./middleware/auth');

// Authentication never falls back to a built-in key, including in development.
getJwtSecret();

// Env-driven CORS allowlist. CORS_ORIGINS is comma-separated, e.g.
// CORS_ORIGINS=https://app.example.com,https://staging.example.com
// Defaults to common local-dev origins.
const corsOriginsEnv =
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173';
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS is required in production');
}
const allowedOrigins = corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean);
if (!allowedOrigins.length || allowedOrigins.includes('*')) {
  throw new Error('CORS_ORIGINS must contain explicit origins; wildcard CORS is not allowed');
}
const legacyFeaturesEnabled = process.env.NODE_ENV !== 'production' && process.env.ENABLE_LEGACY_ROUTES === 'true';
const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no Origin (curl, mobile apps).
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    const error = new Error(`CORS: origin ${origin} not allowed`);
    error.status = 403;
    return cb(error);
  },
  credentials: true,
};

const authRoutes = require('./routes/auth');
const damageClaimRoutes = require('./routes/damageClaims');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time features (uses same allowlist as Express CORS)
const io = legacyFeaturesEnabled ? new (require('socket.io').Server)(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
}) : null;

// Make io accessible to routes
app.set('io', io);

app.use(cors(corsOptions));
app.use(express.json({ limit: '8mb' }));
// Twilio inbound webhooks deliver application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Security headers
app.use(helmet());

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later' }
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', timestamp: new Date().toISOString(), governedClaims: true, legacyFeaturesEnabled });
  } catch (_error) {
    res.status(503).json({ status: 'not_ready', governedClaims: true });
  }
});

// Routes
const governedAuthRoutes = new Set(['POST /staff/login', 'POST /login', 'GET /me', 'POST /change-password', 'POST /logout']);
app.use('/api/auth', (req, res, next) => {
  if (legacyFeaturesEnabled || governedAuthRoutes.has(`${req.method} ${req.path}`)) return next();
  return res.status(404).json({ error: 'NOT_FOUND' });
}, authRoutes);
app.use('/api/damage-claims', damageClaimRoutes);
if (legacyFeaturesEnabled) {
  app.use('/api/customers', require('./routes/customers'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/services', require('./routes/services'));
  app.use('/api/garments', require('./routes/garments'));
  app.use('/api/drivers', require('./routes/drivers'));
  app.use('/api/routes', require('./routes/routes'));
  app.use('/api/pricing', require('./routes/pricing'));
  app.use('/api/machines', require('./routes/machines'));
  app.use('/api/locations', require('./routes/locations'));
  app.use('/api/payments', require('./routes/payments'));
  app.use('/api/reports', require('./routes/reports'));
  app.use('/api/ai', require('./routes/ai'));
  app.use('/api/subscriptions', require('./routes/subscriptions'));
  app.use('/api/coupons', require('./routes/coupons'));
  app.use('/api/gift-cards', require('./routes/giftCards'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/staff', require('./routes/staff'));
  app.use('/api/lockers', require('./routes/lockers'));
  app.use('/api/alterations', require('./routes/alterations'));
  app.use('/api/quality-issues', require('./routes/qualityIssues'));
  app.use('/api/tracking', require('./routes/tracking'));
  app.use('/api/driver-mobile', require('./routes/driverMobile'));
  app.use('/api/custom-views', require('./routes/customViews'));
  app.use('/api/lint-filter-compliance', require('./routes/lintFilterCompliance'));
  app.use('/api/garment-damage-vision', require('./routes/garmentDamageVision'));
  app.use('/api/subscription-optimization', require('./routes/subscriptionOptimization'));
  app.use('/api/fabric-care', require('./routes/fabricCareAdvisor'));
  app.use('/api/driver-earnings', require('./routes/driverEarnings'));
  app.use('/api/corporate-b2b', require('./routes/corporateB2B'));
  app.use('/api/sustainability', require('./routes/sustainabilityDashboard'));
}

// ── Haversine formula ────────────────────────────────────────────────────────
// Returns distance in meters between two lat/lng coordinates.
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const ARRIVAL_THRESHOLD_METERS = 200;

// ── Socket.IO JWT middleware ─────────────────────────────────────────────────
if (legacyFeaturesEnabled) io.use(async (socket, next) => {
  // Allow unauthenticated connections from the browser tracking UI;
  // only enforce JWT for driver-originated events (checked per-event below).
  // If a token is present, verify it and attach to the socket.
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(' ')[1];

  if (token) {
    try {
      socket.user = await resolveIdentity(verifyToken(token));
    } catch (err) {
      // Invalid token — connection still allowed for read-only tracking,
      // but driver:location updates will be rejected if no valid user is set.
      socket.user = null;
    }
  } else {
    socket.user = null;
  }

  next();
});

// WebSocket connection handling
if (legacyFeaturesEnabled) io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} user=${socket.user?.id || 'anonymous'}`);

  // Join room for order tracking
  socket.on('track:order', (orderId) => {
    socket.join(`order:${orderId}`);
    console.log(`👀 Client ${socket.id} tracking order: ${orderId}`);
  });

  // Join room for driver tracking
  socket.on('track:driver', (driverId) => {
    socket.join(`driver:${driverId}`);
    console.log(`👀 Client ${socket.id} tracking driver: ${driverId}`);
  });

  // Join room for route tracking
  socket.on('track:route', (routeId) => {
    socket.join(`route:${routeId}`);
    console.log(`👀 Client ${socket.id} tracking route: ${routeId}`);
  });

  // Driver location update (requires authenticated driver)
  socket.on('driver:location', async (data) => {
    try {
      const { driverId, latitude, longitude, heading, speed, batteryLevel } = data;

      // JWT enforcement: only a verified driver (or staff) may emit location for a driver
      if (!socket.user) {
        socket.emit('error', { message: 'Authentication required to emit driver:location' });
        return;
      }

      // A driver may only update their own location; staff/admin may update any
      const isDriver = socket.user.type === 'driver';
      if (isDriver && socket.user.id !== driverId) {
        socket.emit('error', { message: 'Drivers may only update their own location' });
        return;
      }

      // Update driver's current location in database
      await prisma.driver.update({
        where: { id: driverId },
        data: { currentLat: latitude, currentLng: longitude }
      });

      // Save to location history
      await prisma.driverLocation.create({
        data: {
          driverId,
          latitude,
          longitude,
          heading,
          speed,
          batteryLevel
        }
      });

      // Broadcast to all clients tracking this driver
      io.to(`driver:${driverId}`).emit('driver:location:update', {
        driverId,
        latitude,
        longitude,
        heading,
        speed,
        batteryLevel,
        timestamp: new Date()
      });

      console.log(`📍 Driver ${driverId} location updated: ${latitude}, ${longitude}`);

      // ── Geofencing: check proximity to active pickup/delivery addresses ──
      try {
        // Find active pickup assigned to this driver
        const activePickup = await prisma.pickup.findFirst({
          where: {
            driverId,
            status: { in: ['SCHEDULED', 'EN_ROUTE'] }
          },
          include: { address: true, order: true }
        });

        if (activePickup?.address?.latitude && activePickup?.address?.longitude) {
          const distance = haversineDistance(
            latitude, longitude,
            activePickup.address.latitude,
            activePickup.address.longitude
          );

          if (distance <= ARRIVAL_THRESHOLD_METERS && activePickup.status !== 'ARRIVED') {
            // Update pickup status to ARRIVED
            await prisma.pickup.update({
              where: { id: activePickup.id },
              data: { status: 'ARRIVED', actualTime: new Date() }
            });

            // Emit arrival event to the order room
            io.to(`order:${activePickup.orderId}`).emit('driver:arrived', {
              driverId,
              orderId: activePickup.orderId,
              type: 'pickup',
              latitude,
              longitude,
              distanceMeters: Math.round(distance),
              timestamp: new Date()
            });

            console.log(`🏠 Driver ${driverId} arrived at pickup for order ${activePickup.orderId} (${Math.round(distance)}m)`);
          }
        }

        // Find active delivery assigned to this driver
        const activeDelivery = await prisma.delivery.findFirst({
          where: {
            driverId,
            status: { in: ['SCHEDULED', 'EN_ROUTE'] }
          },
          include: { address: true, order: true }
        });

        if (activeDelivery?.address?.latitude && activeDelivery?.address?.longitude) {
          const distance = haversineDistance(
            latitude, longitude,
            activeDelivery.address.latitude,
            activeDelivery.address.longitude
          );

          if (distance <= ARRIVAL_THRESHOLD_METERS && activeDelivery.status !== 'ARRIVED') {
            // Update delivery status to ARRIVED and order status to OUT_FOR_DELIVERY → ARRIVED isn't an order status
            await prisma.delivery.update({
              where: { id: activeDelivery.id },
              data: { status: 'ARRIVED', actualTime: new Date() }
            });

            // Emit arrival event to the order room
            io.to(`order:${activeDelivery.orderId}`).emit('driver:arrived', {
              driverId,
              orderId: activeDelivery.orderId,
              type: 'delivery',
              latitude,
              longitude,
              distanceMeters: Math.round(distance),
              timestamp: new Date()
            });

            console.log(`🏠 Driver ${driverId} arrived at delivery for order ${activeDelivery.orderId} (${Math.round(distance)}m)`);
          }
        }
      } catch (geoError) {
        console.error('Geofencing check error:', geoError.message);
        // Don't fail the whole location update for a geofence error
      }
    } catch (error) {
      console.error('Error updating driver location:', error);
    }
  });

  // Order status update event
  socket.on('order:status', async (data) => {
    try {
      const { orderId, status, note, latitude, longitude } = data;

      // Save tracking event
      await prisma.orderTracking.create({
        data: {
          orderId,
          status,
          note,
          latitude,
          longitude
        }
      });

      // Broadcast to all clients tracking this order
      io.to(`order:${orderId}`).emit('order:status:update', {
        orderId,
        status,
        note,
        latitude,
        longitude,
        timestamp: new Date()
      });

      console.log(`📦 Order ${orderId} status updated: ${status}`);
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  });

  // Leave rooms
  socket.on('untrack:order', (orderId) => {
    socket.leave(`order:${orderId}`);
  });

  socket.on('untrack:driver', (driverId) => {
    socket.leave(`driver:${driverId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Helper function to emit order updates (can be called from routes)
app.emitOrderUpdate = (orderId, data) => {
  io?.to(`order:${orderId}`).emit('order:update', data);
};

app.emitDriverUpdate = (driverId, data) => {
  io?.to(`driver:${driverId}`).emit('driver:update', data);
};

app.emitRouteUpdate = (routeId, data) => {
  io?.to(`route:${routeId}`).emit('route:update', data);
};

// Global broadcast for dashboard updates
app.emitDashboardUpdate = (data) => {
  io?.emit('dashboard:update', data);
};

app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));

if (process.env.STATIC_DIR) {
  const staticDirectory = path.resolve(process.env.STATIC_DIR);
  app.use(express.static(staticDirectory, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(staticDirectory, 'index.html')));
}

// Error handling middleware
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err.stack);
  res.status(status).json({ error: status === 403 ? 'ORIGIN_FORBIDDEN' : 'INTERNAL_ERROR', message: 'Request failed' });
});

const PORT = Number(process.env.PORT);
const BACKEND_HOST = process.env.BACKEND_HOST;
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535 || BACKEND_HOST !== '127.0.0.1') {
  throw new Error('PORT and BACKEND_HOST=127.0.0.1 must be explicitly assigned');
}

function start() {
  return server.listen(PORT, BACKEND_HOST, () => {
    console.log(`Laundry claims API listening on http://${BACKEND_HOST}:${PORT}`);
    console.log(`Legacy routes enabled: ${legacyFeaturesEnabled}`);
  });
}

if (require.main === module) start();

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Shutting down after ${signal}`);
  await Promise.allSettled([
    prisma.$disconnect(), authRoutes.close(), damageClaimRoutes.close(), disconnectAuthPrisma(),
  ]);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, prisma, io, server, start };

// === Batch 10 Gaps & Frontend Mounts === (mounts)
