import Anthropic from '@anthropic-ai/sdk';
import { Game, Frame, TenthFrame } from '../types/bowling';

export interface ExtractionResult {
  success: boolean;
  games?: Game[]; // Support multiple games
  game?: Game;    // Keep for backward compatibility
  error?: string;
  rawResponse?: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

export const extractScoresWithClaude = async (imageFile: string): Promise<ExtractionResult> => {
  try {
    // Convert data URL to base64
    const base64Data = imageFile.split(',')[1];
    
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Data
              }
            },
            {
              type: "text",
              text: `You are a bowling scoring expert with exceptional precision. Analyze this bowling scorecard image and extract ALL players' scores with EXTREME ACCURACY.

              OUTPUT FORMAT (JSON only, no other text):
              {
                "players": [
                  {
                    "playerName": "string",
                    "frames": [
                      {
                        "frameNumber": 1-9,
                        "rolls": [{"pins": number}], // Individual pin counts per roll
                        "isStrike": boolean,
                        "isSpare": boolean,
                        "runningTotal": number // CUMULATIVE total score through this frame
                      }
                    ],
                    "tenthFrame": {
                      "rolls": [{"pins": number}], // Up to 3 rolls if strike/spare
                      "isStrike": boolean,
                      "isSpare": boolean,
                      "runningTotal": number // Final game total
                    },
                    "totalScore": number // Must equal tenthFrame.runningTotal
                  }
                ]
              }

              CRITICAL ANALYSIS INSTRUCTIONS:

              1. VISUAL INSPECTION:
                 - Look at EACH cell individually
                 - Small numbers at top = individual pins knocked down
                 - Large numbers at bottom = cumulative running totals
                 - Player names are typically on the left side
                 - Look for multiple rows of data (multiple players)

              2. SYMBOL RECOGNITION:
                 - "X" = Strike (10 pins, one roll only)
                 - "/" = Spare (second roll completes 10 pins)
                 - "-" = Miss/gutter ball (0 pins)
                 - Numbers 1-9 = Exact pins knocked down
                 - Circled numbers = Splits (treat as regular numbers)

              3. BOWLING MATHEMATICS:
                 - Strike: 10 + next 2 rolls
                 - Spare: 10 + next 1 roll
                 - Open frame: Sum of both rolls
                 - Running totals MUST increase (never decrease)
                 - Maximum game score = 300 (perfect game)
                 - Two rolls in frames 1-9 cannot exceed 10 pins

              4. 10TH FRAME SPECIAL RULES:
                 - Strike: Get 2 bonus balls (3 total rolls)
                 - Spare: Get 1 bonus ball (3 total rolls)
                 - Open: Only 2 rolls
                 - Add all rolls in 10th frame to running total

              5. ACCURACY VERIFICATION:
                 - Check that running totals follow bowling math
                 - Verify each frame's score makes sense
                 - If unclear, use context from surrounding frames
                 - Double-check your arithmetic

              6. QUALITY STANDARDS:
                 - Extract ALL visible players on the scorecard
                 - Prioritize mathematical accuracy over speed
                 - If a number is unclear, make the most logical choice
                 - Ensure JSON is complete and properly formatted

              FOCUS: Look carefully at the actual numbers in the image. Running totals should reflect proper bowling scoring, not just adding pin counts.`
            }
          ]
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return {
        success: false,
        error: 'No text response from Claude'
      };
    }

    console.log('Claude Response:', content.text);

    // Extract JSON from the response
    let jsonText = '';
    const codeBlockMatch = content.text.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      const rawJsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (rawJsonMatch) {
        jsonText = rawJsonMatch[0];
      } else {
        // If no braces found, the entire response might be JSON
        jsonText = content.text.trim();
      }
    }
    
    if (!jsonText) {
      return {
        success: false,
        error: 'Could not find JSON in Claude response',
        rawResponse: content.text
      };
    }

    try {
      const extractedData = JSON.parse(jsonText);
      
      // Handle both old and new formats
      let games: Game[] = [];
      
      if (extractedData.players && Array.isArray(extractedData.players)) {
        // New multi-player format
        games = extractedData.players.map((playerData: any) => convertToGameFormat(playerData));
      } else if (extractedData.playerName || extractedData.frames) {
        // Old single-player format (backward compatibility)
        games = [convertToGameFormat(extractedData)];
      } else {
        return {
          success: false,
          error: 'No valid player data found in response',
          rawResponse: content.text
        };
      }
      
      return {
        success: true,
        games,
        game: games[0], // For backward compatibility
        rawResponse: content.text
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse extracted data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        rawResponse: content.text
      };
    }

  } catch (error) {
    return {
      success: false,
      error: `Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

const convertToGameFormat = (extractedData: any): Game => {
  const normalizeRolls = (rolls: any[]): { pins: number }[] =>
    Array.isArray(rolls)
      ? rolls.map((roll) => {
          if (typeof roll === 'number') {
            return { pins: roll };
          }
          const parsedPins = Number(roll?.pins ?? 0);
          return { pins: Number.isNaN(parsedPins) ? 0 : parsedPins };
        })
      : [];

  const rawFrames: any[] = Array.isArray(extractedData.frames) ? extractedData.frames : [];
  const firstNineFrames = rawFrames
    .filter((frameData) => {
      const frameNumber = Number(frameData?.frameNumber);
      return Number.isFinite(frameNumber) ? frameNumber >= 1 && frameNumber <= 9 : true;
    })
    .slice(0, 9);

  const frames: Frame[] = firstNineFrames.map((frameData: any) => ({
    rolls: normalizeRolls(frameData?.rolls),
    isStrike: Boolean(frameData?.isStrike),
    isSpare: Boolean(frameData?.isSpare),
    score: typeof frameData?.runningTotal === 'number' ? frameData.runningTotal : undefined
  }));

  while (frames.length < 9) {
    frames.push({
      rolls: [{ pins: 0 }, { pins: 0 }],
      isStrike: false,
      isSpare: false,
      score: 0
    });
  }

  const tenthFrameSource =
    extractedData.tenthFrame ??
    rawFrames.find((frameData) => Number(frameData?.frameNumber) === 10) ??
    rawFrames[9] ??
    {};

  const tenthFrameRolls = normalizeRolls(tenthFrameSource?.rolls);

  const tenthFrame: TenthFrame = {
    rolls: tenthFrameRolls.length > 0 ? tenthFrameRolls : [{ pins: 0 }],
    isStrike: Boolean(tenthFrameSource?.isStrike),
    isSpare: Boolean(tenthFrameSource?.isSpare),
    score:
      typeof tenthFrameSource?.runningTotal === 'number'
        ? tenthFrameSource.runningTotal
        : typeof extractedData.totalScore === 'number'
        ? extractedData.totalScore
        : undefined
  };

  return {
    frames,
    tenthFrame,
    totalScore: typeof extractedData.totalScore === 'number' ? extractedData.totalScore : (tenthFrame.score ?? 0),
    playerName: extractedData.playerName || 'Claude Player'
  };
};
