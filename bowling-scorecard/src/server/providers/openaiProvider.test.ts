const responsesParse = jest.fn();
const chatCreate = jest.fn();
const openAIConstructor = jest.fn(() => ({
  responses: { parse: responsesParse },
  chat: { completions: { create: chatCreate } }
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: openAIConstructor
}));

const extractionPayload = {
  success: true,
  failureReason: null,
  players: [
    {
      playerName: 'Test Player',
      frames: Array.from({ length: 9 }, (_, index) => ({
        frameNumber: index + 1,
        rolls: [{ pins: 1, isSplit: false }, { pins: 1, isSplit: false }],
        isStrike: false,
        isSpare: false,
        runningTotal: (index + 1) * 2
      })),
      tenthFrame: {
        rolls: [{ pins: 1, isSplit: false }, { pins: 1, isSplit: false }],
        isStrike: false,
        isSpare: false,
        runningTotal: 20
      },
      totalScore: 20
    }
  ]
};

const completedResponse = {
  status: 'completed',
  incomplete_details: null,
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify(extractionPayload) }]
    }
  ],
  output_parsed: extractionPayload,
  output_text: JSON.stringify(extractionPayload),
  model: 'gpt-6-astra',
  usage: {
    input_tokens: 120,
    output_tokens: 80,
    output_tokens_details: { reasoning_tokens: 20 },
    total_tokens: 200
  }
};

describe('openaiProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_REASONING_EFFORT;
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_REASONING_EFFORT;
  });

  it('uses Responses structured output with Astra-compatible parameters', async () => {
    responsesParse.mockResolvedValue(completedResponse);
    const { openaiProvider } = await import('./openaiProvider');

    const result = await openaiProvider({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract scores'
    });

    expect(responsesParse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-6-astra',
        reasoning: { effort: 'low' },
        max_output_tokens: 8000,
        store: false,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'extract scores' },
              {
                type: 'input_image',
                image_url: 'data:image/jpeg;base64,abc',
                detail: 'high'
              }
            ]
          }
        ],
        text: {
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'bowling_score_extraction',
            strict: true
          })
        }
      })
    );
    expect(responsesParse.mock.calls[0]?.[0]).not.toHaveProperty('temperature');
    expect(JSON.stringify(responsesParse.mock.calls[0]?.[0]?.text)).toContain('isSplit');
    expect(result).toMatchObject({
      model: 'gpt-6-astra',
      usage: {
        inputTokens: 120,
        outputTokens: 80,
        reasoningTokens: 20,
        totalTokens: 200
      },
      games: [{ playerName: 'Test Player', totalScore: 20 }]
    });
  });

  it('surfaces an incomplete Astra response', async () => {
    responsesParse.mockResolvedValue({
      ...completedResponse,
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' }
    });
    const { openaiProvider } = await import('./openaiProvider');

    await expect(
      openaiProvider({
        imageDataUrl: 'data:image/jpeg;base64,abc',
        prompt: 'extract scores'
      })
    ).rejects.toThrow('OpenAI response was not completed: max_output_tokens');
  });

  it('allows Astra reasoning effort to be raised for evaluation', async () => {
    process.env.OPENAI_REASONING_EFFORT = 'medium';
    responsesParse.mockResolvedValue(completedResponse);
    const { openaiProvider } = await import('./openaiProvider');

    await openaiProvider({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract scores'
    });

    expect(responsesParse).toHaveBeenCalledWith(
      expect.objectContaining({ reasoning: { effort: 'medium' } })
    );
  });

  it('surfaces an Astra refusal', async () => {
    responsesParse.mockResolvedValue({
      ...completedResponse,
      output_parsed: null,
      output: [
        {
          type: 'message',
          content: [{ type: 'refusal', refusal: 'Unable to process this image' }]
        }
      ]
    });
    const { openaiProvider } = await import('./openaiProvider');

    await expect(
      openaiProvider({
        imageDataUrl: 'data:image/jpeg;base64,abc',
        prompt: 'extract scores'
      })
    ).rejects.toThrow('OpenAI refused the score extraction request: Unable to process this image');
  });

  it('preserves Chat Completions for a non-Astra rollback model', async () => {
    chatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(extractionPayload) } }],
      model: 'gpt-5.2',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        completion_tokens_details: { reasoning_tokens: 10 },
        total_tokens: 150
      }
    });
    const { openaiProvider } = await import('./openaiProvider');

    const result = await openaiProvider({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract scores',
      model: 'gpt-5.2'
    });

    expect(chatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.2',
        max_completion_tokens: 4000,
        temperature: 0.1
      })
    );
    expect(responsesParse).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      model: 'gpt-5.2',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 10,
        totalTokens: 150
      }
    });
  });
});
