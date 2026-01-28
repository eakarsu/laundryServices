const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding database with comprehensive data...\n');

  // Create Locations (16)
  console.log('📍 Creating locations...');
  const locations = await Promise.all([
    prisma.location.create({ data: { name: 'Downtown Main', address: '123 Main St', city: 'New York', state: 'NY', zipCode: '10001', phone: '212-555-0101', openTime: '07:00', closeTime: '21:00' } }),
    prisma.location.create({ data: { name: 'Midtown Express', address: '456 5th Ave', city: 'New York', state: 'NY', zipCode: '10018', phone: '212-555-0102', openTime: '06:00', closeTime: '22:00' } }),
    prisma.location.create({ data: { name: 'Brooklyn Heights', address: '789 Atlantic Ave', city: 'Brooklyn', state: 'NY', zipCode: '11201', phone: '718-555-0103', openTime: '07:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'Queens Plaza', address: '321 Queens Blvd', city: 'Queens', state: 'NY', zipCode: '11101', phone: '718-555-0104', openTime: '07:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'Upper East Side', address: '555 Lexington Ave', city: 'New York', state: 'NY', zipCode: '10022', phone: '212-555-0105', openTime: '07:00', closeTime: '21:00' } }),
    prisma.location.create({ data: { name: 'Upper West Side', address: '777 Broadway', city: 'New York', state: 'NY', zipCode: '10025', phone: '212-555-0106', openTime: '07:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'SoHo Center', address: '888 Spring St', city: 'New York', state: 'NY', zipCode: '10012', phone: '212-555-0107', openTime: '08:00', closeTime: '21:00' } }),
    prisma.location.create({ data: { name: 'Chelsea Station', address: '999 W 23rd St', city: 'New York', state: 'NY', zipCode: '10011', phone: '212-555-0108', openTime: '07:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'Financial District', address: '100 Wall St', city: 'New York', state: 'NY', zipCode: '10005', phone: '212-555-0109', openTime: '06:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'Harlem Hub', address: '125 W 125th St', city: 'New York', state: 'NY', zipCode: '10027', phone: '212-555-0110', openTime: '07:00', closeTime: '19:00' } }),
    prisma.location.create({ data: { name: 'Williamsburg', address: '200 Bedford Ave', city: 'Brooklyn', state: 'NY', zipCode: '11211', phone: '718-555-0111', openTime: '08:00', closeTime: '21:00' } }),
    prisma.location.create({ data: { name: 'Astoria Point', address: '300 Steinway St', city: 'Queens', state: 'NY', zipCode: '11103', phone: '718-555-0112', openTime: '07:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'Bronx Center', address: '400 E Fordham Rd', city: 'Bronx', state: 'NY', zipCode: '10458', phone: '718-555-0113', openTime: '07:00', closeTime: '19:00' } }),
    prisma.location.create({ data: { name: 'Staten Island Mall', address: '500 Richmond Ave', city: 'Staten Island', state: 'NY', zipCode: '10314', phone: '718-555-0114', openTime: '09:00', closeTime: '21:00' } }),
    prisma.location.create({ data: { name: 'Jersey City Hub', address: '600 Newark Ave', city: 'Jersey City', state: 'NJ', zipCode: '07306', phone: '201-555-0115', openTime: '07:00', closeTime: '20:00' } }),
    prisma.location.create({ data: { name: 'Hoboken Station', address: '700 Washington St', city: 'Hoboken', state: 'NJ', zipCode: '07030', phone: '201-555-0116', openTime: '06:00', closeTime: '22:00' } }),
  ]);
  console.log(`   ✅ Created ${locations.length} locations`);

  // Create Staff (16)
  console.log('👥 Creating staff...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const staff = await Promise.all([
    prisma.staff.create({ data: { email: 'admin@laundry.com', passwordHash: hashedPassword, firstName: 'John', lastName: 'Admin', role: 'ADMIN', phone: '212-555-1001', locationId: locations[0].id } }),
    prisma.staff.create({ data: { email: 'manager@laundry.com', passwordHash: hashedPassword, firstName: 'Sarah', lastName: 'Manager', role: 'MANAGER', phone: '212-555-1002', locationId: locations[0].id } }),
    prisma.staff.create({ data: { email: 'clerk1@laundry.com', passwordHash: hashedPassword, firstName: 'Mike', lastName: 'Clark', role: 'CLERK', phone: '212-555-1003', locationId: locations[0].id } }),
    prisma.staff.create({ data: { email: 'clerk2@laundry.com', passwordHash: hashedPassword, firstName: 'Emily', lastName: 'Davis', role: 'CLERK', phone: '212-555-1004', locationId: locations[1].id } }),
    prisma.staff.create({ data: { email: 'presser1@laundry.com', passwordHash: hashedPassword, firstName: 'James', lastName: 'Wilson', role: 'PRESSER', phone: '212-555-1005', locationId: locations[0].id } }),
    prisma.staff.create({ data: { email: 'presser2@laundry.com', passwordHash: hashedPassword, firstName: 'Linda', lastName: 'Brown', role: 'PRESSER', phone: '212-555-1006', locationId: locations[1].id } }),
    prisma.staff.create({ data: { email: 'cleaner1@laundry.com', passwordHash: hashedPassword, firstName: 'Robert', lastName: 'Taylor', role: 'CLEANER', phone: '212-555-1007', locationId: locations[0].id } }),
    prisma.staff.create({ data: { email: 'cleaner2@laundry.com', passwordHash: hashedPassword, firstName: 'Patricia', lastName: 'Anderson', role: 'CLEANER', phone: '212-555-1008', locationId: locations[1].id } }),
    prisma.staff.create({ data: { email: 'manager2@laundry.com', passwordHash: hashedPassword, firstName: 'David', lastName: 'Thomas', role: 'MANAGER', phone: '212-555-1009', locationId: locations[2].id } }),
    prisma.staff.create({ data: { email: 'clerk3@laundry.com', passwordHash: hashedPassword, firstName: 'Jennifer', lastName: 'Jackson', role: 'CLERK', phone: '212-555-1010', locationId: locations[2].id } }),
    prisma.staff.create({ data: { email: 'presser3@laundry.com', passwordHash: hashedPassword, firstName: 'Michael', lastName: 'White', role: 'PRESSER', phone: '212-555-1011', locationId: locations[2].id } }),
    prisma.staff.create({ data: { email: 'cleaner3@laundry.com', passwordHash: hashedPassword, firstName: 'Elizabeth', lastName: 'Harris', role: 'CLEANER', phone: '212-555-1012', locationId: locations[2].id } }),
    prisma.staff.create({ data: { email: 'manager3@laundry.com', passwordHash: hashedPassword, firstName: 'William', lastName: 'Martin', role: 'MANAGER', phone: '212-555-1013', locationId: locations[3].id } }),
    prisma.staff.create({ data: { email: 'clerk4@laundry.com', passwordHash: hashedPassword, firstName: 'Susan', lastName: 'Garcia', role: 'CLERK', phone: '212-555-1014', locationId: locations[3].id } }),
    prisma.staff.create({ data: { email: 'presser4@laundry.com', passwordHash: hashedPassword, firstName: 'Joseph', lastName: 'Martinez', role: 'PRESSER', phone: '212-555-1015', locationId: locations[3].id } }),
    prisma.staff.create({ data: { email: 'admin2@laundry.com', passwordHash: hashedPassword, firstName: 'Nancy', lastName: 'Robinson', role: 'ADMIN', phone: '212-555-1016', locationId: locations[4].id } }),
  ]);
  console.log(`   ✅ Created ${staff.length} staff members`);

  // Create Services (17)
  console.log('🧺 Creating services...');
  const services = await Promise.all([
    prisma.service.create({ data: { name: 'Dry Cleaning', description: 'Professional dry cleaning service', category: 'DRY_CLEANING', basePrice: 8.99, estimatedDays: 2 } }),
    prisma.service.create({ data: { name: 'Laundry', description: 'Standard laundry service', category: 'LAUNDRY', basePrice: 3.99, estimatedDays: 1 } }),
    prisma.service.create({ data: { name: 'Wash & Fold', description: 'Laundry washed and neatly folded', category: 'WASH_FOLD', basePrice: 1.99, estimatedDays: 1 } }),
    prisma.service.create({ data: { name: 'Press Only', description: 'Professional pressing service', category: 'PRESSING', basePrice: 4.99, estimatedDays: 1 } }),
    prisma.service.create({ data: { name: 'Starch & Press', description: 'Starching and pressing service', category: 'PRESSING', basePrice: 5.99, estimatedDays: 1 } }),
    prisma.service.create({ data: { name: 'Basic Alterations', description: 'Simple alterations and repairs', category: 'ALTERATIONS', basePrice: 15.00, estimatedDays: 3 } }),
    prisma.service.create({ data: { name: 'Expert Alterations', description: 'Complex alterations', category: 'ALTERATIONS', basePrice: 35.00, estimatedDays: 5 } }),
    prisma.service.create({ data: { name: 'Leather Cleaning', description: 'Specialized leather care', category: 'SPECIALTY', basePrice: 45.00, estimatedDays: 7 } }),
    prisma.service.create({ data: { name: 'Suede Cleaning', description: 'Specialized suede care', category: 'SPECIALTY', basePrice: 45.00, estimatedDays: 7 } }),
    prisma.service.create({ data: { name: 'Wedding Dress', description: 'Bridal gown cleaning and preservation', category: 'SPECIALTY', basePrice: 199.00, estimatedDays: 14 } }),
    prisma.service.create({ data: { name: 'Comforter Cleaning', description: 'Bedding and comforter cleaning', category: 'LAUNDRY', basePrice: 25.00, estimatedDays: 2 } }),
    prisma.service.create({ data: { name: 'Curtain Cleaning', description: 'Drapes and curtain cleaning', category: 'SPECIALTY', basePrice: 35.00, estimatedDays: 5 } }),
    prisma.service.create({ data: { name: 'Rug Cleaning', description: 'Area rug cleaning', category: 'SPECIALTY', basePrice: 50.00, estimatedDays: 7 } }),
    prisma.service.create({ data: { name: 'Shoe Repair', description: 'Professional shoe repair', category: 'SPECIALTY', basePrice: 25.00, estimatedDays: 5 } }),
    prisma.service.create({ data: { name: 'Bag Cleaning', description: 'Handbag and luggage cleaning', category: 'SPECIALTY', basePrice: 40.00, estimatedDays: 7 } }),
    prisma.service.create({ data: { name: 'Express Service', description: 'Same day service', category: 'DRY_CLEANING', basePrice: 15.99, estimatedDays: 0 } }),
    prisma.service.create({ data: { name: 'Delicate Items', description: 'Hand wash delicate fabrics', category: 'SPECIALTY', basePrice: 12.99, estimatedDays: 3 } }),
  ]);
  console.log(`   ✅ Created ${services.length} services`);

  // Create Garment Types (22)
  console.log('👔 Creating garment types...');
  const garments = await Promise.all([
    prisma.garmentType.create({ data: { name: 'Dress Shirt', category: 'Tops', basePrice: 5.99 } }),
    prisma.garmentType.create({ data: { name: 'T-Shirt', category: 'Tops', basePrice: 3.99 } }),
    prisma.garmentType.create({ data: { name: 'Blouse', category: 'Tops', basePrice: 6.99 } }),
    prisma.garmentType.create({ data: { name: 'Sweater', category: 'Tops', basePrice: 7.99 } }),
    prisma.garmentType.create({ data: { name: 'Polo Shirt', category: 'Tops', basePrice: 5.49 } }),
    prisma.garmentType.create({ data: { name: 'Pants', category: 'Bottoms', basePrice: 7.99 } }),
    prisma.garmentType.create({ data: { name: 'Jeans', category: 'Bottoms', basePrice: 6.99 } }),
    prisma.garmentType.create({ data: { name: 'Skirt', category: 'Bottoms', basePrice: 6.99 } }),
    prisma.garmentType.create({ data: { name: 'Shorts', category: 'Bottoms', basePrice: 4.99 } }),
    prisma.garmentType.create({ data: { name: 'Suit Jacket', category: 'Outerwear', basePrice: 12.99 } }),
    prisma.garmentType.create({ data: { name: 'Blazer', category: 'Outerwear', basePrice: 11.99 } }),
    prisma.garmentType.create({ data: { name: 'Coat', category: 'Outerwear', basePrice: 15.99 } }),
    prisma.garmentType.create({ data: { name: 'Overcoat', category: 'Outerwear', basePrice: 18.99 } }),
    prisma.garmentType.create({ data: { name: 'Jacket', category: 'Outerwear', basePrice: 10.99 } }),
    prisma.garmentType.create({ data: { name: 'Dress', category: 'Dresses', basePrice: 14.99 } }),
    prisma.garmentType.create({ data: { name: 'Evening Gown', category: 'Dresses', basePrice: 24.99 } }),
    prisma.garmentType.create({ data: { name: 'Wedding Dress', category: 'Specialty', basePrice: 149.99 } }),
    prisma.garmentType.create({ data: { name: 'Tie', category: 'Accessories', basePrice: 4.99 } }),
    prisma.garmentType.create({ data: { name: 'Scarf', category: 'Accessories', basePrice: 5.99 } }),
    prisma.garmentType.create({ data: { name: 'Comforter', category: 'Household', basePrice: 29.99 } }),
    prisma.garmentType.create({ data: { name: 'Blanket', category: 'Household', basePrice: 19.99 } }),
    prisma.garmentType.create({ data: { name: 'Curtains', category: 'Household', basePrice: 24.99 } }),
  ]);
  console.log(`   ✅ Created ${garments.length} garment types`);

  // Create Service Prices
  console.log('💰 Creating service prices...');
  const servicePrices = [];
  for (const service of services.slice(0, 5)) {
    for (const garment of garments.slice(0, 16)) {
      const multiplier = service.name === 'Dry Cleaning' ? 1.2 : service.category === 'WASH_FOLD' ? 0.8 : 1.0;
      servicePrices.push(
        prisma.servicePrice.create({
          data: {
            serviceId: service.id,
            garmentTypeId: garment.id,
            price: parseFloat((parseFloat(garment.basePrice) * multiplier).toFixed(2)),
          },
        })
      );
    }
  }
  await Promise.all(servicePrices);
  console.log(`   ✅ Created ${servicePrices.length} service prices`);

  // Create Alteration Types (16)
  console.log('✂️ Creating alteration types...');
  const alterationTypes = await Promise.all([
    prisma.alterationType.create({ data: { name: 'Hem Pants', description: 'Shorten or lengthen pants', basePrice: 12.00 } }),
    prisma.alterationType.create({ data: { name: 'Hem Dress', description: 'Shorten or lengthen dress', basePrice: 15.00 } }),
    prisma.alterationType.create({ data: { name: 'Hem Skirt', description: 'Shorten or lengthen skirt', basePrice: 12.00 } }),
    prisma.alterationType.create({ data: { name: 'Take In Waist', description: 'Reduce waist size', basePrice: 18.00 } }),
    prisma.alterationType.create({ data: { name: 'Let Out Waist', description: 'Increase waist size', basePrice: 20.00 } }),
    prisma.alterationType.create({ data: { name: 'Shorten Sleeves', description: 'Shorten jacket or shirt sleeves', basePrice: 15.00 } }),
    prisma.alterationType.create({ data: { name: 'Lengthen Sleeves', description: 'Lengthen jacket or shirt sleeves', basePrice: 18.00 } }),
    prisma.alterationType.create({ data: { name: 'Taper Pants', description: 'Slim fit alteration', basePrice: 20.00 } }),
    prisma.alterationType.create({ data: { name: 'Replace Zipper', description: 'Zipper replacement', basePrice: 15.00 } }),
    prisma.alterationType.create({ data: { name: 'Replace Buttons', description: 'Button replacement', basePrice: 5.00 } }),
    prisma.alterationType.create({ data: { name: 'Patch/Repair', description: 'Fabric patching and repair', basePrice: 10.00 } }),
    prisma.alterationType.create({ data: { name: 'Take In Jacket', description: 'Reduce jacket size', basePrice: 35.00 } }),
    prisma.alterationType.create({ data: { name: 'Reline Jacket', description: 'Replace jacket lining', basePrice: 75.00 } }),
    prisma.alterationType.create({ data: { name: 'Add Darts', description: 'Add darts for better fit', basePrice: 15.00 } }),
    prisma.alterationType.create({ data: { name: 'Fix Seam', description: 'Repair torn seam', basePrice: 8.00 } }),
    prisma.alterationType.create({ data: { name: 'Shorten Coat', description: 'Shorten coat length', basePrice: 40.00 } }),
  ]);
  console.log(`   ✅ Created ${alterationTypes.length} alteration types`);

  // Create Subscription Plans (16)
  console.log('📋 Creating subscription plans...');
  const subscriptionPlans = await Promise.all([
    prisma.subscriptionPlan.create({ data: { name: 'Basic Monthly', description: '10 items per month', price: 29.99, billingCycle: 'MONTHLY', itemLimit: 10, discountPercent: 10, freePickups: 2, freeDeliveries: 2 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Standard Monthly', description: '20 items per month', price: 49.99, billingCycle: 'MONTHLY', itemLimit: 20, discountPercent: 15, freePickups: 4, freeDeliveries: 4 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Premium Monthly', description: '40 items per month', price: 89.99, billingCycle: 'MONTHLY', itemLimit: 40, discountPercent: 20, freePickups: 8, freeDeliveries: 8 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Family Monthly', description: '60 items per month', price: 119.99, billingCycle: 'MONTHLY', itemLimit: 60, discountPercent: 25, freePickups: 10, freeDeliveries: 10 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Basic Biweekly', description: '5 items biweekly', price: 19.99, billingCycle: 'BIWEEKLY', itemLimit: 5, discountPercent: 8, freePickups: 1, freeDeliveries: 1 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Standard Biweekly', description: '10 items biweekly', price: 34.99, billingCycle: 'BIWEEKLY', itemLimit: 10, discountPercent: 12, freePickups: 2, freeDeliveries: 2 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Basic Weekly', description: '5 items weekly', price: 24.99, billingCycle: 'WEEKLY', itemLimit: 5, discountPercent: 10, freePickups: 1, freeDeliveries: 1 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Professional Weekly', description: '15 items weekly', price: 59.99, billingCycle: 'WEEKLY', itemLimit: 15, discountPercent: 18, freePickups: 2, freeDeliveries: 2 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Basic Annual', description: '120 items per year', price: 299.99, billingCycle: 'YEARLY', itemLimit: 120, discountPercent: 15, freePickups: 24, freeDeliveries: 24 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Standard Annual', description: '240 items per year', price: 499.99, billingCycle: 'YEARLY', itemLimit: 240, discountPercent: 20, freePickups: 48, freeDeliveries: 48 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Premium Annual', description: '480 items per year', price: 799.99, billingCycle: 'YEARLY', itemLimit: 480, discountPercent: 28, freePickups: 52, freeDeliveries: 52 } }),
    prisma.subscriptionPlan.create({ data: { name: 'VIP Unlimited', description: 'Unlimited items', price: 199.99, billingCycle: 'MONTHLY', discountPercent: 30, freePickups: 99, freeDeliveries: 99 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Business Basic', description: '100 items per month', price: 199.99, billingCycle: 'MONTHLY', itemLimit: 100, discountPercent: 20, freePickups: 20, freeDeliveries: 20 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Business Pro', description: '250 items per month', price: 399.99, billingCycle: 'MONTHLY', itemLimit: 250, discountPercent: 25, freePickups: 40, freeDeliveries: 40 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Student Plan', description: '15 items per month', price: 19.99, billingCycle: 'MONTHLY', itemLimit: 15, discountPercent: 15, freePickups: 2, freeDeliveries: 2 } }),
    prisma.subscriptionPlan.create({ data: { name: 'Senior Plan', description: '20 items per month', price: 24.99, billingCycle: 'MONTHLY', itemLimit: 20, discountPercent: 20, freePickups: 4, freeDeliveries: 4 } }),
  ]);
  console.log(`   ✅ Created ${subscriptionPlans.length} subscription plans`);

  // Create Coupons (16)
  console.log('🎟️ Creating coupons...');
  const today = new Date();
  const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nextYear = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

  const coupons = await Promise.all([
    prisma.coupon.create({ data: { code: 'WELCOME20', description: 'Welcome discount - 20% off', discountType: 'PERCENTAGE', discountValue: 20, minOrderAmount: 20, maxDiscount: 50, startDate: today, endDate: nextYear, usageLimit: 1000 } }),
    prisma.coupon.create({ data: { code: 'SAVE15', description: 'Save 15% on orders over $40', discountType: 'PERCENTAGE', discountValue: 15, minOrderAmount: 40, maxDiscount: 30, startDate: today, endDate: nextMonth, usageLimit: 500 } }),
    prisma.coupon.create({ data: { code: 'FLAT10', description: '$10 off orders over $50', discountType: 'FIXED_AMOUNT', discountValue: 10, minOrderAmount: 50, startDate: today, endDate: nextMonth, usageLimit: 200 } }),
    prisma.coupon.create({ data: { code: 'SUMMER25', description: 'Summer sale - 25% off', discountType: 'PERCENTAGE', discountValue: 25, minOrderAmount: 40, maxDiscount: 50, startDate: today, endDate: nextMonth, usageLimit: 300 } }),
    prisma.coupon.create({ data: { code: 'FIRSTORDER', description: 'First order - 15% off', discountType: 'PERCENTAGE', discountValue: 15, startDate: today, endDate: nextYear, usageLimit: 5000 } }),
    prisma.coupon.create({ data: { code: 'LOYALTY5', description: 'Loyalty reward - $5 off', discountType: 'FIXED_AMOUNT', discountValue: 5, minOrderAmount: 25, startDate: today, endDate: nextYear } }),
    prisma.coupon.create({ data: { code: 'VIP25', description: '25% off for VIP customers', discountType: 'PERCENTAGE', discountValue: 25, maxDiscount: 100, startDate: today, endDate: nextYear, usageLimit: 50 } }),
    prisma.coupon.create({ data: { code: 'BULK30', description: '30% off for 10+ items', discountType: 'PERCENTAGE', discountValue: 30, minOrderAmount: 100, maxDiscount: 75, startDate: today, endDate: nextYear } }),
    prisma.coupon.create({ data: { code: 'HOLIDAY20', description: 'Holiday special - 20% off', discountType: 'PERCENTAGE', discountValue: 20, startDate: today, endDate: nextMonth, usageLimit: 1000 } }),
    prisma.coupon.create({ data: { code: 'REFERRAL10', description: 'Referral bonus - $10 off', discountType: 'FIXED_AMOUNT', discountValue: 10, minOrderAmount: 30, startDate: today, endDate: nextYear } }),
    prisma.coupon.create({ data: { code: 'FLASH40', description: 'Flash sale - 40% off', discountType: 'PERCENTAGE', discountValue: 40, minOrderAmount: 60, maxDiscount: 40, startDate: today, endDate: nextMonth, usageLimit: 100 } }),
    prisma.coupon.create({ data: { code: 'WEDDING15', description: 'Wedding season - 15% off', discountType: 'PERCENTAGE', discountValue: 15, startDate: today, endDate: nextYear } }),
    prisma.coupon.create({ data: { code: 'CORPORATE20', description: 'Corporate accounts - 20% off', discountType: 'PERCENTAGE', discountValue: 20, minOrderAmount: 200, startDate: today, endDate: nextYear } }),
    prisma.coupon.create({ data: { code: 'NEWYEAR30', description: 'New Year special - 30% off', discountType: 'PERCENTAGE', discountValue: 30, minOrderAmount: 50, maxDiscount: 60, startDate: today, endDate: nextMonth, usageLimit: 500 } }),
    prisma.coupon.create({ data: { code: 'FREESHIP', description: 'Free delivery on orders over $40', discountType: 'FIXED_AMOUNT', discountValue: 8, minOrderAmount: 40, startDate: today, endDate: nextYear } }),
    prisma.coupon.create({ data: { code: 'MONDAY15', description: 'Monday special - 15% off', discountType: 'PERCENTAGE', discountValue: 15, startDate: today, endDate: nextYear, usageLimit: 200 } }),
  ]);
  console.log(`   ✅ Created ${coupons.length} coupons`);

  // Create Customers (20)
  console.log('👤 Creating customers...');
  const customers = await Promise.all([
    prisma.customer.create({ data: { email: 'john.smith@email.com', passwordHash: hashedPassword, firstName: 'John', lastName: 'Smith', phone: '212-555-2001', creditBalance: 25.00, loyaltyPoints: 150 } }),
    prisma.customer.create({ data: { email: 'jane.doe@email.com', passwordHash: hashedPassword, firstName: 'Jane', lastName: 'Doe', phone: '212-555-2002', creditBalance: 50.00, loyaltyPoints: 320 } }),
    prisma.customer.create({ data: { email: 'robert.johnson@email.com', passwordHash: hashedPassword, firstName: 'Robert', lastName: 'Johnson', phone: '212-555-2003', creditBalance: 0, loyaltyPoints: 85 } }),
    prisma.customer.create({ data: { email: 'maria.garcia@email.com', passwordHash: hashedPassword, firstName: 'Maria', lastName: 'Garcia', phone: '212-555-2004', creditBalance: 15.50, loyaltyPoints: 210 } }),
    prisma.customer.create({ data: { email: 'david.williams@email.com', passwordHash: hashedPassword, firstName: 'David', lastName: 'Williams', phone: '212-555-2005', creditBalance: 100.00, loyaltyPoints: 500 } }),
    prisma.customer.create({ data: { email: 'sarah.brown@email.com', passwordHash: hashedPassword, firstName: 'Sarah', lastName: 'Brown', phone: '212-555-2006', creditBalance: 0, loyaltyPoints: 45 } }),
    prisma.customer.create({ data: { email: 'michael.jones@email.com', passwordHash: hashedPassword, firstName: 'Michael', lastName: 'Jones', phone: '212-555-2007', creditBalance: 30.00, loyaltyPoints: 275 } }),
    prisma.customer.create({ data: { email: 'emily.davis@email.com', passwordHash: hashedPassword, firstName: 'Emily', lastName: 'Davis', phone: '212-555-2008', creditBalance: 75.00, loyaltyPoints: 400 } }),
    prisma.customer.create({ data: { email: 'james.miller@email.com', passwordHash: hashedPassword, firstName: 'James', lastName: 'Miller', phone: '212-555-2009', creditBalance: 0, loyaltyPoints: 60 } }),
    prisma.customer.create({ data: { email: 'lisa.wilson@email.com', passwordHash: hashedPassword, firstName: 'Lisa', lastName: 'Wilson', phone: '212-555-2010', creditBalance: 20.00, loyaltyPoints: 180 } }),
    prisma.customer.create({ data: { email: 'william.moore@email.com', passwordHash: hashedPassword, firstName: 'William', lastName: 'Moore', phone: '212-555-2011', creditBalance: 45.00, loyaltyPoints: 290 } }),
    prisma.customer.create({ data: { email: 'jennifer.taylor@email.com', passwordHash: hashedPassword, firstName: 'Jennifer', lastName: 'Taylor', phone: '212-555-2012', creditBalance: 10.00, loyaltyPoints: 125 } }),
    prisma.customer.create({ data: { email: 'richard.anderson@email.com', passwordHash: hashedPassword, firstName: 'Richard', lastName: 'Anderson', phone: '212-555-2013', creditBalance: 0, loyaltyPoints: 30 } }),
    prisma.customer.create({ data: { email: 'susan.thomas@email.com', passwordHash: hashedPassword, firstName: 'Susan', lastName: 'Thomas', phone: '212-555-2014', creditBalance: 60.00, loyaltyPoints: 350 } }),
    prisma.customer.create({ data: { email: 'joseph.jackson@email.com', passwordHash: hashedPassword, firstName: 'Joseph', lastName: 'Jackson', phone: '212-555-2015', creditBalance: 5.00, loyaltyPoints: 95 } }),
    prisma.customer.create({ data: { email: 'margaret.white@email.com', passwordHash: hashedPassword, firstName: 'Margaret', lastName: 'White', phone: '212-555-2016', creditBalance: 80.00, loyaltyPoints: 420 } }),
    prisma.customer.create({ data: { email: 'charles.harris@email.com', passwordHash: hashedPassword, firstName: 'Charles', lastName: 'Harris', phone: '212-555-2017', creditBalance: 0, loyaltyPoints: 55 } }),
    prisma.customer.create({ data: { email: 'patricia.martin@email.com', passwordHash: hashedPassword, firstName: 'Patricia', lastName: 'Martin', phone: '212-555-2018', creditBalance: 35.00, loyaltyPoints: 245 } }),
    prisma.customer.create({ data: { email: 'thomas.thompson@email.com', passwordHash: hashedPassword, firstName: 'Thomas', lastName: 'Thompson', phone: '212-555-2019', creditBalance: 90.00, loyaltyPoints: 480 } }),
    prisma.customer.create({ data: { email: 'elizabeth.garcia@email.com', passwordHash: hashedPassword, firstName: 'Elizabeth', lastName: 'Garcia', phone: '212-555-2020', creditBalance: 12.50, loyaltyPoints: 165 } }),
  ]);
  console.log(`   ✅ Created ${customers.length} customers`);

  // Create Customer Addresses
  console.log('🏠 Creating addresses...');
  const addresses = [];
  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    addresses.push(
      prisma.address.create({
        data: {
          customerId: customer.id,
          label: 'Home',
          street: `${100 + i * 10} Main St`,
          apartment: i % 3 === 0 ? `Apt ${i + 1}A` : null,
          city: 'New York',
          state: 'NY',
          zipCode: `100${String(10 + i).padStart(2, '0')}`,
          latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
          longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
          isDefault: true,
          instructions: i % 4 === 0 ? 'Leave with doorman' : null,
        },
      })
    );
    if (i % 2 === 0) {
      addresses.push(
        prisma.address.create({
          data: {
            customerId: customer.id,
            label: 'Work',
            street: `${200 + i * 5} Business Ave`,
            city: 'New York',
            state: 'NY',
            zipCode: `100${String(20 + i).padStart(2, '0')}`,
            latitude: 40.7580 + (Math.random() - 0.5) * 0.1,
            longitude: -73.9855 + (Math.random() - 0.5) * 0.1,
            isDefault: false,
          },
        })
      );
    }
  }
  const createdAddresses = await Promise.all(addresses);
  console.log(`   ✅ Created ${createdAddresses.length} customer addresses`);

  // Create Machines (20)
  console.log('🔧 Creating machines...');
  const machines = await Promise.all([
    prisma.machine.create({ data: { machineNumber: 'W001', type: 'WASHER', brand: 'Speed Queen', model: 'SC40', capacity: '40 lbs', locationId: locations[0].id, status: 'AVAILABLE', pricePerCycle: 4.50, isRemoteEnabled: true, iotDeviceId: 'IOT-W-0001' } }),
    prisma.machine.create({ data: { machineNumber: 'W002', type: 'WASHER', brand: 'Speed Queen', model: 'SC40', capacity: '40 lbs', locationId: locations[0].id, status: 'AVAILABLE', pricePerCycle: 4.50, isRemoteEnabled: true, iotDeviceId: 'IOT-W-0002' } }),
    prisma.machine.create({ data: { machineNumber: 'W003', type: 'WASHER', brand: 'LG Commercial', model: 'GIANT C', capacity: '60 lbs', locationId: locations[0].id, status: 'IN_USE', pricePerCycle: 6.00, isRemoteEnabled: true, iotDeviceId: 'IOT-W-0003' } }),
    prisma.machine.create({ data: { machineNumber: 'W004', type: 'WASHER', brand: 'Speed Queen', model: 'SC40', capacity: '40 lbs', locationId: locations[1].id, status: 'AVAILABLE', pricePerCycle: 4.50, isRemoteEnabled: true, iotDeviceId: 'IOT-W-0004' } }),
    prisma.machine.create({ data: { machineNumber: 'W005', type: 'WASHER', brand: 'Maytag', model: 'MHN33', capacity: '35 lbs', locationId: locations[1].id, status: 'MAINTENANCE', pricePerCycle: 4.00, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'D001', type: 'DRYER', brand: 'Speed Queen', model: 'ST075', capacity: '75 lbs', locationId: locations[0].id, status: 'AVAILABLE', pricePerCycle: 3.50, isRemoteEnabled: true, iotDeviceId: 'IOT-D-0001' } }),
    prisma.machine.create({ data: { machineNumber: 'D002', type: 'DRYER', brand: 'Speed Queen', model: 'ST075', capacity: '75 lbs', locationId: locations[0].id, status: 'AVAILABLE', pricePerCycle: 3.50, isRemoteEnabled: true, iotDeviceId: 'IOT-D-0002' } }),
    prisma.machine.create({ data: { machineNumber: 'D003', type: 'DRYER', brand: 'LG Commercial', model: 'RV1329', capacity: '50 lbs', locationId: locations[0].id, status: 'IN_USE', pricePerCycle: 3.00, isRemoteEnabled: true, iotDeviceId: 'IOT-D-0003' } }),
    prisma.machine.create({ data: { machineNumber: 'D004', type: 'DRYER', brand: 'Speed Queen', model: 'ST075', capacity: '75 lbs', locationId: locations[1].id, status: 'AVAILABLE', pricePerCycle: 3.50, isRemoteEnabled: true, iotDeviceId: 'IOT-D-0004' } }),
    prisma.machine.create({ data: { machineNumber: 'D005', type: 'DRYER', brand: 'Maytag', model: 'MDG28', capacity: '50 lbs', locationId: locations[2].id, status: 'AVAILABLE', pricePerCycle: 3.00, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'P001', type: 'PRESS', brand: 'Unipress', model: 'ABS', capacity: 'Standard', locationId: locations[0].id, status: 'AVAILABLE', pricePerCycle: 1.50, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'P002', type: 'PRESS', brand: 'Unipress', model: 'ABS', capacity: 'Standard', locationId: locations[0].id, status: 'IN_USE', pricePerCycle: 1.50, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'P003', type: 'PRESS', brand: 'Hoffman', model: 'New Yorker', capacity: 'Large', locationId: locations[1].id, status: 'AVAILABLE', pricePerCycle: 2.00, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'F001', type: 'FOLDER', brand: 'Chicago', model: 'Tristar', capacity: 'Standard', locationId: locations[0].id, status: 'AVAILABLE', pricePerCycle: 1.00, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'C001', type: 'COMBO', brand: 'LG', model: 'WashTower', capacity: '4.5 cu ft', locationId: locations[2].id, status: 'AVAILABLE', pricePerCycle: 7.00, isRemoteEnabled: true, iotDeviceId: 'IOT-C-0001' } }),
    prisma.machine.create({ data: { machineNumber: 'W006', type: 'WASHER', brand: 'Speed Queen', model: 'SC40', capacity: '40 lbs', locationId: locations[2].id, status: 'AVAILABLE', pricePerCycle: 4.50, isRemoteEnabled: true, iotDeviceId: 'IOT-W-0006' } }),
    prisma.machine.create({ data: { machineNumber: 'W007', type: 'WASHER', brand: 'LG Commercial', model: 'GIANT C', capacity: '60 lbs', locationId: locations[3].id, status: 'AVAILABLE', pricePerCycle: 6.00, isRemoteEnabled: true, iotDeviceId: 'IOT-W-0007' } }),
    prisma.machine.create({ data: { machineNumber: 'D006', type: 'DRYER', brand: 'Speed Queen', model: 'ST075', capacity: '75 lbs', locationId: locations[3].id, status: 'AVAILABLE', pricePerCycle: 3.50, isRemoteEnabled: true, iotDeviceId: 'IOT-D-0006' } }),
    prisma.machine.create({ data: { machineNumber: 'W008', type: 'WASHER', brand: 'Maytag', model: 'MHN33', capacity: '35 lbs', locationId: locations[4].id, status: 'OUT_OF_ORDER', pricePerCycle: 4.00, isRemoteEnabled: false } }),
    prisma.machine.create({ data: { machineNumber: 'D007', type: 'DRYER', brand: 'Maytag', model: 'MDG28', capacity: '50 lbs', locationId: locations[4].id, status: 'AVAILABLE', pricePerCycle: 3.00, isRemoteEnabled: false } }),
  ]);
  console.log(`   ✅ Created ${machines.length} machines`);

  // Create Drivers (16)
  console.log('🚗 Creating drivers...');
  const drivers = await Promise.all([
    prisma.driver.create({ data: { email: 'driver1@laundry.com', passwordHash: hashedPassword, firstName: 'Carlos', lastName: 'Rodriguez', phone: '212-555-3001', licenseNumber: 'DL123456', vehicleInfo: '2022 Ford Transit - White', isAvailable: true, currentLat: 40.7128, currentLng: -74.0060 } }),
    prisma.driver.create({ data: { email: 'driver2@laundry.com', passwordHash: hashedPassword, firstName: 'Ahmed', lastName: 'Hassan', phone: '212-555-3002', licenseNumber: 'DL234567', vehicleInfo: '2023 Mercedes Sprinter - Silver', isAvailable: true, currentLat: 40.7580, currentLng: -73.9855 } }),
    prisma.driver.create({ data: { email: 'driver3@laundry.com', passwordHash: hashedPassword, firstName: 'Kevin', lastName: 'OBrien', phone: '212-555-3003', licenseNumber: 'DL345678', vehicleInfo: '2021 Ram ProMaster - Blue', isAvailable: true, currentLat: 40.6892, currentLng: -73.9442 } }),
    prisma.driver.create({ data: { email: 'driver4@laundry.com', passwordHash: hashedPassword, firstName: 'Luis', lastName: 'Martinez', phone: '212-555-3004', licenseNumber: 'DL456789', vehicleInfo: '2022 Ford Transit - Black', isAvailable: false } }),
    prisma.driver.create({ data: { email: 'driver5@laundry.com', passwordHash: hashedPassword, firstName: 'Dmitri', lastName: 'Petrov', phone: '212-555-3005', licenseNumber: 'DL567890', vehicleInfo: '2023 Nissan NV - White', isAvailable: true, currentLat: 40.7282, currentLng: -73.7949 } }),
    prisma.driver.create({ data: { email: 'driver6@laundry.com', passwordHash: hashedPassword, firstName: 'Marcus', lastName: 'Johnson', phone: '212-555-3006', licenseNumber: 'DL678901', vehicleInfo: '2022 Chevrolet Express - Gray', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver7@laundry.com', passwordHash: hashedPassword, firstName: 'Wei', lastName: 'Chen', phone: '212-555-3007', licenseNumber: 'DL789012', vehicleInfo: '2021 Ford Transit - White', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver8@laundry.com', passwordHash: hashedPassword, firstName: 'Antonio', lastName: 'Silva', phone: '212-555-3008', licenseNumber: 'DL890123', vehicleInfo: '2023 Ram ProMaster - Red', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver9@laundry.com', passwordHash: hashedPassword, firstName: 'Jamal', lastName: 'Williams', phone: '212-555-3009', licenseNumber: 'DL901234', vehicleInfo: '2022 Mercedes Sprinter - White', isAvailable: false } }),
    prisma.driver.create({ data: { email: 'driver10@laundry.com', passwordHash: hashedPassword, firstName: 'Patrick', lastName: 'Murphy', phone: '212-555-3010', licenseNumber: 'DL012345', vehicleInfo: '2021 Nissan NV - Blue', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver11@laundry.com', passwordHash: hashedPassword, firstName: 'Raj', lastName: 'Patel', phone: '212-555-3011', licenseNumber: 'DL111111', vehicleInfo: '2023 Ford Transit - Silver', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver12@laundry.com', passwordHash: hashedPassword, firstName: 'Omar', lastName: 'Ali', phone: '212-555-3012', licenseNumber: 'DL222222', vehicleInfo: '2022 Chevrolet Express - White', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver13@laundry.com', passwordHash: hashedPassword, firstName: 'Ivan', lastName: 'Kozlov', phone: '212-555-3013', licenseNumber: 'DL333333', vehicleInfo: '2021 Ram ProMaster - White', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver14@laundry.com', passwordHash: hashedPassword, firstName: 'Yuki', lastName: 'Tanaka', phone: '212-555-3014', licenseNumber: 'DL444444', vehicleInfo: '2023 Nissan NV - Black', isAvailable: false } }),
    prisma.driver.create({ data: { email: 'driver15@laundry.com', passwordHash: hashedPassword, firstName: 'Erik', lastName: 'Larsson', phone: '212-555-3015', licenseNumber: 'DL555555', vehicleInfo: '2022 Ford Transit - Blue', isAvailable: true } }),
    prisma.driver.create({ data: { email: 'driver16@laundry.com', passwordHash: hashedPassword, firstName: 'Miguel', lastName: 'Santos', phone: '212-555-3016', licenseNumber: 'DL666666', vehicleInfo: '2021 Mercedes Sprinter - Gray', isAvailable: true } }),
  ]);
  console.log(`   ✅ Created ${drivers.length} drivers`);

  // Create Lockers (16)
  console.log('🔐 Creating lockers...');
  const lockers = await Promise.all([
    prisma.locker.create({ data: { name: 'Grand Central Locker', location: 'Grand Central Terminal', address: '89 E 42nd St, New York, NY 10017', totalUnits: 24, availableUnits: 18 } }),
    prisma.locker.create({ data: { name: 'Penn Station Locker', location: 'Penn Station', address: '7th Ave & 32nd St, New York, NY 10001', totalUnits: 30, availableUnits: 22 } }),
    prisma.locker.create({ data: { name: 'Times Square Hub', location: 'Times Square', address: '1560 Broadway, New York, NY 10036', totalUnits: 36, availableUnits: 28 } }),
    prisma.locker.create({ data: { name: 'Wall Street Station', location: 'Financial District', address: '60 Wall St, New York, NY 10005', totalUnits: 20, availableUnits: 15 } }),
    prisma.locker.create({ data: { name: 'Columbus Circle', location: 'Columbus Circle', address: '10 Columbus Circle, New York, NY 10019', totalUnits: 24, availableUnits: 20 } }),
    prisma.locker.create({ data: { name: 'Union Square', location: 'Union Square', address: '14th St & Union Square, New York, NY 10003', totalUnits: 28, availableUnits: 24 } }),
    prisma.locker.create({ data: { name: 'Herald Square', location: 'Herald Square', address: '34th St & Broadway, New York, NY 10001', totalUnits: 32, availableUnits: 26 } }),
    prisma.locker.create({ data: { name: 'Rockefeller Center', location: 'Rockefeller Center', address: '45 Rockefeller Plaza, New York, NY 10111', totalUnits: 20, availableUnits: 16 } }),
    prisma.locker.create({ data: { name: 'Brooklyn Downtown', location: 'Downtown Brooklyn', address: '100 Livingston St, Brooklyn, NY 11201', totalUnits: 24, availableUnits: 19 } }),
    prisma.locker.create({ data: { name: 'Williamsburg Hub', location: 'Williamsburg', address: '200 Bedford Ave, Brooklyn, NY 11211', totalUnits: 18, availableUnits: 14 } }),
    prisma.locker.create({ data: { name: 'Astoria Station', location: 'Astoria', address: '31-00 Steinway St, Queens, NY 11103', totalUnits: 20, availableUnits: 17 } }),
    prisma.locker.create({ data: { name: 'Long Island City', location: 'LIC', address: '47-10 Vernon Blvd, Queens, NY 11101', totalUnits: 22, availableUnits: 18 } }),
    prisma.locker.create({ data: { name: 'Fordham Plaza', location: 'Bronx', address: '1 Fordham Plaza, Bronx, NY 10458', totalUnits: 16, availableUnits: 12 } }),
    prisma.locker.create({ data: { name: 'Staten Island Mall', location: 'Staten Island', address: '2655 Richmond Ave, Staten Island, NY 10314', totalUnits: 20, availableUnits: 18 } }),
    prisma.locker.create({ data: { name: 'Journal Square', location: 'Jersey City', address: '1 Journal Square, Jersey City, NJ 07306', totalUnits: 24, availableUnits: 20 } }),
    prisma.locker.create({ data: { name: 'Hoboken Terminal', location: 'Hoboken', address: '1 Hudson Pl, Hoboken, NJ 07030', totalUnits: 28, availableUnits: 24 } }),
  ]);
  console.log(`   ✅ Created ${lockers.length} lockers`);

  // Create Gift Cards (20)
  console.log('🎁 Creating gift cards...');
  const generateGiftCardCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'GIFT-';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const giftCards = [];
  const giftCardAmounts = [25, 50, 75, 100, 150, 200];
  for (let i = 0; i < 20; i++) {
    const amount = giftCardAmounts[Math.floor(Math.random() * giftCardAmounts.length)];
    const usedAmount = Math.random() > 0.5 ? Math.floor(Math.random() * amount) : 0;
    giftCards.push(
      prisma.giftCard.create({
        data: {
          code: generateGiftCardCode(),
          initialValue: amount,
          balance: amount - usedAmount,
          customerId: i < customers.length ? customers[i % customers.length].id : null,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      })
    );
  }
  await Promise.all(giftCards);
  console.log(`   ✅ Created ${giftCards.length} gift cards`);

  // Create Orders (25)
  console.log('📦 Creating orders...');
  const orderStatuses = ['PENDING', 'PICKED_UP', 'PROCESSING', 'CLEANING', 'PRESSING', 'READY', 'COMPLETED', 'DELIVERED', 'OUT_FOR_DELIVERY'];
  const orders = [];
  for (let i = 0; i < 25; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
    const isRush = Math.random() > 0.8;
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const subtotal = 20 + Math.floor(Math.random() * 100);
    const rushFee = isRush ? subtotal * 0.5 : 0;
    const tax = (subtotal + rushFee) * 0.08;
    const total = subtotal + rushFee + tax;

    orders.push(
      prisma.order.create({
        data: {
          orderNumber: `ORD-${String(1000 + i).padStart(5, '0')}`,
          customerId: customer.id,
          status,
          isRush,
          rushFee,
          subtotal,
          tax,
          total,
          paidAmount: ['COMPLETED', 'DELIVERED'].includes(status) ? total : 0,
          specialInstructions: Math.random() > 0.7 ? 'Handle with care' : null,
          createdAt,
          updatedAt: createdAt,
        },
      })
    );
  }
  const createdOrders = await Promise.all(orders);
  console.log(`   ✅ Created ${createdOrders.length} orders`);

  // Create Order Items
  console.log('👕 Creating order items...');
  const orderItems = [];
  for (const order of createdOrders) {
    const numItems = 1 + Math.floor(Math.random() * 5);
    for (let j = 0; j < numItems; j++) {
      const service = services[Math.floor(Math.random() * 5)];
      const garment = garments[Math.floor(Math.random() * 15)];
      const quantity = 1 + Math.floor(Math.random() * 3);
      const unitPrice = parseFloat(garment.basePrice);
      orderItems.push(
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            serviceId: service.id,
            garmentTypeId: garment.id,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
            status: ['COMPLETED', 'DELIVERED'].includes(order.status) ? 'COMPLETED' : 'PENDING',
            tagNumber: `TAG-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          },
        })
      );
    }
  }
  await Promise.all(orderItems);
  console.log(`   ✅ Created ${orderItems.length} order items`);

  // Create Routes (16)
  console.log('🗺️ Creating routes...');
  const routes = [];
  for (let i = 0; i < 16; i++) {
    const driver = drivers[Math.floor(Math.random() * drivers.length)];
    const daysAgo = Math.floor(Math.random() * 14);
    const routeDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    routeDate.setHours(8, 0, 0, 0);

    routes.push(
      prisma.route.create({
        data: {
          driverId: driver.id,
          date: routeDate,
          status: daysAgo > 0 ? 'COMPLETED' : (daysAgo === 0 ? 'IN_PROGRESS' : 'PLANNED'),
          startTime: daysAgo > 0 ? routeDate : null,
          endTime: daysAgo > 0 ? new Date(routeDate.getTime() + 6 * 60 * 60 * 1000) : null,
          totalDistance: daysAgo > 0 ? 25 + Math.floor(Math.random() * 50) : null,
          totalStops: 5 + Math.floor(Math.random() * 10),
        },
      })
    );
  }
  const createdRoutes = await Promise.all(routes);
  console.log(`   ✅ Created ${createdRoutes.length} routes`);

  // Create Pickups and Deliveries
  console.log('📬 Creating pickups and deliveries...');
  const pickups = [];
  const deliveries = [];
  for (let i = 0; i < Math.min(20, createdOrders.length); i++) {
    const order = createdOrders[i];
    const address = createdAddresses[i % createdAddresses.length];
    const driver = drivers[Math.floor(Math.random() * drivers.length)];
    const route = createdRoutes[Math.floor(Math.random() * createdRoutes.length)];
    const scheduledStart = new Date(order.createdAt);
    scheduledStart.setHours(9, 0, 0, 0);

    pickups.push(
      prisma.pickup.create({
        data: {
          orderId: order.id,
          addressId: address.id,
          driverId: driver.id,
          routeId: route.id,
          scheduledStart,
          scheduledEnd: new Date(scheduledStart.getTime() + 2 * 60 * 60 * 1000),
          actualTime: ['PICKED_UP', 'PROCESSING', 'COMPLETED', 'DELIVERED'].includes(order.status) ? scheduledStart : null,
          status: ['PICKED_UP', 'PROCESSING', 'COMPLETED', 'DELIVERED'].includes(order.status) ? 'COMPLETED' : 'SCHEDULED',
          notes: Math.random() > 0.7 ? 'Ring doorbell twice' : null,
        },
      })
    );

    if (['READY', 'DELIVERED', 'COMPLETED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      const deliveryStart = new Date(scheduledStart.getTime() + 2 * 24 * 60 * 60 * 1000);
      deliveries.push(
        prisma.delivery.create({
          data: {
            orderId: order.id,
            addressId: address.id,
            driverId: driver.id,
            routeId: route.id,
            scheduledStart: deliveryStart,
            scheduledEnd: new Date(deliveryStart.getTime() + 3 * 60 * 60 * 1000),
            actualTime: order.status === 'DELIVERED' ? deliveryStart : null,
            status: order.status === 'DELIVERED' ? 'DELIVERED' : (order.status === 'OUT_FOR_DELIVERY' ? 'EN_ROUTE' : 'SCHEDULED'),
          },
        })
      );
    }
  }
  await Promise.all(pickups);
  await Promise.all(deliveries);
  console.log(`   ✅ Created ${pickups.length} pickups and ${deliveries.length} deliveries`);

  // Create Quality Issues (16)
  console.log('⚠️ Creating quality issues...');
  const issueTypes = ['DAMAGE', 'STAIN_NOT_REMOVED', 'WRONG_ITEM', 'MISSING_ITEM', 'SHRINKAGE', 'COLOR_BLEEDING', 'PRESSING_ISSUE', 'ODOR', 'LOST_BUTTON', 'TORN_FABRIC', 'OTHER'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const issueStatuses = ['OPEN', 'IN_PROGRESS', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED'];

  const qualityIssues = [];
  for (let i = 0; i < 16; i++) {
    const order = createdOrders[Math.floor(Math.random() * createdOrders.length)];
    const customer = customers.find(c => c.id === order.customerId) || customers[0];
    const issueType = issueTypes[Math.floor(Math.random() * issueTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const status = issueStatuses[Math.floor(Math.random() * issueStatuses.length)];

    qualityIssues.push(
      prisma.qualityIssue.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          issueType,
          severity,
          status,
          title: `${issueType.replace('_', ' ')} Issue - Order ${order.orderNumber}`,
          description: `Customer reported ${issueType.toLowerCase().replace('_', ' ')} on items from order ${order.orderNumber}. Needs immediate attention.`,
          resolution: status === 'RESOLVED' || status === 'CLOSED' ? 'Issue has been resolved and customer compensated.' : null,
          compensationType: status === 'RESOLVED' ? ['REFUND', 'CREDIT', 'REDO_SERVICE', 'DISCOUNT'][Math.floor(Math.random() * 4)] : null,
          compensationAmount: status === 'RESOLVED' ? 10 + Math.floor(Math.random() * 40) : null,
          customerNotified: status !== 'OPEN',
          resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null,
        },
      })
    );
  }
  await Promise.all(qualityIssues);
  console.log(`   ✅ Created ${qualityIssues.length} quality issues`);

  // Create Subscriptions (16)
  console.log('📅 Creating subscriptions...');
  const subscriptions = [];
  for (let i = 0; i < 16; i++) {
    if (i >= customers.length) break;
    const customer = customers[i];
    const plan = subscriptionPlans[Math.floor(Math.random() * subscriptionPlans.length)];
    const startDate = new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000);
    const renewalDate = new Date(startDate.getTime() + (plan.billingCycle === 'MONTHLY' ? 30 : plan.billingCycle === 'BIWEEKLY' ? 14 : plan.billingCycle === 'WEEKLY' ? 7 : 365) * 24 * 60 * 60 * 1000);

    subscriptions.push(
      prisma.subscription.create({
        data: {
          customerId: customer.id,
          planId: plan.id,
          status: renewalDate > new Date() ? 'ACTIVE' : 'EXPIRED',
          startDate,
          renewalDate,
        },
      })
    );
  }
  await Promise.all(subscriptions);
  console.log(`   ✅ Created ${subscriptions.length} customer subscriptions`);

  // Create Notifications (20)
  console.log('🔔 Creating notifications...');
  const notificationTypes = ['ORDER_CONFIRMATION', 'ORDER_READY', 'PICKUP_REMINDER', 'DELIVERY_UPDATE', 'PROMOTION'];
  const notifications = [];
  for (let i = 0; i < 20; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
    const daysAgo = Math.floor(Math.random() * 14);

    const messages = {
      'ORDER_CONFIRMATION': { subject: 'Order Confirmed', message: 'Your order has been confirmed and is being processed!' },
      'ORDER_READY': { subject: 'Order Ready', message: 'Your order is ready for pickup!' },
      'PICKUP_REMINDER': { subject: 'Pickup Reminder', message: 'Reminder: Your pickup is scheduled for today!' },
      'DELIVERY_UPDATE': { subject: 'Delivery Update', message: 'Your delivery is on its way!' },
      'PROMOTION': { subject: 'Special Offer', message: 'Use code SAVE20 for 20% off your next order!' },
    };

    notifications.push(
      prisma.notification.create({
        data: {
          customerId: customer.id,
          type,
          channel: ['EMAIL', 'SMS', 'PUSH'][Math.floor(Math.random() * 3)],
          subject: messages[type].subject,
          message: messages[type].message,
          status: Math.random() > 0.2 ? 'SENT' : 'PENDING',
          sentAt: Math.random() > 0.2 ? new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) : null,
          createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        },
      })
    );
  }
  await Promise.all(notifications);
  console.log(`   ✅ Created ${notifications.length} notifications`);

  // Create AI data (20+ each)
  console.log('🤖 Creating AI data...');

  // AI Estimates
  const aiEstimates = [];
  for (let i = 0; i < 20; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    aiEstimates.push(
      prisma.aIEstimate.create({
        data: {
          customerId: customer.id,
          description: 'Customer uploaded photo of laundry items',
          estimatedItems: {
            items: [
              { type: 'Dress Shirt', quantity: Math.floor(Math.random() * 5) + 1 },
              { type: 'Pants', quantity: Math.floor(Math.random() * 3) + 1 },
              { type: 'Blouse', quantity: Math.floor(Math.random() * 2) + 1 },
            ]
          },
          totalEstimate: 25 + Math.floor(Math.random() * 75),
          confidence: 0.75 + Math.random() * 0.2,
        },
      })
    );
  }
  await Promise.all(aiEstimates);

  // AI Stain Analysis
  const stainTypes = ['Red Wine', 'Coffee', 'Grease', 'Ink', 'Blood', 'Grass', 'Oil', 'Chocolate'];
  const treatments = ['Pre-treat with enzyme cleaner', 'Apply stain remover and soak', 'Professional spot treatment required', 'Steam clean recommended'];
  const stainAnalyses = [];
  for (let i = 0; i < 20; i++) {
    stainAnalyses.push(
      prisma.aIStainAnalysis.create({
        data: {
          stainType: stainTypes[Math.floor(Math.random() * stainTypes.length)],
          treatment: treatments[Math.floor(Math.random() * treatments.length)],
          confidence: 0.7 + Math.random() * 0.25,
        },
      })
    );
  }
  await Promise.all(stainAnalyses);

  // AI Demand Predictions
  const demandPredictions = [];
  for (let i = 0; i < 30; i++) {
    const location = locations[Math.floor(Math.random() * locations.length)];
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + i);

    demandPredictions.push(
      prisma.aIDemandPrediction.create({
        data: {
          locationId: location.id,
          date: futureDate,
          predictedOrders: 15 + Math.floor(Math.random() * 35),
          predictedRevenue: 500 + Math.floor(Math.random() * 1500),
          confidence: 0.65 + Math.random() * 0.3,
        },
      })
    );
  }
  await Promise.all(demandPredictions);
  console.log(`   ✅ Created ${aiEstimates.length} AI estimates, ${stainAnalyses.length} stain analyses, ${demandPredictions.length} demand predictions`);

  // Create Driver Locations (for real-time tracking demo)
  console.log('📍 Creating driver location history...');
  const driverLocations = [];
  for (const driver of drivers.slice(0, 5)) {
    for (let i = 0; i < 10; i++) {
      const baseLat = 40.7128;
      const baseLng = -74.0060;
      driverLocations.push(
        prisma.driverLocation.create({
          data: {
            driverId: driver.id,
            latitude: baseLat + (Math.random() - 0.5) * 0.1,
            longitude: baseLng + (Math.random() - 0.5) * 0.1,
            heading: Math.floor(Math.random() * 360),
            speed: 10 + Math.floor(Math.random() * 30),
            accuracy: 5 + Math.floor(Math.random() * 10),
            batteryLevel: 50 + Math.floor(Math.random() * 50),
            timestamp: new Date(Date.now() - i * 5 * 60 * 1000),
          },
        })
      );
    }
  }
  await Promise.all(driverLocations);
  console.log(`   ✅ Created ${driverLocations.length} driver location records`);

  // Create Order Tracking history
  console.log('📊 Creating order tracking history...');
  const orderTrackings = [];
  for (const order of createdOrders.slice(0, 15)) {
    const trackingStatuses = ['ORDER_CREATED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY'];
    for (let i = 0; i < trackingStatuses.length; i++) {
      orderTrackings.push(
        prisma.orderTracking.create({
          data: {
            orderId: order.id,
            status: trackingStatuses[i],
            note: `Order ${trackingStatuses[i].toLowerCase().replace('_', ' ')}`,
            latitude: 40.7128 + (Math.random() - 0.5) * 0.05,
            longitude: -74.0060 + (Math.random() - 0.5) * 0.05,
            timestamp: new Date(Date.now() - (trackingStatuses.length - i) * 60 * 60 * 1000),
          },
        })
      );
    }
  }
  await Promise.all(orderTrackings);
  console.log(`   ✅ Created ${orderTrackings.length} order tracking records`);

  // Summary
  console.log('\n========================================');
  console.log('✅ Database seeding completed successfully!');
  console.log('========================================\n');
  console.log('📊 Data Summary:');
  console.log(`   • ${locations.length} locations`);
  console.log(`   • ${staff.length} staff members`);
  console.log(`   • ${services.length} services`);
  console.log(`   • ${garments.length} garment types`);
  console.log(`   • ${alterationTypes.length} alteration types`);
  console.log(`   • ${subscriptionPlans.length} subscription plans`);
  console.log(`   • ${coupons.length} coupons`);
  console.log(`   • ${customers.length} customers`);
  console.log(`   • ${createdAddresses.length} addresses`);
  console.log(`   • ${machines.length} machines`);
  console.log(`   • ${drivers.length} drivers`);
  console.log(`   • ${lockers.length} lockers`);
  console.log(`   • ${giftCards.length} gift cards`);
  console.log(`   • ${createdOrders.length} orders`);
  console.log(`   • ${createdRoutes.length} routes`);
  console.log(`   • ${qualityIssues.length} quality issues`);
  console.log(`   • ${subscriptions.length} subscriptions`);
  console.log(`   • ${notifications.length} notifications`);
  console.log('\n🔑 Test credentials (all use password123):');
  console.log('   • Admin: admin@laundry.com');
  console.log('   • Manager: manager@laundry.com');
  console.log('   • Driver: driver1@laundry.com');
  console.log('   • Customer: john.smith@email.com');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
