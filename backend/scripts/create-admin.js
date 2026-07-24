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
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.staff.upsert({
    where: { email },
    create: { email, firstName, lastName, passwordHash, role: StaffRole.ADMIN, isActive: true, authVersion: 1 },
    update: { firstName, lastName, passwordHash, role: StaffRole.ADMIN, isActive: true, authVersion: { increment: existing ? 1 : 0 } },
  });
  console.log(`Initial staff administrator is ready for ${email}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
