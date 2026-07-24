import type { Player, Prisma, PrismaClient } from '@prisma/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export const normalizePlayerName = (name: string) => name.trim().replace(/\s+/gu, ' ');

export const normalizePlayerLookupName = (name: string) => normalizePlayerName(name).toLowerCase();

export async function findOrCreatePlayerForName(
  client: PrismaExecutor,
  tenantId: string,
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
      tenantId_normalizedName: {
        tenantId,
        normalizedName: normalizePlayerLookupName(name)
      }
    },
    update: {
      name
    },
    create: {
      userId,
      tenantId,
      name,
      normalizedName: normalizePlayerLookupName(name)
    }
  });
}
