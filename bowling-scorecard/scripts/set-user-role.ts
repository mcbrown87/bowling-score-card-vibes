import { UserRole } from '@prisma/client';

import { prisma } from '@/server/db/client';

async function main() {
  const email = process.argv[2];
  const roleArg = process.argv[3] ?? 'ADMIN';

  if (!email) {
    throw new Error('Usage: tsx scripts/set-user-role.ts <email> [USER|ADMIN]');
  }

  if (!(roleArg in UserRole)) {
    throw new Error(`Invalid role "${roleArg}". Use USER or ADMIN.`);
  }

  const role = UserRole[roleArg as keyof typeof UserRole];

  const user = await prisma.user.update({
    where: { email },
    data: { role },
    select: { email: true, role: true }
  });

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
