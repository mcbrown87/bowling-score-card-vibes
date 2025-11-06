import Anthropic from '@anthropic-ai/sdk';
import type { ProviderRequest, ProviderResult } from './types.js';
import { parseDataUrl } from '../utils/dataUrl.js';
import { extractJsonFromText } from '../utils/parseJsonFromText.js';
import { convertExtractionPayload } from '../utils/convertExtractedData.js';
import type { ExtractionPayload } from '../types/bowling.js';

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
  }

  return new Anthropic({ apiKey });
};

export const anthropicProvider = async ({ imageDataUrl, prompt }: ProviderRequest): Promise<ProviderResult> => {
  const client = getClient();
  const { mediaType, base64Data } = parseDataUrl(imageDataUrl);

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-3-7-sonnet-latest',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ]
  });

  const textPart = response.content.find((item) => item.type === 'text');
  if (!textPart || textPart.type !== 'text') {
    throw new Error('Claude response did not include text content');
  }

  try {
    const parsed = extractJsonFromText(textPart.text) as ExtractionPayload;
    const games = convertExtractionPayload(parsed);

    if (games.length === 0) {
      throw new Error('Claude response did not include valid player data');
    }

    return {
      rawText: textPart.text,
      games
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const snippet = textPart.text.slice(0, 10000);
    try {
      const { writeFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const debugPath = resolve(process.cwd(), 'anthropic-debug.json');
      writeFileSync(debugPath, textPart.text, 'utf8');
    } catch {
      // ignore secondary errors when logging
    }
    throw new Error(`${message}. Raw response snippet: ${snippet}`);
  }
};
