import { TenantMembershipRole, type Prisma, type PrismaClient } from '@prisma/client';
import type { Session } from 'next-auth';

import { prisma } from '@/server/db/client';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export type TenantAccess = {
  tenantId: string;
  userId: string;
  role: TenantMembershipRole;
  canEdit: boolean;
};

const personalTenantName = (user: { name?: string | null; email: string }) =>
  user.name?.trim() || user.email;

export async function ensurePersonalTenantForUser(
  client: PrismaExecutor,
  user: { id: string; email: string; name?: string | null }
) {
  const existingMembership = await client.tenantMembership.findFirst({
    where: { userId: user.id },
    select: { tenantId: true }
  });

  if (existingMembership) {
    await client.user.updateMany({
      where: {
        id: user.id,
        activeTenantId: null
      },
      data: {
        activeTenantId: existingMembership.tenantId
      }
    });
    return existingMembership.tenantId;
  }

  const tenant = await client.tenant.create({
    data: {
      name: personalTenantName(user),
      memberships: {
        create: {
          userId: user.id,
          role: TenantMembershipRole.OWNER
        }
      }
    },
    select: { id: true }
  });

  await client.user.update({
    where: { id: user.id },
    data: { activeTenantId: tenant.id }
  });

  return tenant.id;
}

export async function getTenantAccessForUser(userId: string): Promise<TenantAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, activeTenantId: true }
  });

  if (!user) {
    return null;
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      userId,
      ...(user.activeTenantId ? { tenantId: user.activeTenantId } : {})
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      tenantId: true,
      userId: true,
      role: true
    }
  });
  const membership =
    memberships.find((candidate) => candidate.role === TenantMembershipRole.OWNER) ??
    memberships[0];

  if (!membership) {
    if (user.activeTenantId) {
      await prisma.user.update({
        where: { id: userId },
        data: { activeTenantId: null }
      });
      return getTenantAccessForUser(userId);
    }

    const tenantId = await ensurePersonalTenantForUser(prisma, user);

    return {
      tenantId,
      userId,
      role: TenantMembershipRole.OWNER,
      canEdit: true
    };
  }

  return {
    ...membership,
    canEdit: membership.role === TenantMembershipRole.OWNER
  };
}

export async function getTenantAccessForSession(
  session: Pick<Session, 'user'> | null | undefined
): Promise<TenantAccess | null> {
  if (!session?.user?.id) {
    return null;
  }

  return getTenantAccessForUser(session.user.id);
}
