const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./middleware/auth');

// Env-driven CORS allowlist. CORS_ORIGINS is comma-separated, e.g.
// CORS_ORIGINS=https://app.example.com,https://staging.example.com
// Defaults to common local-dev origins.
const corsOriginsEnv =
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173';
const allowedOrigins = corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no Origin (curl, mobile apps).
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return cb(null, true);
    }
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
};

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const orderRoutes = require('./routes/orders');
const serviceRoutes = require('./routes/services');
const garmentRoutes = require('./routes/garments');
const driverRoutes = require('./routes/drivers');
const routeRoutes = require('./routes/routes');
const pricingRoutes = require('./routes/pricing');
const machineRoutes = require('./routes/machines');
const locationRoutes = require('./routes/locations');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const aiRoutes = require('./routes/ai');
const subscriptionRoutes = require('./routes/subscriptions');
const couponRoutes = require('./routes/coupons');
const giftCardRoutes = require('./routes/giftCards');
const notificationRoutes = require('./routes/notifications');
const staffRoutes = require('./routes/staff');
const lockerRoutes = require('./routes/lockers');
const alterationRoutes = require('./routes/alterations');
const qualityIssueRoutes = require('./routes/qualityIssues');
const trackingRoutes = require('./routes/tracking');
const driverMobileRoutes = require('./routes/driverMobile');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time features (uses same allowlist as Express CORS)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
// Twilio inbound webhooks deliver application/x-www-form-urlencoded.
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), websocket: true });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/garments', garmentRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/gift-cards', giftCardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/lockers', lockerRoutes);
app.use('/api/alterations', alterationRoutes);
app.use('/api/quality-issues', qualityIssueRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/driver-mobile', driverMobileRoutes);
app.use('/api/garment-damage-vision', require('./routes/garmentDamageVision')); app.use('/api/subscription-optimization', require('./routes/subscriptionOptimization')); app.use('/api/fabric-care', require('./routes/fabricCareAdvisor')); app.use('/api/driver-earnings', require('./routes/driverEarnings')); app.use('/api/corporate-b2b', require('./routes/corporateB2B')); app.use('/api/sustainability', require('./routes/sustainabilityDashboard'));

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
io.use((socket, next) => {
  // Allow unauthenticated connections from the browser tracking UI;
  // only enforce JWT for driver-originated events (checked per-event below).
  // If a token is present, verify it and attach to the socket.
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      socket.user = decoded;
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
io.on('connection', (socket) => {
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
  io.to(`order:${orderId}`).emit('order:update', data);
};

app.emitDriverUpdate = (driverId, data) => {
  io.to(`driver:${driverId}`).emit('driver:update', data);
};

app.emitRouteUpdate = (routeId, data) => {
  io.to(`route:${routeId}`).emit('route:update', data);
};

// Global broadcast for dashboard updates
app.emitDashboardUpdate = (data) => {
  io.emit('dashboard:update', data);
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  server.close();
  process.exit(0);
});

module.exports = { app, prisma, io };

// === Batch 10 Gaps & Frontend Mounts === (mounts)
app.use('/api/gap-no-automated-damage-loss-claim-adjudication', require('./routes/gap_no_automated_damage_loss_claim_adjudication'));
app.use('/api/gap-no-fabric-care-compliance-ai-per', require('./routes/gap_no_fabric_care_compliance_ai_per'));
app.use('/api/gap-no-subscription-personalization-preferences-schedule-auto', require('./routes/gap_no_subscription_personalization_preferences_schedule_auto'));
app.use('/api/gap-no-environmental-sustainability-tracking-ai', require('./routes/gap_no_environmental_sustainability_tracking_ai'));
app.use('/api/gap-no-b2b-corporate-account-agent', require('./routes/gap_no_b2b_corporate_account_agent'));
app.use('/api/gap-no-driver-earnings-optimization-ai', require('./routes/gap_no_driver_earnings_optimization_ai'));
app.use('/api/gap-no-laundromat-partner-network-management', require('./routes/gap_no_laundromat_partner_network_management'));
app.use('/api/gap-no-corporate-b2b-bulk-order-portal', require('./routes/gap_no_corporate_b2b_bulk_order_portal'));
app.use('/api/gap-no-environmental-dashboard-water-chemical-usage', require('./routes/gap_no_environmental_dashboard_water_chemical_usage'));
app.use('/api/gap-no-equipment-supplier-marketplace', require('./routes/gap_no_equipment_supplier_marketplace'));
app.use('/api/gap-no-referral-program-engine', require('./routes/gap_no_referral_program_engine'));
app.use('/api/gap-no-insurance-guarantee-policies-module', require('./routes/gap_no_insurance_guarantee_policies_module'));
