import { prisma } from '@/server/db/client';
import { findOrCreatePlayerForName } from '@/server/services/players';
import { createTenantUserFixture, resetDatabase } from './helpers';

describe('Prisma persistence', () => {
  beforeEach(resetDatabase);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('normalizes players within a tenant while keeping tenants isolated', async () => {
    const first = await createTenantUserFixture('first');
    const second = await createTenantUserFixture('second');

    const firstPlayer = await findOrCreatePlayerForName(
      prisma,
      first.tenant.id,
      first.user.id,
      '  Jane   Bowler '
    );
    const samePlayer = await findOrCreatePlayerForName(
      prisma,
      first.tenant.id,
      first.user.id,
      'jane bowler'
    );
    const otherTenantPlayer = await findOrCreatePlayerForName(
      prisma,
      second.tenant.id,
      second.user.id,
      'Jane Bowler'
    );

    expect(samePlayer?.id).toBe(firstPlayer?.id);
    expect(otherTenantPlayer?.id).not.toBe(firstPlayer?.id);
    await expect(prisma.player.count()).resolves.toBe(2);
  });

  it('rolls back all writes when a transaction fails', async () => {
    const fixture = await createTenantUserFixture('rollback');

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.bowlingTeam.create({
          data: {
            name: 'Friday League',
            normalizedName: 'friday league',
            tenantId: fixture.tenant.id,
            userId: fixture.user.id
          }
        });
        throw new Error('stop transaction');
      })
    ).rejects.toThrow('stop transaction');

    await expect(prisma.bowlingTeam.count()).resolves.toBe(0);
  });

  it('enforces the uniqueness constraint for normalized team names', async () => {
    const fixture = await createTenantUserFixture('unique-team');
    const data = {
      name: 'Sunday League',
      normalizedName: 'sunday league',
      tenantId: fixture.tenant.id,
      userId: fixture.user.id
    };

    await prisma.bowlingTeam.create({ data });
    await expect(prisma.bowlingTeam.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  });
});
