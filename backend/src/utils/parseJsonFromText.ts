export const extractJsonFromText = (text: string): any => {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response text');
  }

  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const braceMatch = text.match(/\{[\s\S]*\}/);
  const candidateSource = codeBlockMatch?.[1] ?? braceMatch?.[0] ?? text;
  const initialCandidate = candidateSource.trim();

  const attemptParse = (candidate: string | undefined): any => {
    const trimmed = candidate?.trim();
    if (!trimmed) {
      throw new Error('No JSON payload found in response');
    }
    return JSON.parse(trimmed);
  };

  const stripTrailingCommas = (candidate: string): string => {
    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < candidate.length; i += 1) {
      const char = candidate[i];

      if (inString) {
        result += char;
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        result += char;
        continue;
      }

      if (char === ',') {
        let lookAheadIndex = i + 1;
        while (lookAheadIndex < candidate.length && /\s/u.test(candidate.charAt(lookAheadIndex))) {
          lookAheadIndex += 1;
        }
        const nextChar = candidate.charAt(lookAheadIndex);
        if (nextChar === '}' || nextChar === ']') {
          i = lookAheadIndex - 1;
          continue;
        }
      }

      result += char;
    }

    return result;
  };

  const sliceToLikelyJson = (candidate: string): string => {
    const startIndex = candidate.search(/[\{\[]/u);
    if (startIndex === -1) {
      return candidate;
    }

    const segment = candidate.slice(startIndex);
    const stack: string[] = [];
    let inString = false;
    let escapeNext = false;
    let endIndex = -1;

    for (let i = 0; i < segment.length; i += 1) {
      const char = segment[i];

      if (inString) {
        if (escapeNext) {
          escapeNext = false;
        } else if (char === '\\') {
          escapeNext = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{' || char === '[') {
        stack.push(char === '{' ? '}' : ']');
        continue;
      }

      if ((char === '}' || char === ']') && stack.length > 0) {
        const expected = stack.pop();
        if (expected !== char) {
          // Mismatched bracket — stop the scan right before the invalid token.
          endIndex = Math.max(i - 1, 0);
          break;
        }

        if (stack.length === 0) {
          endIndex = i;
          break;
        }
      }
    }

    let baseSlice = endIndex === -1 ? segment : segment.slice(0, endIndex + 1);
    if (stack.length > 0) {
      baseSlice = `${baseSlice}${stack.reverse().join('')}`;
    }

    return stripTrailingCommas(baseSlice);
  };

  try {
    return attemptParse(initialCandidate);
  } catch (initialError) {
    if (!initialCandidate) {
      throw new Error('No JSON payload found in response');
    }

    const sliced = sliceToLikelyJson(initialCandidate);
    try {
      return attemptParse(sliced);
    } catch {
      try {
        return attemptParse(stripTrailingCommas(sliced));
      } catch (secondaryError) {
        const finalError =
          secondaryError instanceof Error
            ? secondaryError
            : initialError instanceof Error
              ? initialError
              : new Error('Unable to parse JSON payload from response');
        throw new Error(finalError.message || 'Unable to parse JSON payload from response');
      }
    }
  }
};
