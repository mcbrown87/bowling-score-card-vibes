import { NextResponse } from 'next/server';

import { requireAdmin } from '@/server/auth/admin';
import { activateModelArtifact } from '@/server/services/localModelArtifacts';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  const { isAdmin } = await requireAdmin();

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const artifact = await activateModelArtifact(context.params.id);
    return NextResponse.json({ success: true, artifact });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to activate model artifact'
      },
      { status: 400 }
    );
  }
}
