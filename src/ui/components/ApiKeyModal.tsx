import React, { useEffect, useState } from "react";
import { AIRenameConfig } from "../types";

// For local testing, use http://localhost:3001
// For production, replace with your Vercel deployment URL
const DEFAULT_BACKEND_URL = "http://localhost:3001";

interface ApiKeyModalProps {
  isOpen: boolean;
  initialConfig?: AIRenameConfig | null;
  onSave: (config: AIRenameConfig) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function ApiKeyModal({
  isOpen,
  initialConfig,
  onSave,
  onSkip,
  onClose,
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);

  useEffect(() => {
    if (initialConfig) {
      setApiKey(initialConfig.apiKey ?? "");
      setBackendUrl(initialConfig.backendUrl ?? DEFAULT_BACKEND_URL);
    }
  }, [initialConfig]);

  if (!isOpen) {
    return null;
  }

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedUrl = backendUrl.trim() || DEFAULT_BACKEND_URL;
    onSave({
      backendUrl: trimmedUrl,
      apiKey: apiKey.trim() ? apiKey.trim() : undefined,
      model: initialConfig?.model,
      temperature: initialConfig?.temperature,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <form onSubmit={handleSave}>
          <header className="modal-header">
            <div className="modal-icon" aria-hidden="true">
              ✨
            </div>
            <div>
              <h2>Connect Gemini</h2>
              <p>
                Add an API key or rely on the backend&apos;s environment
                variable. You can update these settings later.
              </p>
            </div>
          </header>

          <div className="modal-body">
            <label className="modal-label">
              Gemini API Key (optional)
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste your API key"
                className="modal-input"
              />
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="modal-link"
              >
                Get an API key
              </a>
            </label>

            <label className="modal-label">
              Backend URL
              <input
                type="url"
                value={backendUrl}
                onChange={(event) => setBackendUrl(event.target.value)}
                placeholder={DEFAULT_BACKEND_URL}
                className="modal-input"
              />
            </label>
          </div>

          <footer className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSkip}
            >
              Skip (use backend default)
            </button>
            <button type="submit" className="btn btn-primary">
              Save &amp; Continue
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
