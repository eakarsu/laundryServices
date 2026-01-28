const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Revenue report
router.get('/revenue', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' }
      },
      select: {
        createdAt: true,
        subtotal: true,
        discount: true,
        tax: true,
        total: true,
        paidAmount: true
      }
    });

    // Group by date
    const grouped = {};
    orders.forEach(order => {
      let key;
      const date = new Date(order.createdAt);
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = { date: key, orders: 0, subtotal: 0, discount: 0, tax: 0, total: 0, collected: 0 };
      }
      grouped[key].orders++;
      grouped[key].subtotal += parseFloat(order.subtotal);
      grouped[key].discount += parseFloat(order.discount);
      grouped[key].tax += parseFloat(order.tax);
      grouped[key].total += parseFloat(order.total);
      grouped[key].collected += parseFloat(order.paidAmount);
    });

    const data = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

    // Summary
    const summary = {
      totalOrders: orders.length,
      totalRevenue: data.reduce((sum, d) => sum + d.total, 0),
      totalCollected: data.reduce((sum, d) => sum + d.collected, 0),
      totalDiscount: data.reduce((sum, d) => sum + d.discount, 0),
      averageOrderValue: orders.length > 0 ? data.reduce((sum, d) => sum + d.total, 0) / orders.length : 0
    };

    res.json({ data, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Order volume report
router.get('/orders', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end }
      },
      select: {
        status: true,
        isRush: true,
        createdAt: true
      }
    });

    // Status breakdown
    const statusCounts = {};
    orders.forEach(order => {
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    // Rush vs regular
    const rushOrders = orders.filter(o => o.isRush).length;

    // Daily volume
    const dailyVolume = {};
    orders.forEach(order => {
      const date = new Date(order.createdAt).toISOString().split('T')[0];
      dailyVolume[date] = (dailyVolume[date] || 0) + 1;
    });

    res.json({
      totalOrders: orders.length,
      statusBreakdown: statusCounts,
      rushOrders,
      regularOrders: orders.length - rushOrders,
      dailyVolume: Object.entries(dailyVolume).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route efficiency report
router.get('/routes', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const routes = await prisma.route.findMany({
      where: {
        date: { gte: start, lte: end }
      },
      include: {
        driver: { select: { firstName: true, lastName: true } },
        pickups: true,
        deliveries: true
      }
    });

    const routeStats = routes.map(route => {
      const completedPickups = route.pickups.filter(p => p.status === 'COMPLETED').length;
      const completedDeliveries = route.deliveries.filter(d => d.status === 'DELIVERED' || d.status === 'IN_LOCKER').length;
      const totalStops = route.pickups.length + route.deliveries.length;
      const completedStops = completedPickups + completedDeliveries;

      return {
        id: route.id,
        date: route.date,
        driver: `${route.driver.firstName} ${route.driver.lastName}`,
        status: route.status,
        totalStops,
        completedStops,
        completionRate: totalStops > 0 ? (completedStops / totalStops * 100).toFixed(1) : 0,
        duration: route.startTime && route.endTime
          ? Math.round((new Date(route.endTime) - new Date(route.startTime)) / (1000 * 60))
          : null
      };
    });

    // Summary
    const completedRoutes = routes.filter(r => r.status === 'COMPLETED').length;
    const avgStopsPerRoute = routes.length > 0 ? routeStats.reduce((sum, r) => sum + r.totalStops, 0) / routes.length : 0;
    const avgCompletionRate = routeStats.length > 0 ? routeStats.reduce((sum, r) => sum + parseFloat(r.completionRate), 0) / routeStats.length : 0;

    res.json({
      routes: routeStats,
      summary: {
        totalRoutes: routes.length,
        completedRoutes,
        averageStopsPerRoute: avgStopsPerRoute.toFixed(1),
        averageCompletionRate: avgCompletionRate.toFixed(1)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Machine utilization report
router.get('/machines', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate, locationId } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const where = {};
    if (locationId) where.locationId = locationId;

    const machines = await prisma.machine.findMany({
      where,
      include: {
        location: true,
        usages: {
          where: { startTime: { gte: start, lte: end } }
        }
      }
    });

    const machineStats = machines.map(machine => {
      const usages = machine.usages;
      const totalCycles = usages.length;
      const completedCycles = usages.filter(u => u.status === 'COMPLETED').length;
      const totalRevenue = usages.reduce((sum, u) => sum + parseFloat(u.amountPaid), 0);

      return {
        id: machine.id,
        machineNumber: machine.machineNumber,
        type: machine.type,
        location: machine.location.name,
        status: machine.status,
        totalCycles,
        completedCycles,
        revenue: totalRevenue,
        utilizationRate: totalCycles > 0 ? (completedCycles / totalCycles * 100).toFixed(1) : 0
      };
    });

    // Summary
    const totalRevenue = machineStats.reduce((sum, m) => sum + m.revenue, 0);
    const totalCycles = machineStats.reduce((sum, m) => sum + m.totalCycles, 0);
    const avgUtilization = machineStats.length > 0 ? machineStats.reduce((sum, m) => sum + parseFloat(m.utilizationRate), 0) / machineStats.length : 0;

    res.json({
      machines: machineStats,
      summary: {
        totalMachines: machines.length,
        totalCycles,
        totalRevenue,
        averageUtilization: avgUtilization.toFixed(1)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer retention report
router.get('/customers', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // New customers in period
    const newCustomers = await prisma.customer.count({
      where: { createdAt: { gte: start, lte: end } }
    });

    // Total customers
    const totalCustomers = await prisma.customer.count();

    // Active customers (ordered in period)
    const activeCustomers = await prisma.customer.findMany({
      where: {
        orders: {
          some: { createdAt: { gte: start, lte: end } }
        }
      },
      include: {
        orders: {
          where: { createdAt: { gte: start, lte: end } }
        }
      }
    });

    // Repeat customers
    const repeatCustomers = activeCustomers.filter(c => c.orders.length > 1).length;

    // Top customers
    const topCustomers = activeCustomers
      .map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        orderCount: c.orders.length,
        totalSpent: c.orders.reduce((sum, o) => sum + parseFloat(o.total), 0)
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Inactive customers (no orders in period)
    const inactiveCount = totalCustomers - activeCustomers.length;

    res.json({
      summary: {
        totalCustomers,
        newCustomers,
        activeCustomers: activeCustomers.length,
        repeatCustomers,
        inactiveCustomers: inactiveCount,
        retentionRate: activeCustomers.length > 0 ? (repeatCustomers / activeCustomers.length * 100).toFixed(1) : 0
      },
      topCustomers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Service popularity report
router.get('/services', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orderItems = await prisma.orderItem.findMany({
      where: {
        createdAt: { gte: start, lte: end }
      },
      include: {
        service: true,
        garmentType: true
      }
    });

    // Service breakdown
    const serviceStats = {};
    orderItems.forEach(item => {
      const key = item.service.name;
      if (!serviceStats[key]) {
        serviceStats[key] = { name: key, category: item.service.category, count: 0, revenue: 0 };
      }
      serviceStats[key].count += item.quantity;
      serviceStats[key].revenue += parseFloat(item.totalPrice);
    });

    // Garment breakdown
    const garmentStats = {};
    orderItems.forEach(item => {
      const key = item.garmentType.name;
      if (!garmentStats[key]) {
        garmentStats[key] = { name: key, category: item.garmentType.category, count: 0, revenue: 0 };
      }
      garmentStats[key].count += item.quantity;
      garmentStats[key].revenue += parseFloat(item.totalPrice);
    });

    res.json({
      services: Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue),
      garments: Object.values(garmentStats).sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard summary
router.get('/dashboard', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'CLERK'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayOrders,
      weekOrders,
      monthOrders,
      pendingOrders,
      readyOrders,
      todayPickups,
      todayDeliveries,
      activeMachines,
      totalMachines
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.order.count({ where: { createdAt: { gte: thisWeekStart } } }),
      prisma.order.count({ where: { createdAt: { gte: thisMonthStart } } }),
      prisma.order.count({ where: { status: { in: ['PENDING', 'PICKED_UP', 'PROCESSING', 'CLEANING', 'PRESSING'] } } }),
      prisma.order.count({ where: { status: 'READY' } }),
      prisma.pickup.count({ where: { scheduledStart: { gte: today, lt: tomorrow }, status: 'SCHEDULED' } }),
      prisma.delivery.count({ where: { scheduledStart: { gte: today, lt: tomorrow }, status: 'SCHEDULED' } }),
      prisma.machine.count({ where: { status: 'IN_USE' } }),
      prisma.machine.count()
    ]);

    // Today's revenue
    const todayPayments = await prisma.payment.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
      _sum: { amount: true }
    });

    res.json({
      orders: {
        today: todayOrders,
        thisWeek: weekOrders,
        thisMonth: monthOrders,
        pending: pendingOrders,
        ready: readyOrders
      },
      logistics: {
        todayPickups,
        todayDeliveries
      },
      machines: {
        active: activeMachines,
        total: totalMachines,
        utilizationRate: totalMachines > 0 ? (activeMachines / totalMachines * 100).toFixed(1) : 0
      },
      revenue: {
        today: parseFloat(todayPayments._sum.amount || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
