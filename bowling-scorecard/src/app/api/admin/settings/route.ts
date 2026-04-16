import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/server/auth/admin';
import { getRuntimeSettings, updateRuntimeSettings } from '@/server/config/appConfig';

const settingsSchema = z.object({
  activeProvider: z.enum(['anthropic', 'openai', 'local', 'stub']).optional(),
  openaiModel: z.string().min(1).optional(),
  anthropicModel: z.string().min(1).optional(),
  localModelArtifactId: z.string().nullable().optional(),
  localModelName: z.string().min(1).optional(),
  mlServiceUrl: z.string().url().optional()
});

export async function GET() {
  const { isAdmin } = await requireAdmin();

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const settings = await getRuntimeSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(request: Request) {
  const { isAdmin } = await requireAdmin();

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const json = await request.json();
    const updates = settingsSchema.parse(json);
    const settings = await updateRuntimeSettings(updates);

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to update settings'
      },
      { status: 400 }
    );
  }
}
