import { NextResponse } from 'next/server';

import { requireAdmin } from '@/server/auth/admin';
import { buildValidatedScoreDatasetZipExport } from '@/server/services/localModelArtifacts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { session, isAdmin } = await requireAdmin();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const exportedDate = new Date().toISOString().slice(0, 10);
  const body = await buildValidatedScoreDatasetZipExport();

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="bowling-validated-scores-${exportedDate}.zip"`
    }
  });
}
