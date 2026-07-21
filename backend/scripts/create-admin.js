const bcrypt = require('bcryptjs');
const { PrismaClient, StaffRole } = require('@prisma/client');

const acknowledgement = process.env.BOOTSTRAP_ACKNOWLEDGEMENT;
const email = process.env.PROVISION_ADMIN_EMAIL?.trim().toLowerCase();
const displayName = process.env.PROVISION_ADMIN_NAME?.trim() || 'Runtime Administrator';
const password = process.env.PROVISION_ADMIN_PASSWORD;

if (acknowledgement !== 'create-initial-admin') throw new Error('BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin is required');
if (!email || !password || password.length < 12) throw new Error('PROVISION_ADMIN_EMAIL and a 12+ character PROVISION_ADMIN_PASSWORD are required');

const [firstName, ...remainingName] = displayName.split(/\s+/);
const lastName = remainingName.join(' ') || 'Administrator';
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.staff.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new Error(`Refusing to replace existing staff account for ${email}`);
  await prisma.staff.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash: await bcrypt.hash(password, 12),
      role: StaffRole.ADMIN,
      isActive: true,
      authVersion: 1,
    },
  });
  console.log(`Created initial staff administrator ${email}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
