import { TenantMembershipRole } from '@prisma/client';

import { prisma } from '@/server/db/client';

const applicationTables = [
  'bowling_scores',
  'llm_requests',
  'team_roster_player_statuses',
  'stored_images',
  'players',
  'bowling_teams',
  'sessions',
  'accounts',
  'tenant_memberships',
  'users',
  'tenants',
  'prompts',
  'app_config',
  'model_artifacts',
  'verification_tokens'
];

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${applicationTables.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`
  );
}

export async function createTenantUserFixture(label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}@example.test`, name: label }
  });
  const tenant = await prisma.tenant.create({
    data: {
      name: `${label} tenant`,
      memberships: {
        create: { userId: user.id, role: TenantMembershipRole.OWNER }
      }
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { activeTenantId: tenant.id }
  });

  return { tenant, user };
}
