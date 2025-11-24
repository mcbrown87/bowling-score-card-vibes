import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { getObject } from '@/server/storage/client';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    id: string;
  };
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      {
        status: 401
      }
    );
  }

  const imageId = context.params.id;

  try {
    const storedImage = await prisma.storedImage.findUnique({
      where: { id: imageId },
      select: {
        id: true,
        userId: true,
        objectKey: true,
        contentType: true
      }
    });

    if (!storedImage || storedImage.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const object = await getObject({ Key: storedImage.objectKey });

    if (!object.Body) {
      throw new Error('Storage returned an empty body');
    }

    const body = object.Body;
    const transformable = body as unknown as { transformToByteArray?: () => Promise<Uint8Array> };
    let bodyBuffer: Buffer;

    if (body instanceof Readable) {
      bodyBuffer = await streamToBuffer(body);
    } else if (typeof transformable.transformToByteArray === 'function') {
      const byteArray = await transformable.transformToByteArray();
      bodyBuffer = Buffer.from(byteArray);
    } else {
      throw new Error('Unsupported storage body type');
    }

    return new NextResponse(bodyBuffer, {
      status: 200,
      headers: {
        'Content-Type': storedImage.contentType ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=60'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load image' },
      { status: 500 }
    );
  }
}
