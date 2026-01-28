const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedDriverRoutes() {
  console.log('🚗 Seeding driver routes for today...\n');

  // Get driver1
  const driver = await prisma.driver.findFirst({
    where: { email: 'driver1@laundry.com' }
  });

  if (!driver) {
    console.log('❌ Driver not found. Run main seed first.');
    return;
  }

  console.log(`✅ Found driver: ${driver.firstName} ${driver.lastName} (${driver.id})`);

  // Get customers with addresses
  const customers = await prisma.customer.findMany({
    take: 20,
    include: { addresses: true }
  });

  if (customers.length === 0) {
    console.log('❌ No customers found. Run main seed first.');
    return;
  }

  // Get services and garment types
  const services = await prisma.service.findMany({ take: 5 });
  const garments = await prisma.garmentType.findMany({ take: 10 });

  // Delete existing routes for today for this driver
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.route.deleteMany({
    where: {
      driverId: driver.id,
      date: { gte: today, lt: tomorrow }
    }
  });

  console.log('🗑️ Cleared existing routes for today');

  // Create orders for pickups and deliveries
  const orders = [];
  for (let i = 0; i < 18; i++) {
    const customer = customers[i % customers.length];
    const address = customer.addresses[0];

    if (!address) continue;

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-DRV-${String(i + 1).padStart(3, '0')}`,
        customerId: customer.id,
        status: i < 10 ? 'PENDING' : 'READY', // First 10 for pickup, rest for delivery
        total: 25 + Math.random() * 75,
        subtotal: 20 + Math.random() * 70,
        tax: 5,
        estimatedReady: new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: {
          create: [
            {
              serviceId: services[i % services.length].id,
              garmentTypeId: garments[i % garments.length].id,
              quantity: 1 + Math.floor(Math.random() * 3),
              unitPrice: 10 + Math.random() * 15,
              totalPrice: 15 + Math.random() * 30
            },
            {
              serviceId: services[(i + 1) % services.length].id,
              garmentTypeId: garments[(i + 2) % garments.length].id,
              quantity: 1 + Math.floor(Math.random() * 2),
              unitPrice: 8 + Math.random() * 12,
              totalPrice: 10 + Math.random() * 20
            }
          ]
        }
      }
    });
    orders.push({ order, customer, address });
  }

  console.log(`✅ Created ${orders.length} orders`);

  // Create route for today
  const route = await prisma.route.create({
    data: {
      driverId: driver.id,
      date: today,
      status: 'PLANNED',
      totalStops: 18,
      totalDistance: 45.5
    }
  });

  console.log(`✅ Created route: ${route.id}`);

  // Create pickups (first 10 orders)
  const pickups = [];
  for (let i = 0; i < 10; i++) {
    const { order, address } = orders[i];
    const scheduledStart = new Date();
    scheduledStart.setHours(8 + Math.floor(i / 2), (i % 2) * 30, 0, 0);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setMinutes(scheduledEnd.getMinutes() + 30);

    const pickup = await prisma.pickup.create({
      data: {
        orderId: order.id,
        routeId: route.id,
        driverId: driver.id,
        addressId: address.id,
        scheduledStart,
        scheduledEnd,
        status: 'SCHEDULED'
      }
    });
    pickups.push(pickup);
  }

  console.log(`✅ Created ${pickups.length} pickups`);

  // Create deliveries (remaining 8 orders)
  const deliveries = [];
  for (let i = 10; i < orders.length; i++) {
    const { order, address } = orders[i];
    const scheduledStart = new Date();
    scheduledStart.setHours(13 + Math.floor((i - 10) / 2), ((i - 10) % 2) * 30, 0, 0);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setMinutes(scheduledEnd.getMinutes() + 30);

    const delivery = await prisma.delivery.create({
      data: {
        orderId: order.id,
        routeId: route.id,
        driverId: driver.id,
        addressId: address.id,
        scheduledStart,
        scheduledEnd,
        status: 'SCHEDULED'
      }
    });
    deliveries.push(delivery);
  }

  console.log(`✅ Created ${deliveries.length} deliveries`);

  // Update route with total stops
  await prisma.route.update({
    where: { id: route.id },
    data: { totalStops: pickups.length + deliveries.length }
  });

  console.log('\n========================================');
  console.log('✅ Driver routes seeded successfully!');
  console.log('========================================\n');
  console.log('📊 Summary:');
  console.log(`   • Driver: ${driver.firstName} ${driver.lastName}`);
  console.log(`   • Route Date: ${today.toLocaleDateString()}`);
  console.log(`   • Pickups: ${pickups.length}`);
  console.log(`   • Deliveries: ${deliveries.length}`);
  console.log(`   • Total Stops: ${pickups.length + deliveries.length}`);
  console.log('\n🔑 Login as driver1@laundry.com to see the route');
}

seedDriverRoutes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
