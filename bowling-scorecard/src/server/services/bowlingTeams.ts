import type { BowlingTeam, Prisma, PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export const normalizeTeamName = (name: string) => name.trim().replace(/\s+/gu, ' ');

export const normalizeTeamLookupName = (name: string) => normalizeTeamName(name).toLowerCase();

export async function findOrCreateTeamForName(
  client: PrismaExecutor,
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
      userId_normalizedName: {
        userId,
        normalizedName: normalizeTeamLookupName(name)
      }
    },
    update: {
      name
    },
    create: {
      userId,
      name,
      normalizedName: normalizeTeamLookupName(name)
    }
  });
}
