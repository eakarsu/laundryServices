const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get order tracking history
router.get('/order/:orderId', optionalAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        customer: {
          select: { firstName: true, lastName: true }
        },
        pickup: {
          include: {
            driver: { select: { firstName: true, lastName: true, phone: true } },
            address: true
          }
        },
        delivery: {
          include: {
            driver: { select: { firstName: true, lastName: true, phone: true, currentLat: true, currentLng: true } },
            address: true
          }
        },
        trackingHistory: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate estimated delivery time
    let estimatedDelivery = null;
    if (order.delivery && order.status === 'OUT_FOR_DELIVERY') {
      // Simple estimate: 30 minutes from now if out for delivery
      estimatedDelivery = new Date(Date.now() + 30 * 60 * 1000);
    }

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: order.customer,
      pickup: order.pickup ? {
        scheduledStart: order.pickup.scheduledStart,
        scheduledEnd: order.pickup.scheduledEnd,
        actualTime: order.pickup.actualTime,
        status: order.pickup.status,
        driver: order.pickup.driver,
        address: order.pickup.address
      } : null,
      delivery: order.delivery ? {
        scheduledStart: order.delivery.scheduledStart,
        scheduledEnd: order.delivery.scheduledEnd,
        actualTime: order.delivery.actualTime,
        status: order.delivery.status,
        driver: order.delivery.driver,
        address: order.delivery.address,
        driverLocation: order.delivery.driver ? {
          lat: order.delivery.driver.currentLat,
          lng: order.delivery.driver.currentLng
        } : null
      } : null,
      estimatedDelivery,
      trackingHistory: order.trackingHistory,
      timeline: generateTimeline(order)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track order by order number (public endpoint)
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: {
        customer: {
          select: { firstName: true, lastName: true }
        },
        pickup: {
          include: {
            driver: { select: { firstName: true, lastName: true, phone: true } },
            address: true
          }
        },
        delivery: {
          include: {
            driver: { select: { firstName: true, lastName: true, phone: true, currentLat: true, currentLng: true } },
            address: true
          }
        },
        trackingHistory: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate estimated delivery time
    let estimatedDelivery = null;
    if (order.delivery && order.status === 'OUT_FOR_DELIVERY') {
      estimatedDelivery = new Date(Date.now() + 30 * 60 * 1000);
    }

    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: order.customer,
      estimatedReady: order.estimatedReady,
      estimatedDelivery,
      pickup: order.pickup ? {
        scheduledStart: order.pickup.scheduledStart,
        scheduledEnd: order.pickup.scheduledEnd,
        actualTime: order.pickup.actualTime,
        status: order.pickup.status,
        driver: order.pickup.driver,
        address: order.pickup.address
      } : null,
      delivery: order.delivery ? {
        scheduledStart: order.delivery.scheduledStart,
        scheduledEnd: order.delivery.scheduledEnd,
        actualTime: order.delivery.actualTime,
        status: order.delivery.status,
        driver: order.delivery.driver,
        address: order.delivery.address,
        driverLocation: order.delivery.driver ? {
          lat: order.delivery.driver.currentLat,
          lng: order.delivery.driver.currentLng
        } : null
      } : null,
      trackingHistory: order.trackingHistory,
      timeline: generateTimeline(order)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver's current location
router.get('/driver/:driverId/location', authenticateToken, async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.driverId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        currentLat: true,
        currentLng: true,
        isAvailable: true
      }
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get recent location history
    const locationHistory = await prisma.driverLocation.findMany({
      where: { driverId: req.params.driverId },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    res.json({
      driver,
      currentLocation: driver.currentLat && driver.currentLng ? {
        lat: driver.currentLat,
        lng: driver.currentLng
      } : null,
      locationHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver location (for driver app)
router.post('/driver/:driverId/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, heading, speed, accuracy, batteryLevel } = req.body;

    // Update driver's current position
    await prisma.driver.update({
      where: { id: req.params.driverId },
      data: {
        currentLat: latitude,
        currentLng: longitude
      }
    });

    // Save to location history
    const location = await prisma.driverLocation.create({
      data: {
        driverId: req.params.driverId,
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
      io.to(`driver:${req.params.driverId}`).emit('driver:location:update', {
        driverId: req.params.driverId,
        latitude,
        longitude,
        heading,
        speed,
        timestamp: new Date()
      });
    }

    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get route tracking with all stops
router.get('/route/:routeId', authenticateToken, async (req, res) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: req.params.routeId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            currentLat: true,
            currentLng: true
          }
        },
        pickups: {
          include: {
            address: true,
            order: { select: { orderNumber: true, customer: { select: { firstName: true, lastName: true } } } }
          }
        },
        deliveries: {
          include: {
            address: true,
            order: { select: { orderNumber: true, customer: { select: { firstName: true, lastName: true } } } }
          }
        }
      }
    });

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    // Combine pickups and deliveries into stops
    const stops = [
      ...route.pickups.map(p => ({
        type: 'PICKUP',
        id: p.id,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        customer: p.order.customer,
        address: p.address,
        scheduledTime: p.scheduledStart,
        actualTime: p.actualTime,
        status: p.status
      })),
      ...route.deliveries.map(d => ({
        type: 'DELIVERY',
        id: d.id,
        orderId: d.orderId,
        orderNumber: d.order.orderNumber,
        customer: d.order.customer,
        address: d.address,
        scheduledTime: d.scheduledStart,
        actualTime: d.actualTime,
        status: d.status
      }))
    ];

    // Sort by optimized order if available
    if (route.optimizedOrder) {
      try {
        const optimizedIds = JSON.parse(route.optimizedOrder);
        stops.sort((a, b) => {
          const aIndex = optimizedIds.indexOf(a.id);
          const bIndex = optimizedIds.indexOf(b.id);
          return aIndex - bIndex;
        });
      } catch (e) {
        // If parsing fails, sort by scheduled time
        stops.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
      }
    }

    res.json({
      route: {
        id: route.id,
        date: route.date,
        status: route.status,
        startTime: route.startTime,
        endTime: route.endTime,
        totalDistance: route.totalDistance,
        totalStops: route.totalStops
      },
      driver: route.driver,
      driverLocation: route.driver.currentLat && route.driver.currentLng ? {
        lat: route.driver.currentLat,
        lng: route.driver.currentLng
      } : null,
      stops,
      completedStops: stops.filter(s => s.status === 'COMPLETED' || s.status === 'DELIVERED').length,
      pendingStops: stops.filter(s => s.status === 'SCHEDULED' || s.status === 'EN_ROUTE').length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add tracking event to order
router.post('/order/:orderId/event', authenticateToken, async (req, res) => {
  try {
    const { status, note, latitude, longitude } = req.body;

    const tracking = await prisma.orderTracking.create({
      data: {
        orderId: req.params.orderId,
        status,
        note,
        latitude,
        longitude
      }
    });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`order:${req.params.orderId}`).emit('order:tracking:update', tracking);
    }

    res.status(201).json(tracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate timeline
function generateTimeline(order) {
  const timeline = [];

  // Order created
  timeline.push({
    status: 'ORDER_CREATED',
    title: 'Order Created',
    description: `Order ${order.orderNumber} was placed`,
    timestamp: order.createdAt,
    completed: true
  });

  // Pickup scheduled
  if (order.pickup) {
    timeline.push({
      status: 'PICKUP_SCHEDULED',
      title: 'Pickup Scheduled',
      description: `Scheduled for ${new Date(order.pickup.scheduledStart).toLocaleString()}`,
      timestamp: order.pickup.createdAt,
      completed: true
    });

    if (order.pickup.status === 'COMPLETED') {
      timeline.push({
        status: 'PICKED_UP',
        title: 'Picked Up',
        description: order.pickup.driver ? `Picked up by ${order.pickup.driver.firstName}` : 'Items picked up',
        timestamp: order.pickup.actualTime,
        completed: true
      });
    }
  }

  // Processing stages
  const processingStages = ['PROCESSING', 'CLEANING', 'PRESSING', 'QUALITY_CHECK', 'READY'];
  const stageIndex = processingStages.indexOf(order.status);

  processingStages.forEach((stage, index) => {
    timeline.push({
      status: stage,
      title: stage.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      description: getStageDescription(stage),
      completed: stageIndex >= index || ['DELIVERED', 'COMPLETED'].includes(order.status)
    });
  });

  // Delivery
  if (order.delivery) {
    timeline.push({
      status: 'OUT_FOR_DELIVERY',
      title: 'Out for Delivery',
      description: order.delivery.driver ? `Driver: ${order.delivery.driver.firstName}` : 'On the way',
      completed: ['OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(order.status)
    });

    timeline.push({
      status: 'DELIVERED',
      title: 'Delivered',
      description: 'Order delivered successfully',
      timestamp: order.delivery.actualTime,
      completed: ['DELIVERED', 'COMPLETED'].includes(order.status)
    });
  }

  return timeline;
}

function getStageDescription(stage) {
  const descriptions = {
    'PROCESSING': 'Order is being processed',
    'CLEANING': 'Items are being cleaned',
    'PRESSING': 'Items are being pressed',
    'QUALITY_CHECK': 'Final quality inspection',
    'READY': 'Ready for pickup or delivery'
  };
  return descriptions[stage] || '';
}

module.exports = router;
