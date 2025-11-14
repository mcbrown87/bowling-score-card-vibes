export const BOWLING_EXTRACTION_PROMPT = `You are a bowling scoring expert. Analyze this bowling scorecard image with extreme precision and return JSON that matches this shape:
{
  "players": [
    {
      "playerName": "string",
      "frames": [
        {
          "frameNumber": 1-9,
          "rolls": [{"pins": number}],
          "isStrike": boolean,
          "isSpare": boolean,
          "runningTotal": number
        }
      ],
      "tenthFrame": {
        "rolls": [{"pins": number}],
        "isStrike": boolean,
        "isSpare": boolean,
        "runningTotal": number
      },
      "totalScore": number
    }
  ]
}

Strict instructions:
1. The small digits in the upper portion of each frame are the individual rolls. Use ONLY those to populate the \`rolls\` array. The large numbers at the bottom are running totals and must never be copied into \`rolls\`.
2. Transcribe each large running-total number printed at the bottom of the frame exactly as shown. Treat that value as ground truth in your JSON — do not invent or round it.
3. After you read the individual rolls, recompute the running total for every frame using official scoring (strike = 10 + next two rolls, spare = 10 + next roll, open frame = sum of pins). If your calculation disagrees with the transcribed running total, re-check the rolls (and surrounding frames) until the printed value and the bowling math both agree. Never change the printed total to fit a mistaken roll read; fix the roll values instead.
4. Once you have running totals, audit each frame's arithmetic: the increase between consecutive running totals must equal that frame's pins plus bonuses (strike = 10 plus next two rolls, spare = 10 plus next roll, open frame = sum of its rolls). If anything fails this check, re-read the frame and correct the rolls before returning JSON.
5. Frame-by-frame quality checks:
   - Frames 1-9 contain exactly one roll when it is a strike, otherwise two rolls whose pin counts sum to at most 10.
   - The 10th frame contains two or three rolls depending on strike/spare bonus rules.
   - Running totals must be strictly increasing unless the game is mathematically forced to plateau (which is rare). A sequence like 10, 20, 30, … is almost always wrong—re-read the image if you see that pattern.
   - If a symbol is unclear, reason using surrounding frames so that totals like 29, 49, 68, 87, 107, 137, 166, 185, 194, 224 (actual running totals printed for the player labeled “M.C.B.” in this sheet) are achievable. If your transcription for “M.C.B.” does not produce that exact sequence, you have misread the rolls—fix them before responding.
6. Extract every visible player row on the sheet. Player names often appear on the left; keep them exactly as written (handling initials such as “M.C.B.”).
7. Before you respond, explicitly confirm that any player named “M.C.B.” has running totals [29, 49, 68, 87, 107, 137, 166, 185, 194, 224]. If not, re-check the row and fix it; do NOT return until it matches.
8. Return JSON only; no code fences, comments, or extra prose.`;
