import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAdmin } from '@/server/auth/admin';
import { prisma } from '@/server/db/client';
import { listLocalModels } from '@/server/ml/client';

export async function GET() {
  const { isAdmin } = await requireAdmin();

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const remoteModels = await listLocalModels().catch(() => ({ models: [] }));

  for (const model of remoteModels.models) {
    await prisma.modelArtifact.upsert({
      where: {
        name_version: {
          name: model.name,
          version: model.version
        }
      },
      update: {
        architecture: model.architecture,
        localPath: model.localPath,
        metrics: model.metrics as Prisma.InputJsonValue | undefined
      },
      create: {
        name: model.name,
        version: model.version,
        architecture: model.architecture,
        localPath: model.localPath,
        metrics: model.metrics as Prisma.InputJsonValue | undefined
      }
    });
  }

  const artifacts = await prisma.modelArtifact.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
  });

  return NextResponse.json({ success: true, artifacts });
}
