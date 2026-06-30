import { useState } from 'react';
import { useStorageEstimate } from '@/hooks/useStorageEstimate';
import { useAISettings } from '@/hooks/useAISettings';
import { useProviderModels } from '@/hooks/useProviderModels';
import { useSessionSubscription } from '@/hooks/useSessionSubscription';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StatusBarsProps {
  projectId: string;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** A single 3px-tall labeled progress bar */
function ThinBar({
  fraction,
  color,
  label,
  tooltip,
}: {
  fraction: number;
  color: string;
  label: string;
  tooltip: string;
}) {
  const pct = Math.min(Math.max(fraction * 100, 0), 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 w-full cursor-default select-none">
          <span className="text-[9px] text-muted-foreground/60 shrink-0 w-[52px] text-right leading-none tabular-nums">
            {label}
          </span>
          <div className="flex-1 h-[3px] bg-muted rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', color)}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function StatusBars({ projectId, className }: StatusBarsProps) {
  const storage = useStorageEstimate();
  const { settings } = useAISettings();
  const { models } = useProviderModels();

  // Track last input tokens for this project via session events
  const [lastInputTokens, setLastInputTokens] = useState<number>(0);

  useSessionSubscription(
    'contextUsageUpdated',
    (updatedProjectId: string, inputTokens: number) => {
      if (updatedProjectId === projectId) {
        setLastInputTokens(inputTokens);
      }
    },
    [projectId],
  );

  // Current model is the most recently used one
  const currentModelFullId = settings.recentlyUsedModels?.[0] ?? '';
  const currentModel = models.find(m => m.fullId === currentModelFullId);
  const contextLength = currentModel?.contextLength ?? null;

  // ── Storage bar ────────────────────────────────────────────────────────────
  const storageFraction = storage?.fraction ?? 0;
  const storageColor =
    storageFraction > 0.9 ? 'bg-destructive' :
    storageFraction > 0.7 ? 'bg-yellow-500' :
    'bg-primary/70';

  const storageLabel = storage
    ? `${formatBytes(storage.usageBytes)} / ${formatBytes(storage.quotaBytes)}`
    : 'unknown';
  const storageTooltip = storage
    ? `Storage: ${storageLabel} used (${(storageFraction * 100).toFixed(1)}%)${storage.isPersisted === false ? ' — not persisted, at risk of eviction' : storage.isPersisted ? ' — persisted ✓' : ''}`
    : 'Storage usage unavailable';

  // ── Context bar ────────────────────────────────────────────────────────────
  const contextFraction = contextLength && lastInputTokens > 0
    ? Math.min(lastInputTokens / contextLength, 1)
    : 0;
  const contextColor =
    contextFraction > 0.9 ? 'bg-destructive' :
    contextFraction > 0.7 ? 'bg-yellow-500' :
    'bg-accent/80';

  const contextLabel = contextLength
    ? lastInputTokens > 0
      ? `${formatTokens(lastInputTokens)} / ${formatTokens(contextLength)}`
      : `${formatTokens(contextLength)} ctx`
    : currentModelFullId
      ? 'ctx unknown'
      : 'no model';

  const contextTooltip = contextLength
    ? lastInputTokens > 0
      ? `Context: ${lastInputTokens.toLocaleString()} / ${contextLength.toLocaleString()} tokens used (${(contextFraction * 100).toFixed(1)}%)`
      : `Context window: ${contextLength.toLocaleString()} tokens (${currentModel?.name ?? currentModelFullId})`
    : currentModelFullId
      ? `Context window size unknown for ${currentModelFullId}`
      : 'No model selected';

  return (
    <div className={cn('flex flex-col gap-[3px] px-2 py-1', className)}>
      <ThinBar
        fraction={storageFraction}
        color={storageColor}
        label={storage ? `${formatBytes(storage.usageBytes)}` : '…'}
        tooltip={storageTooltip}
      />
      <ThinBar
        fraction={contextFraction}
        color={contextColor}
        label={contextLength ? (lastInputTokens > 0 ? formatTokens(lastInputTokens) : `${formatTokens(contextLength)}`) : '…'}
        tooltip={contextTooltip}
      />
    </div>
  );
}
