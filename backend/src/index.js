const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

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

// Socket.IO setup for real-time features
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

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

  // Driver location update
  socket.on('driver:location', async (data) => {
    try {
      const { driverId, latitude, longitude, heading, speed, batteryLevel } = data;

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
