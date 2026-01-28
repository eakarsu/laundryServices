const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all machines
router.get('/', async (req, res) => {
  try {
    const { locationId, type, status } = req.query;

    const where = {};
    if (locationId) where.locationId = locationId;
    if (type) where.type = type;
    if (status) where.status = status;

    const machines = await prisma.machine.findMany({
      where,
      include: {
        location: true,
        _count: {
          select: { usages: true, maintenances: true }
        }
      },
      orderBy: { machineNumber: 'asc' }
    });

    res.json(machines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get machine by ID
router.get('/:id', async (req, res) => {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: req.params.id },
      include: {
        location: true,
        usages: {
          take: 20,
          orderBy: { startTime: 'desc' }
        },
        maintenances: {
          take: 10,
          orderBy: { scheduledDate: 'desc' }
        }
      }
    });

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    res.json(machine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create machine
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      machineNumber, type, brand, model, capacity,
      pricePerCycle, locationId, isRemoteEnabled, iotDeviceId
    } = req.body;

    const machine = await prisma.machine.create({
      data: {
        machineNumber, type, brand, model, capacity,
        pricePerCycle, locationId, isRemoteEnabled, iotDeviceId
      },
      include: { location: true }
    });

    res.status(201).json(machine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update machine
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const {
      machineNumber, type, brand, model, capacity,
      pricePerCycle, locationId, isRemoteEnabled, iotDeviceId
    } = req.body;

    const machine = await prisma.machine.update({
      where: { id: req.params.id },
      data: {
        machineNumber, type, brand, model, capacity,
        pricePerCycle, locationId, isRemoteEnabled, iotDeviceId
      },
      include: { location: true }
    });

    res.json(machine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update machine status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, currentCycleEnd } = req.body;

    const machine = await prisma.machine.update({
      where: { id: req.params.id },
      data: { status, currentCycleEnd: currentCycleEnd ? new Date(currentCycleEnd) : null }
    });

    res.json(machine);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start machine cycle
router.post('/:id/start', authenticateToken, async (req, res) => {
  try {
    const { cycleType, amountPaid, paymentMethod, customerId, cycleDurationMinutes = 45 } = req.body;

    const machine = await prisma.machine.findUnique({ where: { id: req.params.id } });

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    if (machine.status !== 'AVAILABLE') {
      return res.status(400).json({ error: 'Machine is not available' });
    }

    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + cycleDurationMinutes);

    // Create usage record
    const usage = await prisma.machineUsage.create({
      data: {
        machineId: req.params.id,
        customerId,
        startTime: new Date(),
        cycleType,
        amountPaid: amountPaid || machine.pricePerCycle,
        paymentMethod,
        status: 'IN_PROGRESS'
      }
    });

    // Update machine status
    await prisma.machine.update({
      where: { id: req.params.id },
      data: {
        status: 'IN_USE',
        currentCycleEnd: endTime,
        totalCycles: { increment: 1 }
      }
    });

    res.json({ usage, estimatedEndTime: endTime });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete machine cycle
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    // Find active usage
    const usage = await prisma.machineUsage.findFirst({
      where: { machineId: req.params.id, status: 'IN_PROGRESS' }
    });

    if (usage) {
      await prisma.machineUsage.update({
        where: { id: usage.id },
        data: { endTime: new Date(), status: 'COMPLETED' }
      });
    }

    // Update machine status
    const machine = await prisma.machine.update({
      where: { id: req.params.id },
      data: { status: 'AVAILABLE', currentCycleEnd: null }
    });

    // Create notification if customer exists
    if (usage?.customerId) {
      await prisma.notification.create({
        data: {
          customerId: usage.customerId,
          type: 'CYCLE_COMPLETE',
          channel: 'SMS',
          message: `Your laundry cycle on machine ${machine.machineNumber} is complete!`
        }
      });
    }

    res.json({ message: 'Cycle completed', machine });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get machine usage history
router.get('/:id/usage', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    const where = { machineId: req.params.id };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const [usages, total] = await Promise.all([
      prisma.machineUsage.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { startTime: 'desc' }
      }),
      prisma.machineUsage.count({ where })
    ]);

    res.json({
      usages,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule maintenance
router.post('/:id/maintenance', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { type, description, scheduledDate, technicianName } = req.body;

    const maintenance = await prisma.maintenance.create({
      data: {
        machineId: req.params.id,
        type,
        description,
        scheduledDate: new Date(scheduledDate),
        technicianName
      }
    });

    // Update next maintenance date
    await prisma.machine.update({
      where: { id: req.params.id },
      data: { nextMaintenance: new Date(scheduledDate) }
    });

    res.status(201).json(maintenance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update maintenance status
router.patch('/:id/maintenance/:maintenanceId', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { status, completedDate, cost, notes } = req.body;

    const maintenance = await prisma.maintenance.update({
      where: { id: req.params.maintenanceId },
      data: {
        status,
        completedDate: completedDate ? new Date(completedDate) : null,
        cost,
        notes
      }
    });

    // If completed, update machine
    if (status === 'COMPLETED') {
      await prisma.machine.update({
        where: { id: req.params.id },
        data: {
          lastMaintenance: new Date(),
          status: 'AVAILABLE'
        }
      });
    }

    res.json(maintenance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get machine analytics
router.get('/:id/analytics', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = { machineId: req.params.id };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const usages = await prisma.machineUsage.findMany({ where });

    const totalCycles = usages.length;
    const totalRevenue = usages.reduce((sum, u) => sum + parseFloat(u.amountPaid), 0);
    const completedCycles = usages.filter(u => u.status === 'COMPLETED').length;
    const averageRevenuePerCycle = totalCycles > 0 ? totalRevenue / totalCycles : 0;

    res.json({
      totalCycles,
      totalRevenue,
      completedCycles,
      averageRevenuePerCycle,
      completionRate: totalCycles > 0 ? (completedCycles / totalCycles * 100).toFixed(1) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete machine
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    await prisma.machine.delete({ where: { id: req.params.id } });
    res.json({ message: 'Machine deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
