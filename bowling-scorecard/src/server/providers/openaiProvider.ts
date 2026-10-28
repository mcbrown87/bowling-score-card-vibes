import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { DEFAULT_OPENAI_MODEL } from '@/server/config/defaults';
import type { ExtractionPayload } from '@/types/bowling';
import { convertExtractionPayload } from '../utils/convertExtractedData';
import { extractJsonFromText } from '../utils/parseJsonFromText';
import { openaiExtractionSchema } from './openaiExtractionSchema';
import type { ProviderRequest, ProviderResult } from './types';

const ASTRA_MODEL = 'gpt-6-astra';
const SOL_MODEL = 'gpt-6.1-sol';
const STRUCTURED_RESPONSES_MODELS = new Set([ASTRA_MODEL, SOL_MODEL]);
const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

const getReasoningEffort = (model: string) => {
  const configuredEffort = process.env.OPENAI_REASONING_EFFORT;
  return (
    REASONING_EFFORTS.find((effort) => effort === configuredEffort) ??
    (model === SOL_MODEL ? 'medium' : 'low')
  );
};

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  return new OpenAI({ apiKey });
};

const usesMaxCompletionTokens = (model: string) => model.startsWith('gpt-5');

const getRefusal = (response: Awaited<ReturnType<OpenAI['responses']['parse']>>) => {
  for (const item of response.output) {
    if (item.type !== 'message') {
      continue;
    }

    const refusal = item.content.find((content) => content.type === 'refusal');
    if (refusal?.type === 'refusal') {
      return refusal.refusal;
    }
  }

  return null;
};

const runStructuredResponsesProvider = async (
  client: OpenAI,
  { imageDataUrl, prompt, model }: Required<ProviderRequest>
): Promise<ProviderResult> => {
  const response = await client.responses.parse({
    model,
    reasoning: { effort: getReasoningEffort(model) },
    max_output_tokens: 8000,
    store: false,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: prompt
          },
          {
            type: 'input_image',
            image_url: imageDataUrl,
            detail: 'high'
          }
        ]
      }
    ],
    text: {
      format: zodTextFormat(openaiExtractionSchema, 'bowling_score_extraction')
    }
  });

  if (response.status !== 'completed') {
    const reason = response.incomplete_details?.reason ?? response.status;
    throw new Error(`OpenAI response was not completed: ${reason}`);
  }

  const refusal = getRefusal(response);
  if (refusal) {
    throw new Error(`OpenAI refused the score extraction request: ${refusal}`);
  }

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error('OpenAI response did not include parsed score data');
  }

  const games = convertExtractionPayload(parsed);
  if (games.length === 0) {
    const failureReason = parsed.failureReason ? `: ${parsed.failureReason}` : '';
    throw new Error(`OpenAI response did not include valid player data${failureReason}`);
  }

  return {
    rawText: response.output_text,
    games,
    model: response.model ?? model,
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens,
          totalTokens: response.usage.total_tokens
        }
      : undefined
  };
};

const runLegacyProvider = async (
  client: OpenAI,
  { imageDataUrl, prompt, model }: Required<ProviderRequest>
): Promise<ProviderResult> => {
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

  const tokenOptions = usesMaxCompletionTokens(model)
    ? { max_completion_tokens: 4000 }
    : { max_tokens: 4000 };

  const response = await client.chat.completions.create({
    model,
    ...tokenOptions,
    temperature: 0.1,
    messages: [baseMessage]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response did not contain content');
  }

  try {
    const parsed = extractJsonFromText(content) as ExtractionPayload;
    const games = convertExtractionPayload(parsed);

    if (games.length === 0) {
      throw new Error('OpenAI response did not include valid player data');
    }

    return {
      rawText: content,
      games,
      model: response.model ?? model,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
            reasoningTokens: response.usage.completion_tokens_details?.reasoning_tokens,
            totalTokens: response.usage.total_tokens
          }
        : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const snippet = content.slice(0, 10000);
    throw new Error(`${message}. Raw response snippet: ${snippet}`);
  }
};

export const openaiProvider = async ({
  imageDataUrl,
  prompt,
  model
}: ProviderRequest): Promise<ProviderResult> => {
  const client = getClient();
  const configuredModel = model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;

  if (STRUCTURED_RESPONSES_MODELS.has(configuredModel)) {
    return runStructuredResponsesProvider(client, {
      imageDataUrl,
      prompt,
      model: configuredModel
    });
  }

  return runLegacyProvider(client, {
    imageDataUrl,
    prompt,
    model: configuredModel
  });
};
