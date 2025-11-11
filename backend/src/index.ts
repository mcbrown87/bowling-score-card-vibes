import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { BOWLING_EXTRACTION_PROMPT } from './prompts/bowling.js';
import { runProvider } from './providers/index.js';
import type { ProviderName } from './providers/types.js';
import { logger } from './utils/logger.js';
import { normalizeImageDataUrl } from './utils/image.js';

const PORT = Number(process.env.PORT) || 4000;
const DEFAULT_PROVIDER = (process.env.DEFAULT_PROVIDER as ProviderName) ?? 'anthropic';
const MAX_BODY_SIZE = process.env.REQUEST_BODY_LIMIT ?? '8mb';

const app = express();
app.use(cors());
app.use(express.json({ limit: MAX_BODY_SIZE }));

app.use((req, res, next) => {
  const requestId = randomUUID();
  const start = Date.now();

  res.locals.requestId = requestId;

  const baseAttributes = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.header('user-agent') ?? 'unknown',
    contentLength: req.header('content-length')
      ? Number.parseInt(req.header('content-length') ?? '0', 10)
      : undefined
  };

  logger.info('Incoming request', baseAttributes);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const attributes = {
      ...baseAttributes,
      statusCode: res.statusCode,
      durationMs
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', undefined, attributes);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', attributes);
    } else {
      logger.info('Request completed successfully', attributes);
    }
  });

  next();
});

const requestSchema = z.object({
  imageDataUrl: z.string().regex(/^data:.*;base64,/u, 'imageDataUrl must be a base64 data URL'),
  provider: z.enum(['anthropic', 'openai']).optional(),
  prompt: z.string().optional()
});

const clientLogSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  message: z.string().min(1),
  stack: z.string().optional(),
  context: z.record(z.any()).optional()
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    provider: DEFAULT_PROVIDER
  });
});

app.post('/api/extract-scores', async (req: Request, res: Response) => {
  try {
    const parsed = requestSchema.parse(req.body);
    const provider = parsed.provider ?? DEFAULT_PROVIDER;
    const requestId = res.locals.requestId as string | undefined;

    const [prefix, base64Payload] = parsed.imageDataUrl.split(',', 2);
    const imageMetadata = prefix?.split(';')[0]?.replace('data:', '') ?? 'unknown';
    const base64Length = base64Payload?.length ?? 0;
    const estimatedBytes = Math.ceil((base64Length * 3) / 4);

    logger.info('Processing extract-scores request', {
      provider,
      requestId,
      imageMetadata,
      base64Length,
      estimatedBytes,
      includeRawResponse: process.env.INCLUDE_LLM_RAW === 'true'
    });

    const normalizedImage = await normalizeImageDataUrl(parsed.imageDataUrl);

    const result = await runProvider(provider, {
      imageDataUrl: normalizedImage.dataUrl,
      prompt: parsed.prompt ?? BOWLING_EXTRACTION_PROMPT
    });

    logger.info('Extracted bowling scores successfully', {
      provider,
      requestId,
      gameCount: result.games.length,
      convertedImage: normalizedImage.converted
    });

    res.json({
      success: true,
      provider,
      games: result.games,
      normalizedImageDataUrl: normalizedImage.dataUrl,
      rawResponse: process.env.INCLUDE_LLM_RAW === 'true' ? result.rawText : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = message.includes('Missing') ? 500 : 400;
    const requestId = res.locals.requestId as string | undefined;

    logger.error('Failed to extract bowling scores', error, {
      statusCode,
      requestId
    });

    res.status(statusCode).json({
      success: false,
      error: message
    });
  }
});

app.post('/api/client-logs', (req: Request, res: Response) => {
  try {
    const payload = clientLogSchema.parse(req.body);
    const requestId = res.locals.requestId as string | undefined;
    const userAgent = req.header('user-agent') ?? 'unknown';

    const attributes = {
      ...payload.context,
      requestId,
      userAgent,
      clientStack: payload.stack,
      source: 'client'
    };

    switch (payload.level) {
      case 'error':
        logger.error(payload.message, undefined, attributes);
        break;
      case 'warn':
        logger.warn(payload.message, attributes);
        break;
      case 'debug':
        logger.debug(payload.message, attributes);
        break;
      default:
        logger.info(payload.message, attributes);
        break;
    }

    res.status(204).end();
  } catch (error) {
    const requestId = res.locals.requestId as string | undefined;
    logger.warn('Invalid client log payload', {
      error: error instanceof Error ? error.message : 'unknown',
      requestId
    });
    res.status(400).json({
      success: false,
      error: 'Invalid client log payload'
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

app.listen(PORT, () => {
  logger.info('Backend service started', {
    port: PORT,
    defaultProvider: DEFAULT_PROVIDER
  });
});
