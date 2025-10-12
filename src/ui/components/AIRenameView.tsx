import React, { useEffect, useMemo, useState } from "react";
import {
  AIRenameConfig,
  AIRenameContext,
  LayerDataForAI,
  RenamedLayer,
  NamingTemplate,
  LayerNamingRule,
  NamingConventionOption,
} from "../types";

const MODEL_OPTIONS = [
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description: "Fast and cost-effective for large batches",
  },
  {
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description: "Best semantic quality; use for critical screens",
  },
] as const;

const NAMING_CONVENTION_OPTIONS: Array<{
  value: NamingConventionOption;
  label: string;
  description: string;
}> = [
  {
    value: "semantic",
    label: "Semantic",
    description: "AI infers intent based on layer context",
  },
  {
    value: "bem",
    label: "BEM",
    description: "Block__Element--Modifier naming for token-friendly files",
  },
  {
    value: "pascal-case",
    label: "Pascal Case",
    description: "Screens & components start with capital letters",
  },
  {
    value: "camel-case",
    label: "camelCase",
    description: "Useful for code-ready layer names",
  },
  {
    value: "kebab-case",
    label: "kebab-case",
    description: "Web-friendly dashed names",
  },
  {
    value: "snake-case",
    label: "snake_case",
    description: "Legacy systems and analytics dashboards",
  },
  {
    value: "custom",
    label: "Custom template",
    description: "Provide your own tokenized pattern",
  },
];

const LAYER_TYPE_SUGGESTIONS = [
  "FRAME",
  "TEXT",
  "COMPONENT",
  "INSTANCE",
  "GROUP",
  "SECTION",
  "RECTANGLE",
  "VECTOR",
] as const;

interface PendingReviewChunk {
  chunkIndex: number;
  context: AIRenameContext;
  renamedLayers: RenamedLayer[];
  originalLayers: LayerDataForAI[];
}

interface DraftRenameEntry {
  id: string;
  oldName: string;
  newName: string;
  accept: boolean;
}

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  historyDepth: number;
  redoDepth: number;
}

interface AIRenameViewProps {
  config: AIRenameConfig;
  onUpdateConfig: (config: Partial<AIRenameConfig>) => void;
  onEditBackend: () => void;
  pendingChunks: PendingReviewChunk[];
  onApproveChunk: (chunkIndex: number, layers: RenamedLayer[]) => void;
  onRejectChunk: (chunkIndex: number) => void;
  historyState: HistoryState;
  onUndo: () => void;
  onRedo: () => void;
  statusMessage?: string;
  isRenaming: boolean;
  renameCounts: { renamed: number; failed: number };
  progress: { current: number; total: number };
}

export default function AIRenameView({
  config,
  onUpdateConfig,
  onEditBackend,
  pendingChunks,
  onApproveChunk,
  onRejectChunk,
  historyState,
  onUndo,
  onRedo,
  statusMessage,
  isRenaming,
  renameCounts,
  progress,
}: AIRenameViewProps) {
  const [draftConfig, setDraftConfig] = useState<AIRenameConfig>(() =>
    cloneConfig(config)
  );
  const [draftRenames, setDraftRenames] = useState<
    Record<string, DraftRenameEntry[]>
  >({});
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);
  const [excludePatternsText, setExcludePatternsText] = useState<string>(
    (config.excludePatterns ?? []).join("\n")
  );

  useEffect(() => {
    setDraftConfig(cloneConfig(config));
  }, [config]);

  useEffect(() => {
    setExcludePatternsText((draftConfig.excludePatterns ?? []).join("\n"));
  }, [draftConfig.excludePatterns]);

  useEffect(() => {
    if (!pendingChunks.length) {
      setDraftRenames({});
      return;
    }

    setDraftRenames((previous) => {
      const next: Record<string, DraftRenameEntry[]> = {};
      pendingChunks.forEach((chunk) => {
        const key = toChunkKey(chunk.chunkIndex);
        const renameLookup = new Map(
          chunk.renamedLayers.map((layer) => [layer.id, layer])
        );

        if (previous[key]) {
          const synced = previous[key]
            .map((entry) => {
              const latest = renameLookup.get(entry.id);
              if (!latest) {
                return null;
              }
              return {
                ...entry,
                oldName: latest.oldName,
                newName: entry.newName || latest.newName,
              };
            })
            .filter(Boolean) as DraftRenameEntry[];

          if (synced.length) {
            next[key] = synced;
            return;
          }
        }

        next[key] = chunk.renamedLayers.map((layer) => ({
          id: layer.id,
          oldName: layer.oldName,
          newName: layer.newName,
          accept: true,
        }));
      });
      return next;
    });
  }, [pendingChunks]);

  useEffect(() => {
    if (!pendingChunks.length) {
      setActiveChunkId(null);
      return;
    }

    const keys = pendingChunks.map((chunk) => toChunkKey(chunk.chunkIndex));
    if (!activeChunkId || !keys.includes(activeChunkId)) {
      setActiveChunkId(keys[0]);
    }
  }, [pendingChunks, activeChunkId]);

  const isDirty = useMemo(() => {
    return serializeConfig(config) !== serializeConfig(draftConfig);
  }, [config, draftConfig]);

  const pendingCount = pendingChunks.length;
  const activeChunk = useMemo(() => {
    if (!activeChunkId) return null;
    return pendingChunks.find(
      (chunk) => toChunkKey(chunk.chunkIndex) === activeChunkId
    );
  }, [pendingChunks, activeChunkId]);

  const activeDraftRenames = activeChunkId
    ? draftRenames[activeChunkId] ?? []
    : [];

  const acceptedEntries = activeDraftRenames.filter((entry) => entry.accept);
  const hasInvalidAccepted = acceptedEntries.some(
    (entry) => !entry.newName || !entry.newName.trim().length
  );
  const applyDisabled =
    !activeChunk || !acceptedEntries.length || hasInvalidAccepted;

  const progressPercent = useMemo(() => {
    if (!progress.total) {
      return 0;
    }
    const ratio = (progress.current / progress.total) * 100;
    if (!Number.isFinite(ratio)) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(ratio)));
  }, [progress.current, progress.total]);

  const statusSummary = statusMessage
    ? statusMessage
    : isRenaming
    ? "AI rename in progress…"
    : "AI rename is idle";

  const handleModelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraftConfig((previous) => ({
      ...previous,
      model: value,
    }));
  };

  const handleNamingConventionChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = event.target.value as NamingConventionOption;
    setDraftConfig((previous) => ({
      ...previous,
      namingConvention: value,
      customNamingPattern:
        value === "custom" ? previous.customNamingPattern ?? "" : undefined,
    }));
  };

  const handleCustomPatternChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setDraftConfig((previous) => ({
      ...previous,
      customNamingPattern: value,
    }));
  };

  const handleBatchSizeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    setDraftConfig((previous) => ({
      ...previous,
      batchSize: Number.isNaN(value) ? previous.batchSize : value,
    }));
  };

  const handleUndoLimitChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(event.target.value, 10);
    setDraftConfig((previous) => ({
      ...previous,
      undoHistoryLimit: Number.isNaN(value) ? previous.undoHistoryLimit : value,
    }));
  };

  const handleReviewModeToggle = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.checked;
    setDraftConfig((previous) => ({
      ...previous,
      reviewMode: value,
    }));
  };

  const handleExcludePatternsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setExcludePatternsText(value);
    const patterns = value
      .split("\n")
      .map((pattern) => pattern.trim())
      .filter(Boolean);
    setDraftConfig((previous) => ({
      ...previous,
      excludePatterns: patterns,
    }));
  };

  const handleTemplateChange = (
    index: number,
    key: keyof Pick<NamingTemplate, "label" | "pattern">
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDraftConfig((previous) => {
        const templates = [...(previous.namingTemplates ?? [])];
        if (!templates[index]) {
          return previous;
        }
        templates[index] = {
          ...templates[index],
          [key]: value,
        };
        return {
          ...previous,
          namingTemplates: templates,
        };
      });
    };
  };

  const handleRemoveTemplate = (index: number) => {
    setDraftConfig((previous) => {
      const templates = [...(previous.namingTemplates ?? [])];
      templates.splice(index, 1);
      return {
        ...previous,
        namingTemplates: templates,
      };
    });
  };

  const handleAddTemplate = () => {
    setDraftConfig((previous) => {
      const templates = [...(previous.namingTemplates ?? [])];
      templates.push({
        id: `template-${Date.now()}`,
        label: `Template ${templates.length + 1}`,
        pattern: "{{layerType}}/{{role}}",
      });
      return {
        ...previous,
        namingTemplates: templates,
      };
    });
  };

  const handleLayerRuleChange = (
    index: number,
    field: keyof LayerNamingRule,
    value: string | boolean
  ) => {
    setDraftConfig((previous) => {
      const rules = [...(previous.layerTypeRules ?? [])];
      if (!rules[index]) {
        return previous;
      }
      rules[index] = {
        ...rules[index],
        [field]: field === "enabled" ? Boolean(value) : String(value),
      };
      return {
        ...previous,
        layerTypeRules: rules,
      };
    });
  };

  const handleAddLayerRule = () => {
    setDraftConfig((previous) => {
      const rules = [...(previous.layerTypeRules ?? [])];
      rules.push({
        layerType: "TEXT",
        pattern: "{{frame}}__{{role}}",
        enabled: true,
      });
      return {
        ...previous,
        layerTypeRules: rules,
      };
    });
  };

  const handleRemoveLayerRule = (index: number) => {
    setDraftConfig((previous) => {
      const rules = [...(previous.layerTypeRules ?? [])];
      rules.splice(index, 1);
      return {
        ...previous,
        layerTypeRules: rules,
      };
    });
  };

  const updateDraftRenameEntry = (
    chunkKey: string,
    layerId: string,
    updates: Partial<DraftRenameEntry>
  ) => {
    setDraftRenames((previous) => {
      const entries = previous[chunkKey] ?? [];
      return {
        ...previous,
        [chunkKey]: entries.map((entry) =>
          entry.id === layerId ? { ...entry, ...updates } : entry
        ),
      };
    });
  };

  const handleRenameNameChange = (layerId: string, value: string) => {
    if (!activeChunkId) return;
    updateDraftRenameEntry(activeChunkId, layerId, { newName: value });
  };

  const handleRenameAcceptToggle = (layerId: string, value: boolean) => {
    if (!activeChunkId) return;
    updateDraftRenameEntry(activeChunkId, layerId, { accept: value });
  };

  const handleApplyActiveChunk = () => {
    if (!activeChunk || !activeChunkId) return;

    const renameLookup = new Map(
      activeChunk.renamedLayers.map((layer) => [layer.id, layer])
    );

    const payload = acceptedEntries.map((entry) => {
      const latest = renameLookup.get(entry.id);
      return {
        id: entry.id,
        oldName: latest?.oldName ?? entry.oldName,
        newName: entry.newName.trim(),
      };
    });

    onApproveChunk(activeChunk.chunkIndex, payload);
    setDraftRenames((previous) => {
      const next = { ...previous };
      delete next[activeChunkId];
      return next;
    });
    setActiveChunkId(null);
  };

  const handleSkipActiveChunk = () => {
    if (!activeChunk || !activeChunkId) return;
    onRejectChunk(activeChunk.chunkIndex);
    setDraftRenames((previous) => {
      const next = { ...previous };
      delete next[activeChunkId];
      return next;
    });
    setActiveChunkId(null);
  };

  const handleSaveConfig = () => {
    onUpdateConfig({ ...draftConfig });
  };

  const handleResetConfig = () => {
    setDraftConfig(cloneConfig(config));
  };

  const activeLayerMap = useMemo(() => {
    if (!activeChunk) return new Map<string, LayerDataForAI>();
    return new Map(
      activeChunk.originalLayers.map((layer) => [layer.id, layer])
    );
  }, [activeChunk]);

  return (
    <div className="ai-rename-view">
      <div className="ai-rename-hero">
        <div className="ai-rename-icon" aria-hidden="true">
          🤖
        </div>
        <div>
          <h2>AI Rename Settings &amp; Review</h2>
          <p>
            Tune Gemini-powered naming patterns, preview suggestions, and keep a
            safe undo trail for every batch.
          </p>
        </div>
      </div>

      <div className="ai-rename-status-grid">
        <div className="ai-rename-status-card">
          <span className="ai-rename-status-label">Status</span>
          <span>{statusSummary}</span>
        </div>
        <div className="ai-rename-status-card">
          <span className="ai-rename-status-label">Current model</span>
          <span>{formatModelLabel(draftConfig.model)}</span>
        </div>
        <div className="ai-rename-status-card">
          <span className="ai-rename-status-label">Pending reviews</span>
          <span>{pendingCount}</span>
        </div>
        <div className="ai-rename-status-card">
          <span className="ai-rename-status-label">Applied / Skipped</span>
          <span>
            {renameCounts.renamed} / {renameCounts.failed}
          </span>
        </div>
      </div>

      {isRenaming && (
        <div className="ai-rename-progress">
          <div className="ai-rename-progress-bar" aria-hidden="true">
            <div
              className="ai-rename-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="ai-rename-progress-meta">
            <span>
              Batch {progress.current} of {progress.total}
            </span>
            <span>{progressPercent}% complete</span>
          </div>
        </div>
      )}

      <section className="ai-rename-section">
        <div className="ai-rename-section-header">
          <h3>Model &amp; API</h3>
          <button className="btn btn-tertiary" onClick={onEditBackend}>
            Edit API key &amp; backend
          </button>
        </div>
        <div className="ai-rename-option-grid">
          {MODEL_OPTIONS.map((option) => (
            <label className="ai-rename-radio-card" key={option.value}>
              <input
                type="radio"
                name="gemini-model"
                value={option.value}
                checked={draftConfig.model === option.value}
                onChange={handleModelChange}
              />
              <div>
                <strong>{option.label}</strong>
                <p>{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="ai-rename-section">
        <div className="ai-rename-section-header">
          <h3>Naming Strategy</h3>
        </div>
        <div className="ai-rename-field">
          <label>Convention</label>
          <select
            value={draftConfig.namingConvention ?? "semantic"}
            onChange={handleNamingConventionChange}
          >
            {NAMING_CONVENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="ai-rename-hint">
            {
              NAMING_CONVENTION_OPTIONS.find(
                (option) => option.value === draftConfig.namingConvention
              )?.description
            }
          </small>
        </div>

        {draftConfig.namingConvention === "custom" && (
          <div className="ai-rename-field">
            <label htmlFor="custom-naming-pattern">Custom template</label>
            <input
              id="custom-naming-pattern"
              type="text"
              placeholder="e.g. {{frame}}__{{role}}--{{state}}"
              value={draftConfig.customNamingPattern ?? ""}
              onChange={handleCustomPatternChange}
            />
            <small className="ai-rename-hint">
              Use tokens like {"{{frame}}"}, {"{{layerType}}"}, {"{{role}}"}, or
              {" {{index}}"} for automatic substitution.
            </small>
          </div>
        )}

        <div className="ai-rename-subsection">
          <div className="ai-rename-subsection-header">
            <h4>Reusable templates</h4>
            <button className="btn btn-secondary" onClick={handleAddTemplate}>
              Add template
            </button>
          </div>
          {(draftConfig.namingTemplates?.length ?? 0) === 0 ? (
            <p className="ai-rename-empty">No templates yet. Add a pattern to save time.</p>
          ) : (
            <div className="ai-rename-list">
              {draftConfig.namingTemplates?.map((template, index) => (
                <div className="ai-rename-list-row" key={template.id ?? index}>
                  <input
                    className="ai-rename-list-input"
                    placeholder="Template name"
                    value={template.label ?? ""}
                    onChange={handleTemplateChange(index, "label")}
                  />
                  <input
                    className="ai-rename-list-input"
                    placeholder="Pattern e.g. {{frame}}__{{role}}"
                    value={template.pattern ?? ""}
                    onChange={handleTemplateChange(index, "pattern")}
                  />
                  <button
                    className="btn btn-icon"
                    onClick={() => handleRemoveTemplate(index)}
                    aria-label="Remove template"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ai-rename-subsection">
          <div className="ai-rename-subsection-header">
            <h4>Layer type rules</h4>
            <button className="btn btn-secondary" onClick={handleAddLayerRule}>
              Add rule
            </button>
          </div>
          {(draftConfig.layerTypeRules?.length ?? 0) === 0 ? (
            <p className="ai-rename-empty">
              Create a rule to target a specific layer type like TEXT or FRAME.
            </p>
          ) : (
            <div className="ai-rename-list">
              {draftConfig.layerTypeRules?.map((rule, index) => (
                <div className="ai-rename-list-row" key={`${rule.layerType}-${index}`}>
                  <input
                    className="ai-rename-list-input ai-rename-list-input--small"
                    placeholder="Layer type"
                    value={rule.layerType}
                    list="layer-type-suggestions"
                    onChange={(event) =>
                      handleLayerRuleChange(index, "layerType", event.target.value)
                    }
                  />
                  <input
                    className="ai-rename-list-input"
                    placeholder="Pattern e.g. {{frame}}__Title"
                    value={rule.pattern}
                    onChange={(event) =>
                      handleLayerRuleChange(index, "pattern", event.target.value)
                    }
                  />
                  <label className="ai-rename-toggle">
                    <input
                      type="checkbox"
                      checked={rule.enabled !== false}
                      onChange={(event) =>
                        handleLayerRuleChange(index, "enabled", event.target.checked)
                      }
                    />
                    <span>Enabled</span>
                  </label>
                  <button
                    className="btn btn-icon"
                    onClick={() => handleRemoveLayerRule(index)}
                    aria-label="Remove layer rule"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="ai-rename-section">
        <div className="ai-rename-section-header">
          <h3>Workflow &amp; Safety</h3>
        </div>
        <div className="ai-rename-field-row">
          <label className="ai-rename-checkbox">
            <input
              type="checkbox"
              checked={Boolean(draftConfig.reviewMode)}
              onChange={handleReviewModeToggle}
            />
            <span>Require review before applying renames</span>
          </label>
          <small className="ai-rename-hint">
            When enabled, each batch waits in this tab until you approve it.
          </small>
        </div>

        <div className="ai-rename-field ai-rename-field-inline">
          <label htmlFor="batch-size">Batch size</label>
          <input
            id="batch-size"
            type="number"
            min={5}
            max={200}
            value={draftConfig.batchSize ?? 50}
            onChange={handleBatchSizeChange}
          />
          <small className="ai-rename-hint">
            Tune chunk size for the Gemini request (smaller batches review faster).
          </small>
        </div>

        <div className="ai-rename-field ai-rename-field-inline">
          <label htmlFor="undo-limit">Undo history depth</label>
          <input
            id="undo-limit"
            type="number"
            min={0}
            max={200}
            value={draftConfig.undoHistoryLimit ?? 20}
            onChange={handleUndoLimitChange}
          />
          <small className="ai-rename-hint">
            Set to 0 to disable plugin-managed undo history.
          </small>
        </div>

        <div className="ai-rename-field">
          <label htmlFor="exclude-patterns">Exclude patterns (regex)</label>
          <textarea
            id="exclude-patterns"
            rows={4}
            placeholder="^tmp-\n^scratch_\nicon$"
            value={excludePatternsText}
            onChange={handleExcludePatternsChange}
          />
          <small className="ai-rename-hint">
            One expression per line. Matching layers are skipped before sending to Gemini.
          </small>
        </div>

        <div className="ai-rename-actions">
          <button
            className="btn btn-secondary"
            onClick={handleResetConfig}
            disabled={!isDirty}
          >
            Reset changes
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveConfig}
            disabled={!isDirty}
          >
            Save AI rename settings
          </button>
        </div>
      </section>

      <section className="ai-rename-section">
        <div className="ai-rename-section-header">
          <h3>Review queue</h3>
          <span className="ai-rename-pill">{pendingCount} pending</span>
        </div>

        {pendingCount === 0 ? (
          <p className="ai-rename-empty">
            No suggestions waiting. Run AI Rename or enable review mode to queue batches here.
          </p>
        ) : (
          <div className="ai-rename-review">
            <aside className="ai-rename-review-sidebar">
              {pendingChunks.map((chunk) => {
                const key = toChunkKey(chunk.chunkIndex);
                const isActive = key === activeChunkId;
                return (
                  <button
                    key={key}
                    className={`ai-rename-review-tab ${
                      isActive ? "ai-rename-review-tab--active" : ""
                    }`}
                    onClick={() => setActiveChunkId(key)}
                  >
                    Batch {chunk.chunkIndex + 1}/{chunk.context.totalChunks}
                  </button>
                );
              })}
            </aside>

            <div className="ai-rename-review-body">
              {activeChunk ? (
                <>
                  <header className="ai-rename-review-header">
                    <div>
                      <h4>{activeChunk.context.frameName}</h4>
                      <small>
                        {acceptedEntries.length} of {activeDraftRenames.length} selected
                      </small>
                    </div>
                    <div className="ai-rename-review-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={handleSkipActiveChunk}
                      >
                        Skip batch
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleApplyActiveChunk}
                        disabled={applyDisabled}
                      >
                        Apply selected
                      </button>
                    </div>
                  </header>

                  {hasInvalidAccepted && (
                    <div className="ai-rename-warning">
                      Fill in a name for every selected layer before applying.
                    </div>
                  )}

                  <div className="ai-rename-table">
                    <div className="ai-rename-table-row ai-rename-table-row--head">
                      <span>Layer</span>
                      <span>Suggested name</span>
                      <span>Accept</span>
                    </div>
                    {activeDraftRenames.map((entry) => {
                      const layer = activeLayerMap.get(entry.id);
                      return (
                        <div className="ai-rename-table-row" key={entry.id}>
                          <div>
                            <strong>{entry.oldName}</strong>
                            <small>
                              {formatLayerType(layer?.type)} · Depth{" "}
                              {layer?.depth ?? "?"}
                            </small>
                          </div>
                          <div>
                            <input
                              type="text"
                              value={entry.newName}
                              onChange={(event) =>
                                handleRenameNameChange(entry.id, event.target.value)
                              }
                              className={
                                entry.accept && !entry.newName.trim().length
                                  ? "ai-rename-input-error"
                                  : undefined
                              }
                            />
                          </div>
                          <div>
                            <input
                              type="checkbox"
                              checked={entry.accept}
                              onChange={(event) =>
                                handleRenameAcceptToggle(entry.id, event.target.checked)
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="ai-rename-empty">
                  Select a batch on the left to review rename suggestions.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="ai-rename-section">
        <div className="ai-rename-section-header">
          <h3>Undo &amp; redo</h3>
        </div>
        <div className="ai-rename-history">
          <button
            className="btn btn-secondary"
            onClick={onUndo}
            disabled={!historyState.canUndo}
          >
            Undo last rename
          </button>
          <button
            className="btn btn-secondary"
            onClick={onRedo}
            disabled={!historyState.canRedo}
          >
            Redo
          </button>
          <div className="ai-rename-history-meta">
            <span>
              Stored operations: {historyState.historyDepth} · Redo stack:{" "}
              {historyState.redoDepth}
            </span>
            <small>
              Plugin undo history respects the limit above and supplements Figma&apos;s native Cmd/Ctrl+Z.
            </small>
          </div>
        </div>
      </section>

      <datalist id="layer-type-suggestions">
        {LAYER_TYPE_SUGGESTIONS.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </div>
  );
}

function toChunkKey(chunkIndex: number): string {
  return String(chunkIndex);
}

function cloneConfig(config: AIRenameConfig): AIRenameConfig {
  return {
    ...config,
    namingTemplates: (config.namingTemplates ?? []).map((template) => ({
      ...template,
    })),
    layerTypeRules: (config.layerTypeRules ?? []).map((rule) => ({
      ...rule,
    })),
    excludePatterns: [...(config.excludePatterns ?? [])],
  };
}

function serializeConfig(config: AIRenameConfig): string {
  return JSON.stringify({
    ...config,
    namingTemplates: (config.namingTemplates ?? []).map((template) => ({
      ...template,
    })),
    layerTypeRules: (config.layerTypeRules ?? []).map((rule) => ({
      ...rule,
    })),
    excludePatterns: [...(config.excludePatterns ?? [])],
  });
}

function formatModelLabel(model?: string) {
  const match = MODEL_OPTIONS.find((option) => option.value === model);
  return match ? match.label : "Not configured";
}

function formatLayerType(type?: string) {
  if (!type) return "Layer";
  const lower = type.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
