const findUnique = jest.fn();
const upsert = jest.fn();

jest.mock('@/server/db/client', () => ({
  prisma: {
    appConfig: {
      findUnique,
      upsert
    }
  }
}));

describe('appConfig runtime settings', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.DEFAULT_PROVIDER;
    delete process.env.OPENAI_MODEL;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.LOCAL_MODEL_NAME;
    delete process.env.ML_SERVICE_URL;
  });

  it('returns environment-backed defaults when no runtime record exists', async () => {
    process.env.DEFAULT_PROVIDER = 'stub';
    process.env.OPENAI_MODEL = 'gpt-test';
    process.env.ANTHROPIC_MODEL = 'claude-test';
    process.env.LOCAL_MODEL_NAME = 'local-test';
    process.env.ML_SERVICE_URL = 'http://ml.example.test';
    findUnique.mockResolvedValue(null);

    jest.resetModules();
    const { getRuntimeSettings } = await import('@/server/config/appConfig');

    await expect(getRuntimeSettings()).resolves.toEqual({
      activeProvider: 'stub',
      openaiModel: 'gpt-test',
      anthropicModel: 'claude-test',
      localModelArtifactId: null,
      localModelName: 'local-test',
      mlServiceUrl: 'http://ml.example.test'
    });
  });

  it('merges persisted settings over defaults', async () => {
    findUnique.mockResolvedValue({
      value: {
        activeProvider: 'local',
        localModelArtifactId: 'artifact-1',
        localModelName: 'artifact-v1'
      }
    });

    const { getRuntimeSettings } = await import('@/server/config/appConfig');

    await expect(getRuntimeSettings()).resolves.toMatchObject({
      activeProvider: 'local',
      openaiModel: 'gpt-4o',
      anthropicModel: 'claude-3-7-sonnet-latest',
      localModelArtifactId: 'artifact-1',
      localModelName: 'artifact-v1',
      mlServiceUrl: 'http://ml-service:8000'
    });
  });

  it('upserts partial runtime updates on top of current settings', async () => {
    findUnique.mockResolvedValue({
      value: {
        activeProvider: 'openai',
        openaiModel: 'gpt-old',
        anthropicModel: 'claude-old',
        localModelArtifactId: null,
        localModelName: 'local-old',
        mlServiceUrl: 'http://old.example.test'
      }
    });

    const { updateRuntimeSettings } = await import('@/server/config/appConfig');
    const settings = await updateRuntimeSettings({
      activeProvider: 'local',
      localModelArtifactId: 'artifact-2'
    });

    expect(settings).toEqual({
      activeProvider: 'local',
      openaiModel: 'gpt-old',
      anthropicModel: 'claude-old',
      localModelArtifactId: 'artifact-2',
      localModelName: 'local-old',
      mlServiceUrl: 'http://old.example.test'
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { key: 'runtime-settings' },
      update: { value: settings },
      create: {
        key: 'runtime-settings',
        value: settings
      }
    });
  });

  it('resolves provider-specific models from runtime settings', async () => {
    findUnique.mockResolvedValue({
      value: {
        openaiModel: 'gpt-runtime',
        anthropicModel: 'claude-runtime',
        localModelName: 'local-runtime'
      }
    });

    const { getProviderModel } = await import('@/server/config/appConfig');

    await expect(getProviderModel('openai')).resolves.toBe('gpt-runtime');
    await expect(getProviderModel('anthropic')).resolves.toBe('claude-runtime');
    await expect(getProviderModel('local')).resolves.toBe('local-runtime');
    await expect(getProviderModel('stub')).resolves.toBe('dev-stub');
  });
});
