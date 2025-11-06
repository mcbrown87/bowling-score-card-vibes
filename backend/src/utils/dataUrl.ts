const allowedMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedMediaType = (typeof allowedMediaTypes)[number];

export interface ParsedDataUrl {
  mediaType: AllowedMediaType;
  base64Data: string;
}

export const parseDataUrl = (dataUrl: string): ParsedDataUrl => {
  const matches = /^data:(?<mediaType>[^;]+);base64,(?<data>.+)$/u.exec(dataUrl);
  if (!matches?.groups?.mediaType || !matches?.groups?.data) {
    throw new Error('Invalid image data URL');
  }

  const mediaType = allowedMediaTypes.includes(matches.groups.mediaType as AllowedMediaType)
    ? (matches.groups.mediaType as AllowedMediaType)
    : 'image/jpeg';

  return {
    mediaType,
    base64Data: matches.groups.data
  };
};
