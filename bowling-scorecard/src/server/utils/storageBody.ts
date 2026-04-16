import { Readable } from 'node:stream';

export const readStorageBodyToBuffer = async (body: unknown): Promise<Buffer> => {
  if (!body) {
    throw new Error('Storage returned an empty body');
  }

  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Buffer));
    }
    return Buffer.concat(chunks);
  }

  const transformable = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof transformable.transformToByteArray === 'function') {
    const byteArray = await transformable.transformToByteArray();
    return Buffer.from(byteArray);
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  throw new Error('Unsupported storage body type');
};
