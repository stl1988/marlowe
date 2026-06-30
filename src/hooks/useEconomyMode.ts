import { useState, useEffect, useCallback } from 'react';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { DotAI } from '@/lib/DotAI';

/**
 * Hook to read and toggle the per-project "economy mode" setting.
 *
 * Economy mode injects credit-saving instructions into the AI system prompt,
 * telling the agent to minimise tool calls, skip speculative reads, batch edits,
 * and keep responses brief.
 *
 * The setting is persisted to `.git/shakespeare/settings.json` in the project dir.
 */
export function useEconomyMode(projectId: string) {
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const [economyMode, setEconomyModeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cwd = `${projectsPath}/${projectId}`;

  // Load the current setting from disk on mount / project change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const dotAI = new DotAI(fs, cwd);
        const value = await dotAI.readEconomyMode();
        if (!cancelled) setEconomyModeState(value);
      } catch {
        if (!cancelled) setEconomyModeState(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fs, cwd]);

  /** Persist a new economy mode value */
  const setEconomyMode = useCallback(async (enabled: boolean) => {
    setEconomyModeState(enabled);
    try {
      const dotAI = new DotAI(fs, cwd);
      await dotAI.writeEconomyMode(enabled);
    } catch (error) {
      console.warn('Failed to persist economy mode setting:', error);
    }
  }, [fs, cwd]);

  /** Toggle the current value */
  const toggleEconomyMode = useCallback(() => {
    setEconomyMode(!economyMode);
  }, [setEconomyMode, economyMode]);

  return { economyMode, setEconomyMode, toggleEconomyMode, isLoading };
}
