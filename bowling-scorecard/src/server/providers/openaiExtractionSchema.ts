import { z } from 'zod';

const rollSchema = z.object({
  pins: z.number().int().min(0).max(10),
  isSplit: z.boolean()
});

const regularFrameSchema = z.object({
  frameNumber: z.number().int().min(1).max(9),
  rolls: z.array(rollSchema).min(1).max(2),
  isStrike: z.boolean(),
  isSpare: z.boolean(),
  runningTotal: z.number().int().min(0).max(300)
});

const tenthFrameSchema = z.object({
  rolls: z.array(rollSchema).min(2).max(3),
  isStrike: z.boolean(),
  isSpare: z.boolean(),
  runningTotal: z.number().int().min(0).max(300)
});

const playerSchema = z.object({
  playerName: z.string().min(1),
  frames: z.array(regularFrameSchema).length(9),
  tenthFrame: tenthFrameSchema,
  totalScore: z.number().int().min(0).max(300)
});

export const openaiExtractionSchema = z.object({
  success: z.boolean(),
  failureReason: z.string().max(200).nullable(),
  players: z.array(playerSchema)
});

export type OpenAIExtractionPayload = z.infer<typeof openaiExtractionSchema>;
