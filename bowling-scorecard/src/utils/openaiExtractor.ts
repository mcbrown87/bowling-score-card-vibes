import OpenAI from 'openai';
import { Game, Frame, TenthFrame } from '../types/bowling';

export interface ExtractionResult {
  success: boolean;
  games?: Game[]; // Changed to support multiple games
  game?: Game;    // Keep for backward compatibility
  error?: string;
  rawResponse?: string;
}

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const extractScoresWithOpenAI = async (imageFile: string): Promise<ExtractionResult> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a bowling scoring expert. Analyze this bowling scorecard image with EXTREME PRECISION and extract ALL players' scores.

              OUTPUT FORMAT (JSON):
              {
                "players": [
                  {
                    "playerName": "string",
                    "frames": [
                      {
                        "frameNumber": 1-9,
                        "rolls": [{"pins": number}], // Individual pin counts
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

              CRITICAL SYMBOL RECOGNITION:
              - "X" = Strike (10 pins, one roll)
              - "/" = Spare (10 pins total across two rolls)
              - "-" = Gutter/miss (0 pins)
              - Numbers 1-9 = Exact pins knocked down
              - Circled numbers = Splits (treat as regular numbers)

              BOWLING SCORING RULES (FOLLOW EXACTLY):
              
              1. REGULAR FRAMES (1-9):
                 - Strike: 10 + next 2 rolls
                 - Spare: 10 + next 1 roll  
                 - Open frame: Just the pins knocked down
                 - Running total = previous total + this frame's score
              
              2. 10TH FRAME (SPECIAL):
                 - Strike: Roll 2 more balls, add all 3 to score
                 - Spare: Roll 1 more ball, add all 3 to score
                 - Open: Only 2 rolls, add both to score
              
              3. VALIDATION CHECKS:
                 - Each frame's running total MUST be >= previous frame
                 - Maximum possible score = 300 (12 strikes)
                 - Two rolls in a frame cannot exceed 10 (unless 10th frame)
                 - Running totals should increase logically

              ACCURACY INSTRUCTIONS:
              - Look at EACH number/symbol individually
              - Pay attention to small vs large numbers (pins vs totals)
              - Running totals are usually in boxes below the pins
              - Pin counts are usually smaller, in the top portion
              - If a number is unclear, use surrounding context
              - Player names are usually on the left side
              - Double-check that your math follows bowling rules

              QUALITY REQUIREMENTS:
              - Extract ALL visible players (multiple rows/people)
              - Ensure running totals make mathematical sense
              - If you can't read a number clearly, make a reasonable estimate
              - Prioritize accuracy over completeness
              - Return complete, valid JSON with all brackets closed

              Focus on precision - bowling scores follow strict mathematical rules!`
            },
            {
              type: "image_url",
              image_url: {
                url: imageFile,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: 'No response from OpenAI'
      };
    }

    console.log('OpenAI Response:', content);

    // Extract JSON from the response - handle both ```json blocks and raw JSON
    let jsonText = '';
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      const rawJsonMatch = content.match(/\{[\s\S]*\}/);
      if (rawJsonMatch) {
        jsonText = rawJsonMatch[0];
      }
    }
    
    if (!jsonText) {
      return {
        success: false,
        error: 'Could not find JSON in OpenAI response',
        rawResponse: content
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
          rawResponse: content
        };
      }
      
      return {
        success: true,
        games,
        game: games[0], // For backward compatibility
        rawResponse: content
      };
    } catch (parseError) {
      return {
        success: false,
        error: `Failed to parse extracted data: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        rawResponse: content
      };
    }

  } catch (error) {
    return {
      success: false,
      error: `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    playerName: extractedData.playerName || 'Extracted Player'
  };
};
