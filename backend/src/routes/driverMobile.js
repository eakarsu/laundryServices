const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get driver's active route for today
router.get('/my-route', authenticateToken, async (req, res) => {
  try {
    console.log('Driver my-route request - user:', req.user);

    // First, find the driver by email to get correct ID
    let driverId = req.user.id;
    if (req.user.email) {
      const driver = await prisma.driver.findUnique({
        where: { email: req.user.email }
      });
      if (driver) {
        driverId = driver.id;
        console.log('Found driver by email:', driver.email, 'ID:', driver.id);
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Looking for routes between', today, 'and', tomorrow, 'for driver:', driverId);

    const route = await prisma.route.findFirst({
      where: {
        driverId: driverId,
        date: { gte: today, lt: tomorrow },
        status: { in: ['PLANNED', 'IN_PROGRESS'] }
      },
      include: {
        pickups: {
          include: {
            address: true,
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, phone: true } },
                items: { include: { garmentType: true, service: true } }
              }
            }
          },
          orderBy: { scheduledStart: 'asc' }
        },
        deliveries: {
          include: {
            address: true,
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, phone: true } },
                items: { include: { garmentType: true, service: true } }
              }
            }
          },
          orderBy: { scheduledStart: 'asc' }
        }
      }
    });

    if (!route) {
      console.log('No route found for driver:', req.user.id);
      return res.json({ message: 'No active route for today', route: null });
    }

    console.log('Found route:', route.id, 'with', route.pickups?.length, 'pickups');

    // Combine and sort stops
    const stops = [
      ...route.pickups.map(p => ({
        type: 'PICKUP',
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        customer: p.order.customer,
        address: {
          street: p.address.street,
          apartment: p.address.apartment,
          city: p.address.city,
          state: p.address.state,
          zipCode: p.address.zipCode,
          latitude: p.address.latitude,
          longitude: p.address.longitude,
          instructions: p.address.instructions
        },
        scheduledTime: p.scheduledStart,
        status: p.status,
        notes: p.notes,
        items: p.order.items
      })),
      ...route.deliveries.map(d => ({
        type: 'DELIVERY',
        id: d.id,
        orderId: d.orderId,
        orderNumber: d.order.orderNumber,
        customer: d.order.customer,
        address: {
          street: d.address.street,
          apartment: d.address.apartment,
          city: d.address.city,
          state: d.address.state,
          zipCode: d.address.zipCode,
          latitude: d.address.latitude,
          longitude: d.address.longitude,
          instructions: d.address.instructions
        },
        scheduledTime: d.scheduledStart,
        status: d.status,
        notes: d.notes,
        items: d.order.items
      }))
    ];

    // Apply optimized order if available
    if (route.optimizedOrder) {
      try {
        const optimizedIds = JSON.parse(route.optimizedOrder);
        stops.sort((a, b) => {
          const aIndex = optimizedIds.indexOf(a.id);
          const bIndex = optimizedIds.indexOf(b.id);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      } catch (e) {
        stops.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
      }
    } else {
      stops.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
    }

    res.json({
      route: {
        id: route.id,
        date: route.date,
        status: route.status,
        totalStops: stops.length,
        completedStops: stops.filter(s => ['COMPLETED', 'DELIVERED'].includes(s.status)).length
      },
      stops
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start route
router.post('/route/:routeId/start', authenticateToken, async (req, res) => {
  try {
    const route = await prisma.route.update({
      where: { id: req.params.routeId },
      data: {
        status: 'IN_PROGRESS',
        startTime: new Date()
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`route:${route.id}`).emit('route:started', route);
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete route
router.post('/route/:routeId/complete', authenticateToken, async (req, res) => {
  try {
    const route = await prisma.route.update({
      where: { id: req.params.routeId },
      data: {
        status: 'COMPLETED',
        endTime: new Date()
      }
    });

    // Update driver availability
    await prisma.driver.update({
      where: { id: route.driverId },
      data: { isAvailable: true }
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`route:${route.id}`).emit('route:completed', route);
    }

    res.json(route);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update pickup status
router.post('/pickup/:pickupId/status', authenticateToken, async (req, res) => {
  try {
    const { status, notes, photoUrl, signature, latitude, longitude } = req.body;

    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (photoUrl) updateData.photoUrl = photoUrl;
    if (signature) updateData.signature = signature;
    if (status === 'COMPLETED') updateData.actualTime = new Date();

    const pickup = await prisma.pickup.update({
      where: { id: req.params.pickupId },
      data: updateData,
      include: {
        order: { select: { id: true, orderNumber: true } }
      }
    });

    // Update order status if picked up
    if (status === 'COMPLETED') {
      await prisma.order.update({
        where: { id: pickup.orderId },
        data: { status: 'PICKED_UP' }
      });

      // Add tracking event
      await prisma.orderTracking.create({
        data: {
          orderId: pickup.orderId,
          status: 'PICKED_UP',
          note: `Picked up by driver`,
          latitude,
          longitude
        }
      });
    }

    // Emit real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`order:${pickup.orderId}`).emit('pickup:status:update', {
        pickupId: pickup.id,
        orderId: pickup.orderId,
        status,
        timestamp: new Date()
      });
    }

    res.json(pickup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update delivery status
router.post('/delivery/:deliveryId/status', authenticateToken, async (req, res) => {
  try {
    const { status, notes, photoUrl, signature, latitude, longitude } = req.body;

    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (photoUrl) updateData.photoUrl = photoUrl;
    if (signature) updateData.signature = signature;
    if (status === 'DELIVERED') updateData.actualTime = new Date();

    const delivery = await prisma.delivery.update({
      where: { id: req.params.deliveryId },
      data: updateData,
      include: {
        order: { select: { id: true, orderNumber: true } }
      }
    });

    // Update order status based on delivery status
    if (status === 'EN_ROUTE') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'OUT_FOR_DELIVERY' }
      });
    } else if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'DELIVERED' }
      });
    }

    // Add tracking event
    await prisma.orderTracking.create({
      data: {
        orderId: delivery.orderId,
        status: status === 'DELIVERED' ? 'DELIVERED' : 'OUT_FOR_DELIVERY',
        note: status === 'DELIVERED' ? 'Order delivered' : 'Driver en route',
        latitude,
        longitude
      }
    });

    // Emit real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`order:${delivery.orderId}`).emit('delivery:status:update', {
        deliveryId: delivery.id,
        orderId: delivery.orderId,
        status,
        timestamp: new Date()
      });
    }

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver location
router.post('/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, heading, speed, accuracy, batteryLevel } = req.body;
    const driverId = req.user.id;

    // Update current location
    await prisma.driver.update({
      where: { id: driverId },
      data: { currentLat: latitude, currentLng: longitude }
    });

    // Save to history
    const location = await prisma.driverLocation.create({
      data: {
        driverId,
        latitude,
        longitude,
        heading,
        speed,
        accuracy,
        batteryLevel
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`driver:${driverId}`).emit('driver:location:update', {
        driverId,
        latitude,
        longitude,
        heading,
        speed,
        timestamp: new Date()
      });
    }

    res.json({ success: true, location });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver's stats for today
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pickupsToday, deliveriesToday, activeRoute] = await Promise.all([
      prisma.pickup.count({
        where: {
          driverId: req.user.id,
          status: 'COMPLETED',
          actualTime: { gte: today }
        }
      }),
      prisma.delivery.count({
        where: {
          driverId: req.user.id,
          status: 'DELIVERED',
          actualTime: { gte: today }
        }
      }),
      prisma.route.findFirst({
        where: {
          driverId: req.user.id,
          status: 'IN_PROGRESS'
        },
        include: {
          pickups: { where: { status: { not: 'COMPLETED' } } },
          deliveries: { where: { status: { not: 'DELIVERED' } } }
        }
      })
    ]);

    res.json({
      pickupsCompleted: pickupsToday,
      deliveriesCompleted: deliveriesToday,
      totalStopsToday: pickupsToday + deliveriesToday,
      pendingPickups: activeRoute?.pickups?.length || 0,
      pendingDeliveries: activeRoute?.deliveries?.length || 0,
      hasActiveRoute: !!activeRoute
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver's history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const routes = await prisma.route.findMany({
      where: {
        driverId: req.user.id,
        date: { gte: startDate }
      },
      include: {
        pickups: { select: { id: true, status: true } },
        deliveries: { select: { id: true, status: true } }
      },
      orderBy: { date: 'desc' }
    });

    const history = routes.map(route => ({
      id: route.id,
      date: route.date,
      status: route.status,
      totalPickups: route.pickups.length,
      completedPickups: route.pickups.filter(p => p.status === 'COMPLETED').length,
      totalDeliveries: route.deliveries.length,
      completedDeliveries: route.deliveries.filter(d => d.status === 'DELIVERED').length,
      totalDistance: route.totalDistance,
      duration: route.startTime && route.endTime
        ? Math.round((new Date(route.endTime) - new Date(route.startTime)) / (1000 * 60))
        : null
    }));

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle driver availability
router.post('/availability', authenticateToken, async (req, res) => {
  try {
    const { isAvailable } = req.body;

    const driver = await prisma.driver.update({
      where: { id: req.user.id },
      data: { isAvailable }
    });

    res.json({ isAvailable: driver.isAvailable });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Report issue from driver
router.post('/report-issue', authenticateToken, async (req, res) => {
  try {
    const { orderId, pickupId, deliveryId, issueType, description, photoUrls } = req.body;

    // Get order details
    let orderDetails = null;
    if (orderId) {
      orderDetails = await prisma.order.findUnique({
        where: { id: orderId },
        select: { customerId: true }
      });
    }

    const issue = await prisma.qualityIssue.create({
      data: {
        orderId,
        customerId: orderDetails?.customerId,
        reportedBy: req.user.id,
        issueType: issueType || 'OTHER',
        severity: 'MEDIUM',
        title: `Driver Reported: ${issueType || 'Issue'}`,
        description,
        photoUrls: photoUrls || []
      }
    });

    res.status(201).json(issue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
