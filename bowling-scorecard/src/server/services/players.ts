import type { Player, Prisma, PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/gu, ' ');

export const normalizePlayerLookupName = (name: string) => normalizePlayerName(name).toLowerCase();

export async function findOrCreatePlayerForName(
  client: PrismaExecutor,
  userId: string,
  playerName?: string | null
): Promise<Player | null> {
  if (!playerName) {
    return null;
  }

  const name = normalizePlayerName(playerName);

  if (!name) {
    return null;
  }

  return client.player.upsert({
    where: {
      userId_normalizedName: {
        userId,
        normalizedName: normalizePlayerLookupName(name)
      }
    },
    update: {
      name
    },
    create: {
      userId,
      name,
      normalizedName: normalizePlayerLookupName(name)
    }
  });
}
