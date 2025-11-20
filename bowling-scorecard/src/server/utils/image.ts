import { Buffer } from 'node:buffer';
import { logger } from './logger';

const heicMediaTypes = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence'
]);

interface ParsedDataUrl {
  mediaType: string;
  base64Data: string;
}

const parseAnyDataUrl = (dataUrl: string): ParsedDataUrl => {
  const matches = /^data:(?<mediaType>[^;]+);base64,(?<data>.+)$/u.exec(dataUrl);
  if (!matches?.groups?.mediaType || !matches?.groups?.data) {
    throw new Error('Invalid image data URL');
  }

  return {
    mediaType: matches.groups.mediaType.toLowerCase(),
    base64Data: matches.groups.data
  };
};

export interface NormalizedImagePayload {
  dataUrl: string;
  targetMediaType: string;
  converted: boolean;
}

export const dataUrlToBuffer = (dataUrl: string) => {
  const parsed = parseAnyDataUrl(dataUrl);
  return {
    buffer: Buffer.from(parsed.base64Data, 'base64'),
    mediaType: parsed.mediaType
  };
};

export const normalizeImageDataUrl = async (dataUrl: string): Promise<NormalizedImagePayload> => {
  const parsed = parseAnyDataUrl(dataUrl);

  if (!heicMediaTypes.has(parsed.mediaType)) {
    return {
      dataUrl,
      targetMediaType: parsed.mediaType,
      converted: false
    };
  }

  try {
    const { default: heicConvert } = await import('heic-convert');
    const inputBuffer = Buffer.from(parsed.base64Data, 'base64');
    const convertedBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.92
    });
    const outputBuffer = Buffer.isBuffer(convertedBuffer)
      ? convertedBuffer
      : Buffer.from(convertedBuffer);
    const convertedBase64 = outputBuffer.toString('base64');
    return {
      dataUrl: `data:image/jpeg;base64,${convertedBase64}`,
      targetMediaType: 'image/jpeg',
      converted: true
    };
  } catch (error) {
    logger.warn('Failed to convert HEIC image, using original payload', {
      error: error instanceof Error ? error.message : error
    });
    return {
      dataUrl,
      targetMediaType: parsed.mediaType,
      converted: false
    };
  }
};
