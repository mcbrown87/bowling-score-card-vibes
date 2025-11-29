import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { ProviderRequest, ProviderResult } from './types';
import { extractJsonFromText } from '../utils/parseJsonFromText';
import { convertExtractionPayload } from '../utils/convertExtractedData';
import type { ExtractionPayload } from '@/types/bowling';

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  return new OpenAI({ apiKey });
};

export const openaiProvider = async ({ imageDataUrl, prompt }: ProviderRequest): Promise<ProviderResult> => {
  const client = getClient();
  const configuredModel = process.env.OPENAI_MODEL ?? 'gpt-4o';

  const baseMessage: ChatCompletionMessageParam = {
    role: 'user',
    content: [
      {
        type: 'text',
        text: prompt
      },
      {
        type: 'image_url',
        image_url: {
          url: imageDataUrl,
          detail: 'high'
        }
      }
    ]
  };

  const messages: ChatCompletionMessageParam[] = [baseMessage];
  let lastError: Error | null = null;
  let bestResult: ProviderResult | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await client.chat.completions.create({
      model: configuredModel,
      max_tokens: 4000,
      temperature: 0.1,
      messages
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      lastError = new Error('OpenAI response did not contain content');
      break;
    }

    try {
      const parsed = extractJsonFromText(content) as ExtractionPayload;
      const games = convertExtractionPayload(parsed);

      if (games.length === 0) {
        lastError = new Error('OpenAI response did not include valid player data');
        break;
      }

      const currentResult: ProviderResult = {
        rawText: content,
        games,
        model: response.model ?? configuredModel
      };

      bestResult = currentResult;
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const snippet = content.slice(0, 10000);
      lastError = new Error(`${message}. Raw response snippet: ${snippet}`);
      break;
    }
  }

  if (bestResult) {
    return bestResult;
  }

  throw new Error(
    lastError
      ? `OpenAI response inconsistent after retries: ${lastError.message}`
      : 'OpenAI response inconsistent after retries'
  );
};
