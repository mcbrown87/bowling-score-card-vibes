const getRuntimeSettings = jest.fn();
const inferWithLocalModel = jest.fn();

jest.mock('@/server/config/appConfig', () => ({
  getRuntimeSettings
}));

jest.mock('@/server/ml/client', () => ({
  inferWithLocalModel
}));

describe('localProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRuntimeSettings.mockResolvedValue({
      localModelArtifactId: 'artifact-123',
      localModelName: 'runtime-local-v1'
    });
  });

  it('sends runtime model artifact information to the ML service', async () => {
    inferWithLocalModel.mockResolvedValue({
      rawText: 'ok',
      games: [{ playerName: 'A', frames: [], tenthFrame: {}, totalScore: 100 }],
      model: 'runtime-local-v1'
    });

    const { localProvider } = await import('@/server/providers/localProvider');
    const result = await localProvider({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract'
    });

    expect(inferWithLocalModel).toHaveBeenCalledWith({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract',
      model: 'runtime-local-v1',
      modelArtifactId: 'artifact-123'
    });
    expect(result).toEqual({
      rawText: 'ok',
      games: [{ playerName: 'A', frames: [], tenthFrame: {}, totalScore: 100 }],
      model: 'runtime-local-v1'
    });
  });

  it('prefers the requested model label but still includes the active artifact id', async () => {
    inferWithLocalModel.mockResolvedValue({
      games: undefined,
      rawText: undefined,
      model: undefined
    });

    const { localProvider } = await import('@/server/providers/localProvider');
    const result = await localProvider({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract',
      model: 'request-model'
    });

    expect(inferWithLocalModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'request-model',
        modelArtifactId: 'artifact-123'
      })
    );
    expect(result).toEqual({
      rawText: '',
      games: [],
      model: 'request-model'
    });
  });
});
