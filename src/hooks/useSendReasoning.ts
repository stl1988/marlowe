import { useState, useEffect, useCallback } from 'react';
import { useFS } from '@/hooks/useFS';
import { useFSPaths } from '@/hooks/useFSPaths';
import { DotAI } from '@/lib/DotAI';

/**
 * Hook to read and toggle the per-project "send reasoning history" setting.
 *
 * By default, assistant `reasoning_content` (thinking traces) is stripped
 * from the message history before sending to the provider — it is not needed
 * back and would be re-billed as input tokens on every turn. Some
 * provider/model combinations (e.g. certain Kimi models via PayPerQ) appear
 * to produce better results or keep their cache coherent when the reasoning
 * is included, so this can be re-enabled per project.
 *
 * The setting is persisted to `.git/shakespeare/settings.json` in the project dir.
 */
export function useSendReasoning(projectId: string) {
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const [sendReasoning, setSendReasoningState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cwd = `${projectsPath}/${projectId}`;

  // Load the current setting from disk on mount / project change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const dotAI = new DotAI(fs, cwd);
        const value = await dotAI.readSendReasoning();
        if (!cancelled) setSendReasoningState(value);
      } catch {
        if (!cancelled) setSendReasoningState(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fs, cwd]);

  /** Persist a new value */
  const setSendReasoning = useCallback(async (enabled: boolean) => {
    setSendReasoningState(enabled);
    try {
      const dotAI = new DotAI(fs, cwd);
      await dotAI.writeSendReasoning(enabled);
    } catch (error) {
      console.warn('Failed to persist send-reasoning setting:', error);
    }
  }, [fs, cwd]);

  /** Toggle the current value */
  const toggleSendReasoning = useCallback(() => {
    setSendReasoning(!sendReasoning);
  }, [setSendReasoning, sendReasoning]);

  return { sendReasoning, setSendReasoning, toggleSendReasoning, isLoading };
}
