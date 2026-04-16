const getRuntimeSettings = jest.fn();
const fetchMock = jest.fn();

jest.mock('@/server/config/appConfig', () => ({
  getRuntimeSettings
}));

describe('ML service client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRuntimeSettings.mockResolvedValue({
      mlServiceUrl: 'http://ml-service.test'
    });
    global.fetch = fetchMock;
  });

  it('posts local inference requests to the configured ML service URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ model: 'local-v1', rawText: 'ok', games: [] })
    });

    const { inferWithLocalModel } = await import('@/server/ml/client');
    const result = await inferWithLocalModel({
      imageDataUrl: 'data:image/jpeg;base64,abc',
      prompt: 'extract',
      model: 'local-v1',
      modelArtifactId: 'artifact-1'
    });

    expect(fetchMock).toHaveBeenCalledWith('http://ml-service.test/infer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl: 'data:image/jpeg;base64,abc',
        prompt: 'extract',
        model: 'local-v1',
        modelArtifactId: 'artifact-1'
      })
    });
    expect(result).toEqual({ model: 'local-v1', rawText: 'ok', games: [] });
  });

  it('throws when inference returns a non-2xx response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503
    });

    const { inferWithLocalModel } = await import('@/server/ml/client');

    await expect(
      inferWithLocalModel({
        imageDataUrl: 'data:image/jpeg;base64,abc',
        prompt: 'extract'
      })
    ).rejects.toThrow('Local model inference failed with status 503');
  });

  it('imports model artifacts as multipart form data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, model: { id: 'remote-1' } })
    });

    const file = new File(['artifact'], 'artifact.zip', { type: 'application/zip' });
    const { importLocalModelArtifact } = await import('@/server/ml/client');
    const result = await importLocalModelArtifact(file);

    expect(fetchMock).toHaveBeenCalledWith('http://ml-service.test/models/import', {
      method: 'POST',
      body: expect.any(FormData)
    });
    expect(result).toEqual({ success: true, model: { id: 'remote-1' } });
  });
});
