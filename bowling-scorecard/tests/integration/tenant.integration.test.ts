import { TenantMembershipRole } from '@prisma/client';

import { getTenantAccessForUser } from '@/server/auth/tenant';
import { prisma } from '@/server/db/client';
import { createTenantUserFixture, resetDatabase } from './helpers';

describe('tenant access invariants', () => {
  beforeEach(resetDatabase);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('grants edit access to owners and read-only access to members', async () => {
    const owner = await createTenantUserFixture('tenant-owner');
    const member = await prisma.user.create({
      data: {
        email: 'tenant-member@example.test',
        activeTenantId: owner.tenant.id,
        tenantMemberships: {
          create: { tenantId: owner.tenant.id, role: TenantMembershipRole.MEMBER }
        }
      }
    });

    await expect(getTenantAccessForUser(owner.user.id)).resolves.toMatchObject({
      tenantId: owner.tenant.id,
      role: 'OWNER',
      canEdit: true
    });
    await expect(getTenantAccessForUser(member.id)).resolves.toMatchObject({
      tenantId: owner.tenant.id,
      role: 'MEMBER',
      canEdit: false
    });
  });

  it('repairs an invalid active tenant and falls back to an owned membership', async () => {
    const first = await createTenantUserFixture('fallback-owner');
    const unrelated = await createTenantUserFixture('unrelated-owner');
    await prisma.user.update({
      where: { id: first.user.id },
      data: { activeTenantId: unrelated.tenant.id }
    });

    await expect(getTenantAccessForUser(first.user.id)).resolves.toMatchObject({
      tenantId: first.tenant.id,
      role: 'OWNER',
      canEdit: true
    });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: first.user.id } })).resolves.toMatchObject({
      activeTenantId: null
    });
  });

  it('cascades tenant-owned records when a tenant is deleted', async () => {
    const fixture = await createTenantUserFixture('cascade-owner');
    await prisma.player.create({
      data: {
        name: 'Cascade Player',
        normalizedName: 'cascade player',
        tenantId: fixture.tenant.id,
        userId: fixture.user.id
      }
    });
    await prisma.bowlingTeam.create({
      data: {
        name: 'Cascade Team',
        normalizedName: 'cascade team',
        tenantId: fixture.tenant.id,
        userId: fixture.user.id
      }
    });

    await prisma.tenant.delete({ where: { id: fixture.tenant.id } });

    await expect(prisma.tenantMembership.count()).resolves.toBe(0);
    await expect(prisma.player.count()).resolves.toBe(0);
    await expect(prisma.bowlingTeam.count()).resolves.toBe(0);
    await expect(prisma.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).resolves.toMatchObject({
      activeTenantId: null
    });
  });
});
