'use client';

import { useCallback, useState } from 'react';

type RuntimeSettings = {
  activeProvider: 'anthropic' | 'openai' | 'local' | 'stub';
  openaiModel: string;
  anthropicModel: string;
  localModelArtifactId: string | null;
  localModelName: string;
  mlServiceUrl: string;
};

type ModelArtifact = {
  id: string;
  name: string;
  version: string;
  architecture: string;
  localPath: string | null;
  isActive: boolean;
  metrics: Record<string, unknown> | null;
};

type AdminConsoleProps = {
  initialSettings: RuntimeSettings;
  initialArtifacts: ModelArtifact[];
  datasetCounts: {
    datasetImageCount: number;
    datasetCorrectionCount: number;
  };
};

const cardStyle = {
  border: '1px solid #334155',
  borderRadius: '18px',
  padding: '20px',
  background: 'linear-gradient(180deg, #0b1738 0%, #08102a 100%)',
  boxShadow: '0 18px 36px rgba(2, 6, 23, 0.45)'
} as const;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontWeight: 600,
  color: '#cbd5e1'
} as const;

const inputStyle = {
  borderRadius: '10px',
  border: '1px solid #475569',
  padding: '10px 12px',
  fontSize: '14px',
  background: '#0f172a',
  color: '#f8fafc'
} as const;

const buttonStyle = {
  alignItems: 'center',
  borderRadius: '8px',
  border: 'none',
  background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
  color: '#f8fafc',
  display: 'inline-flex',
  font: 'inherit',
  padding: '10px 16px',
  fontWeight: 700,
  justifyContent: 'center',
  lineHeight: 1.2,
  minHeight: '42px',
  cursor: 'pointer',
  boxShadow: '0 12px 24px rgba(14, 165, 233, 0.22)'
} as const;

const secondaryButtonStyle = {
  ...buttonStyle,
  textDecoration: 'none',
  background: '#164e63',
  boxShadow: 'none'
} as const;

const datasetDownloadFileName = () => {
  const date = new Date().toISOString().slice(0, 10);
  return `bowling-validated-scores-${date}.zip`;
};

export function AdminConsole({
  initialSettings,
  initialArtifacts,
  datasetCounts
}: AdminConsoleProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [artifactFile, setArtifactFile] = useState<File | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingDataset, setDownloadingDataset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshArtifacts = useCallback(async () => {
    setRefreshing(true);
    setMessage(null);

    try {
      const artifactsResponse = await fetch('/api/admin/model-artifacts');
      const artifactsData = await artifactsResponse.json();

      if (!artifactsResponse.ok) {
        throw new Error(artifactsData.error ?? 'Unable to refresh model artifacts');
      }

      setArtifacts(artifactsData.artifacts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh model artifacts');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const downloadTrainingDataset = async () => {
    setDownloadingDataset(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/training-dataset');
      if (!response.ok) {
        throw new Error('Unable to download training dataset');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = datasetDownloadFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('Training dataset download started.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to download training dataset');
    } finally {
      setDownloadingDataset(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save settings');
      }

      setSettings(data.settings);
      setMessage('Settings updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const activateArtifact = async (artifactId: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/model-artifacts/${artifactId}/activate`, {
        method: 'POST'
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to activate model');
      }

      setSettings((current) => ({
        ...current,
        activeProvider: 'local',
        localModelArtifactId: artifactId,
        localModelName: data.artifact.version
      }));
      setMessage('Local model activated and provider switched to local.');
      await refreshArtifacts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to activate model');
    } finally {
      setSaving(false);
    }
  };

  const importArtifact = async () => {
    if (!artifactFile) {
      setMessage('Choose a model artifact archive first.');
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set('file', artifactFile);
      const response = await fetch('/api/admin/model-artifacts/import', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to import model artifact');
      }

      setArtifactFile(null);
      setMessage(`Imported ${data.artifact.name} / ${data.artifact.version}.`);
      await refreshArtifacts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import model artifact');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gap: '20px',
        padding: '24px 16px 40px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}
    >
      <section
        style={{
          ...cardStyle,
          background:
            'radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 28%), linear-gradient(180deg, #0b1738 0%, #08102a 100%)'
        }}
      >
        <h1 style={{ margin: 0, fontSize: '32px', color: '#f8fafc' }}>Admin Console</h1>
        <p style={{ margin: '8px 0 0', color: '#93c5fd', maxWidth: '760px' }}>
          Manage OCR provider routing, export validated scores, and activate imported local model
          artifacts without changing environment variables.
        </p>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#f8fafc' }}>Dataset snapshot</h2>
            <p style={{ margin: '6px 0 0', color: '#93c5fd' }}>
              {datasetCounts.datasetImageCount} corrected images, {datasetCounts.datasetCorrectionCount} corrected games
            </p>
            <p style={{ margin: '6px 0 0', color: '#cbd5e1', maxWidth: '760px' }}>
              Download this dataset for offline training, then import the trained artifact below.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={downloadTrainingDataset}
              disabled={downloadingDataset}
              style={secondaryButtonStyle}
            >
              {downloadingDataset ? 'Downloading...' : 'Download training dataset'}
            </button>
            <button type="button" style={buttonStyle} onClick={refreshArtifacts} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh artifacts'}
            </button>
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Provider settings</h2>
        <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label style={labelStyle}>
            Active provider
            <select
              value={settings.activeProvider}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  activeProvider: event.target.value as RuntimeSettings['activeProvider']
                }))
              }
              style={inputStyle}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="local">Local model</option>
              <option value="stub">Stub</option>
            </select>
          </label>
          <label style={labelStyle}>
            OpenAI model
            <input
              value={settings.openaiModel}
              onChange={(event) =>
                setSettings((current) => ({ ...current, openaiModel: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Anthropic model
            <input
              value={settings.anthropicModel}
              onChange={(event) =>
                setSettings((current) => ({ ...current, anthropicModel: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Local model label
            <input
              value={settings.localModelName}
              onChange={(event) =>
                setSettings((current) => ({ ...current, localModelName: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            ML service URL
            <input
              value={settings.mlServiceUrl}
              onChange={(event) =>
                setSettings((current) => ({ ...current, mlServiceUrl: event.target.value }))
              }
              style={inputStyle}
            />
          </label>
        </div>
        <div style={{ marginTop: '16px' }}>
          <button type="button" style={buttonStyle} onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Import trained artifact</h2>
        <p style={{ margin: '0 0 14px', color: '#cbd5e1' }}>
          Upload a zip or tar archive with a root manifest.json and model files from your offline
          training run.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="file"
            accept=".zip,.tar,.tgz,.tar.gz,application/zip,application/gzip"
            onChange={(event) => setArtifactFile(event.target.files?.[0] ?? null)}
            style={inputStyle}
          />
          <button type="button" style={buttonStyle} onClick={importArtifact} disabled={importing}>
            {importing ? 'Importing...' : 'Import artifact'}
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Imported model artifacts</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {artifacts.length === 0 ? (
            <p style={{ margin: 0, color: '#93c5fd' }}>No imported model artifacts yet.</p>
          ) : (
            artifacts.map((artifact) => (
              <article
                key={artifact.id}
                style={{
                  border: artifact.isActive ? '2px solid #38bdf8' : '1px solid #334155',
                  borderRadius: '14px',
                  padding: '14px',
                  background: artifact.isActive ? '#0b1738' : '#0f172a',
                  boxShadow: artifact.isActive ? '0 0 0 1px rgba(56, 189, 248, 0.16) inset' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <strong style={{ color: '#f8fafc' }}>
                      {artifact.name} / {artifact.version}
                    </strong>
                    <p style={{ margin: '6px 0 0', color: '#cbd5e1' }}>
                      {artifact.architecture} {artifact.localPath ? `· ${artifact.localPath}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => activateArtifact(artifact.id)}
                    disabled={saving || artifact.isActive}
                  >
                    {artifact.isActive ? 'Active' : 'Activate'}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {message && (
        <section style={{ ...cardStyle, padding: '14px 18px' }}>
          <p style={{ margin: 0, color: '#dbeafe' }}>{message}</p>
        </section>
      )}
    </div>
  );
}
