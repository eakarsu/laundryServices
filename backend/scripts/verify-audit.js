const { PrismaClient } = require('@prisma/client');
const { canonical, sha256 } = require('../src/services/damageClaimWorkflow');

const prisma = new PrismaClient();

async function main() {
  const claims = await prisma.damageClaim.findMany({ select: { id: true } });
  let checkedEvents = 0;
  for (const claim of claims) {
    const events = await prisma.claimAuditEvent.findMany({ where: { claimId: claim.id }, orderBy: { sequence: 'asc' } });
    let previousHash = 'GENESIS';
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const sequence = index + 1;
      const expected = sha256(canonical({
        claimId: claim.id,
        sequence,
        actorType: event.actorType,
        actorId: event.actorId,
        action: event.action,
        payload: event.payload,
        previousHash,
      }));
      if (event.sequence !== sequence || event.previousHash !== previousHash || event.eventHash !== expected) {
        throw new Error(`Audit chain invalid for claim ${claim.id} at event ${event.id}`);
      }
      previousHash = event.eventHash;
      checkedEvents += 1;
    }
  }
  console.log(`Verified ${checkedEvents} audit events across ${claims.length} claims`);
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
