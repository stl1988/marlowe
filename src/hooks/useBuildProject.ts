import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { buildProject, type BuildProgress } from '@/lib/build';
import { useFS } from './useFS';
import { useFSPaths } from './useFSPaths';
import { useAppContext } from './useAppContext';

export function useBuildProject(projectId: string) {
  const { fs } = useFS();
  const { projectsPath } = useFSPaths();
  const { config } = useAppContext();
  const [progress, setProgress] = useState<BuildProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const versionInfo = {
        version: import.meta.env.VERSION ?? '0.0.0',
        buildDate: new Date().toISOString(),
      };
      return buildProject({
        fs,
        projectPath: `${projectsPath}/${projectId}`,
        domParser: new DOMParser(),
        esmUrl: config.esmUrl,
        versionInfo,
        onProgress: (event) => setProgress(event.phase === 'done' ? null : event),
      });
    },
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress };
}
