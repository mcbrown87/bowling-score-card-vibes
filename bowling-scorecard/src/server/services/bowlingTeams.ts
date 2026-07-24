import type { BowlingTeam, Prisma, PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export const normalizeTeamName = (name: string) => name.trim().replace(/\s+/gu, ' ');

export const normalizeTeamLookupName = (name: string) => normalizeTeamName(name).toLowerCase();

export async function findOrCreateTeamForName(
  client: PrismaExecutor,
  tenantId: string,
  userId: string,
  teamName?: string | null
): Promise<BowlingTeam | null> {
  if (!teamName) {
    return null;
  }

  const name = normalizeTeamName(teamName);

  if (!name) {
    return null;
  }

  return client.bowlingTeam.upsert({
    where: {
      tenantId_normalizedName: {
        tenantId,
        normalizedName: normalizeTeamLookupName(name)
      }
    },
    update: {
      name
    },
    create: {
      userId,
      tenantId,
      name,
      normalizedName: normalizeTeamLookupName(name)
    }
  });
}
