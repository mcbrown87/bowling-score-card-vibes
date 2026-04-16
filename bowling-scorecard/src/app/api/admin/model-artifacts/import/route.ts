import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import { requireAdmin } from '@/server/auth/admin';
import { prisma } from '@/server/db/client';
import { importLocalModelArtifact } from '@/server/ml/client';

export const dynamic = 'force-dynamic';

const toOptionalInt = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined;

export async function POST(request: Request) {
  const { session, isAdmin } = await requireAdmin();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Artifact file is required' }, { status: 400 });
    }

    const imported = await importLocalModelArtifact(file);
    const metrics = imported.model.metrics ?? {};
    const artifact = await prisma.modelArtifact.upsert({
      where: {
        name_version: {
          name: imported.model.name,
          version: imported.model.version
        }
      },
      update: {
        architecture: imported.model.architecture,
        localPath: imported.model.localPath,
        metrics: metrics as Prisma.InputJsonValue,
        datasetImageCount: toOptionalInt(metrics.datasetImageCount),
        datasetCorrectionCount: toOptionalInt(metrics.datasetCorrectionCount)
      },
      create: {
        name: imported.model.name,
        version: imported.model.version,
        architecture: imported.model.architecture,
        localPath: imported.model.localPath,
        metrics: metrics as Prisma.InputJsonValue,
        datasetImageCount: toOptionalInt(metrics.datasetImageCount),
        datasetCorrectionCount: toOptionalInt(metrics.datasetCorrectionCount)
      }
    });

    return NextResponse.json({ success: true, artifact }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to import model artifact'
      },
      { status: 500 }
    );
  }
}
