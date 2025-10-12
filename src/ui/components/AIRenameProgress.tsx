import React from "react";

interface AIRenameProgressProps {
  isOpen: boolean;
  currentChunk: number;
  totalChunks: number;
  renamedCount: number;
  failedCount: number;
  statusMessage?: string;
  onCancel: () => void;
}

export default function AIRenameProgress({
  isOpen,
  currentChunk,
  totalChunks,
  renamedCount,
  failedCount,
  statusMessage,
  onCancel,
}: AIRenameProgressProps) {
  if (!isOpen) {
    return null;
  }

  const progressRatio =
    totalChunks > 0 ? Math.min(currentChunk / totalChunks, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <div className="modal-overlay">
      <div className="modal-card ai-progress-card">
        <header className="modal-header">
          <div className="modal-icon" aria-hidden="true">
            ✨
          </div>
          <div>
            <h2>AI Renaming Layers…</h2>
            <p>Processing chunk {currentChunk} of {totalChunks}</p>
          </div>
        </header>

        <div className="modal-body">
          <div className="ai-progress-bar">
            <div
              className="ai-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="ai-progress-meta">
            <span>{progressPercent}% complete</span>
            <span>
              Renamed: {renamedCount} · Failed: {failedCount}
            </span>
          </div>

          {statusMessage && (
            <div className="ai-progress-status">{statusMessage}</div>
          )}
        </div>

        <footer className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
