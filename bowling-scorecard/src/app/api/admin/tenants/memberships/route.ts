import { TenantMembershipRole, type Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/auth/admin';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

const createTenantSchema = z.object({
  tenantName: z.string().trim().min(1).max(100)
});

const upsertMembershipSchema = z.object({
  tenantId: z.string().min(1),
  userEmail: z.string().email(),
  role: z.nativeEnum(TenantMembershipRole).default(TenantMembershipRole.MEMBER)
});

const updateMembershipRoleSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  role: z.nativeEnum(TenantMembershipRole)
});

const updateTenantSchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().trim().min(1).max(100)
});

const setActiveTenantSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  setActiveTenant: z.literal(true)
});

const deleteMembershipSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().min(1)
});

type TenancyTransaction = Prisma.TransactionClient;

const requireAdminSession = async () => {
  const { session, isAdmin } = await requireAdmin();

  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    };
  }

  if (!isAdmin) {
    return {
      response: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    };
  }

  return { response: null };
};

const getTenantsPayload = async () => {
  const tenants = await prisma.tenant.findMany({
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      createdAt: true,
      memberships: {
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              activeTenantId: true
            }
          }
        }
      },
      _count: {
        select: {
          storedImages: true,
          players: true,
          bowlingTeams: true
        }
      }
    }
  });

  return tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.createdAt.toISOString(),
    imageCount: tenant._count.storedImages,
    playerCount: tenant._count.players,
    teamCount: tenant._count.bowlingTeams,
    members: tenant.memberships.map((membership) => ({
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      isActiveTenant: membership.user.activeTenantId === tenant.id
    }))
  }));
};

const getUsersPayload = async () => {
  const users = await prisma.user.findMany({
    orderBy: [{ email: 'asc' }],
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  return users;
};

const getAdminTenancyPayload = async () => ({
  tenants: await getTenantsPayload(),
  users: await getUsersPayload()
});

const assertTenantExists = async (tx: TenancyTransaction, tenantId: string) => {
  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true }
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  return tenant;
};

const assertCanRemoveOwner = async (tx: TenancyTransaction, tenantId: string, userId: string) => {
  const membership = await tx.tenantMembership.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId
      }
    },
    select: {
      role: true,
      user: {
        select: {
          email: true
        }
      },
      tenant: {
        select: {
          name: true,
          _count: {
            select: {
              storedImages: true,
              players: true,
              bowlingTeams: true
            }
          }
        }
      }
    }
  });

  if (!membership) {
    throw new Error('Tenant membership not found.');
  }

  if (membership.role !== TenantMembershipRole.OWNER) {
    return;
  }

  const remainingOwnerCount = await tx.tenantMembership.count({
    where: {
      tenantId,
      role: TenantMembershipRole.OWNER,
      userId: {
        not: userId
      }
    }
  });
  const remainingMemberCount = await tx.tenantMembership.count({
    where: {
      tenantId,
      userId: {
        not: userId
      }
    }
  });

  const hasTenantData =
    membership.tenant._count.storedImages > 0 ||
    membership.tenant._count.players > 0 ||
    membership.tenant._count.bowlingTeams > 0;

  if (remainingOwnerCount === 0 && (hasTenantData || remainingMemberCount > 0)) {
    throw new Error(
      `Cannot remove ${membership.user.email}; ${membership.tenant.name} would have no owner.`
    );
  }
};

const updateActiveTenantAfterRemoval = async (
  tx: TenancyTransaction,
  tenantId: string,
  userId: string
) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { activeTenantId: true }
  });

  if (user?.activeTenantId !== tenantId) {
    return;
  }

  const fallbackMembership = await tx.tenantMembership.findFirst({
    where: {
      userId,
      tenantId: {
        not: tenantId
      }
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    select: { tenantId: true }
  });

  await tx.user.update({
    where: { id: userId },
    data: { activeTenantId: fallbackMembership?.tenantId ?? null }
  });
};

export async function GET() {
  const { response } = await requireAdminSession();
  if (response) {
    return response;
  }

  return NextResponse.json({
    success: true,
    ...(await getAdminTenancyPayload())
  });
}

export async function POST(request: Request) {
  const { response } = await requireAdminSession();
  if (response) {
    return response;
  }

  try {
    const parsed = createTenantSchema.parse(await request.json());

    const tenant = await prisma.tenant.create({
      data: {
        name: parsed.tenantName
      },
      select: { id: true, name: true }
    });

    return NextResponse.json({
      success: true,
      tenant,
      ...(await getAdminTenancyPayload())
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors.map((issue) => issue.message).join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tenant'
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  const { response } = await requireAdminSession();
  if (response) {
    return response;
  }

  try {
    const parsed = upsertMembershipSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { email: parsed.userEmail },
        select: { id: true, email: true, name: true }
      });

      if (!user) {
        throw new Error(`User not found: ${parsed.userEmail}`);
      }

      const tenant = await assertTenantExists(tx, parsed.tenantId);
      const currentMembership = await tx.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId: user.id
          }
        },
        select: { role: true }
      });

      if (
        currentMembership?.role === TenantMembershipRole.OWNER &&
        parsed.role !== TenantMembershipRole.OWNER
      ) {
        await assertCanRemoveOwner(tx, tenant.id, user.id);
      }

      const membership = await tx.tenantMembership.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenant.id,
            userId: user.id
          }
        },
        update: {
          role: parsed.role
        },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          role: parsed.role
        },
        select: {
          tenantId: true,
          userId: true,
          role: true
        }
      });

      return { tenant, user, membership };
    });

    return NextResponse.json({
      success: true,
      ...result,
      ...(await getAdminTenancyPayload())
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors.map((issue) => issue.message).join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tenant membership'
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const { response } = await requireAdminSession();
  if (response) {
    return response;
  }

  try {
    const body = await request.json();

    if (body && typeof body === 'object' && 'tenantName' in body) {
      const parsed = updateTenantSchema.parse(body);
      const tenant = await prisma.tenant.update({
        where: { id: parsed.tenantId },
        data: { name: parsed.tenantName },
        select: { id: true, name: true }
      });

      return NextResponse.json({
        success: true,
        tenant,
        ...(await getAdminTenancyPayload())
      });
    }

    if (body && typeof body === 'object' && 'setActiveTenant' in body) {
      const parsed = setActiveTenantSchema.parse(body);

      const result = await prisma.$transaction(async (tx) => {
        const membership = await tx.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: parsed.tenantId,
              userId: parsed.userId
            }
          },
          select: {
            tenantId: true,
            userId: true,
            role: true,
            user: {
              select: {
                email: true,
                name: true
              }
            },
            tenant: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        if (!membership) {
          throw new Error('Tenant membership not found.');
        }

        await tx.user.update({
          where: { id: parsed.userId },
          data: { activeTenantId: parsed.tenantId }
        });

        return { membership };
      });

      return NextResponse.json({
        success: true,
        ...result,
        ...(await getAdminTenancyPayload())
      });
    }

    const parsed = updateMembershipRoleSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      await assertTenantExists(tx, parsed.tenantId);

      const currentMembership = await tx.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: parsed.tenantId,
            userId: parsed.userId
          }
        },
        select: { role: true }
      });

      if (!currentMembership) {
        throw new Error('Tenant membership not found.');
      }

      if (
        currentMembership.role === TenantMembershipRole.OWNER &&
        parsed.role !== TenantMembershipRole.OWNER
      ) {
        await assertCanRemoveOwner(tx, parsed.tenantId, parsed.userId);
      }

      const membership = await tx.tenantMembership.update({
        where: {
          tenantId_userId: {
            tenantId: parsed.tenantId,
            userId: parsed.userId
          }
        },
        data: { role: parsed.role },
        select: {
          tenantId: true,
          userId: true,
          role: true,
          user: {
            select: {
              email: true,
              name: true
            }
          },
          tenant: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      return { membership };
    });

    return NextResponse.json({
      success: true,
      ...result,
      ...(await getAdminTenancyPayload())
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors.map((issue) => issue.message).join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tenant membership'
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const { response } = await requireAdminSession();
  if (response) {
    return response;
  }

  try {
    const parsed = deleteMembershipSchema.parse(await request.json());

    const result = await prisma.$transaction(async (tx) => {
      await assertTenantExists(tx, parsed.tenantId);
      await assertCanRemoveOwner(tx, parsed.tenantId, parsed.userId);

      const membership = await tx.tenantMembership.delete({
        where: {
          tenantId_userId: {
            tenantId: parsed.tenantId,
            userId: parsed.userId
          }
        },
        select: {
          tenantId: true,
          userId: true,
          role: true,
          user: {
            select: {
              email: true,
              name: true
            }
          },
          tenant: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await updateActiveTenantAfterRemoval(tx, parsed.tenantId, parsed.userId);

      return { membership };
    });

    return NextResponse.json({
      success: true,
      ...result,
      ...(await getAdminTenancyPayload())
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors.map((issue) => issue.message).join('; ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove tenant membership'
      },
      { status: 400 }
    );
  }
}
