import { useEffect, useRef, useCallback, useState } from 'react';

interface UseKeepAliveOptions {
  /** Whether the current AI run or build needs background keep-alive. */
  enabled: boolean;
  /** Title shown in the operating system's media controls. */
  title: string;
  /** Artist shown in the operating system's media controls. */
  artist: string;
  artwork?: MediaImage[];
}

type RetryListener = [type: 'pointerdown' | 'keydown', listener: () => void];

/**
 * Keep the tab responsive during long AI/build operations using a near-silent
 * audio loop and the Media Session API. Callback identities remain stable while
 * streaming re-renders; the latest options are read from a ref instead.
 */
export function useKeepAlive({ enabled, title, artist, artwork = [] }: UseKeepAliveOptions) {
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isActiveRef = useRef(false);
  const retryListenersRef = useRef<RetryListener[]>([]);
  const userPausedRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const optionsRef = useRef({ enabled, title, artist, artwork });
  optionsRef.current = { enabled, title, artist, artwork };

  const clearRetryListeners = useCallback(() => {
    for (const [type, listener] of retryListenersRef.current) {
      document.removeEventListener(type, listener);
    }
    retryListenersRef.current = [];
  }, []);

  const markPlaying = useCallback((audio: HTMLAudioElement) => {
    // A late play() resolution must not revive a torn-down audio element.
    if (audioElementRef.current !== audio) return;
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    setIsActive(true);
    console.log('Keep-alive playing (silent audio + media session)');
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (!isActiveRef.current) return;
    clearRetryListeners();

    try {
      const audio = audioElementRef.current;
      audioElementRef.current = null;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
        audio.parentNode?.removeChild(audio);
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
      }

      isActiveRef.current = false;
      setIsActive(false);
      console.log('Keep-alive stopped');
    } catch (error) {
      console.error('Failed to stop keep-alive:', error);
    }
  }, [clearRetryListeners]);

  const startKeepAlive = useCallback(async () => {
    if (isActiveRef.current || !optionsRef.current.enabled) return;
    isActiveRef.current = true;
    const { title: currentTitle, artist: currentArtist, artwork: currentArtwork } = optionsRef.current;

    try {
      const audio = document.createElement('audio');
      audioElementRef.current = audio;
      audio.src = '/sine.mp3';
      audio.loop = true;
      audio.volume = 0.01;
      audio.preload = 'auto';
      audio.style.display = 'none';
      audio.setAttribute('aria-hidden', 'true');
      document.body.appendChild(audio);

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTitle,
          artist: currentArtist,
          artwork: currentArtwork,
        });
        navigator.mediaSession.setActionHandler('play', () => {
          userPausedRef.current = false;
          const element = audioElementRef.current;
          if (element) element.play().then(() => markPlaying(element)).catch(console.error);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          userPausedRef.current = true;
          stopKeepAlive();
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          userPausedRef.current = true;
          stopKeepAlive();
        });
      }

      await audio.play();
      markPlaying(audio);
    } catch (error) {
      console.warn('Keep-alive play() rejected, retrying on next user interaction:', error);
      if (!isActiveRef.current || audioElementRef.current === null) return;

      clearRetryListeners();
      const retry = () => {
        const element = audioElementRef.current;
        if (!element) return;
        element.play().then(() => {
          markPlaying(element);
          clearRetryListeners();
        }).catch((retryError) => {
          console.error('Keep-alive retry failed:', retryError);
        });
      };
      const onPointerDown = () => retry();
      const onKeyDown = () => retry();
      retryListenersRef.current = [
        ['pointerdown', onPointerDown],
        ['keydown', onKeyDown],
      ];
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
    }
  }, [stopKeepAlive, clearRetryListeners, markPlaying]);

  const updateMetadata = useCallback((newTitle: string, newArtist?: string) => {
    if (!isActiveRef.current || !('mediaSession' in navigator)) return;
    const { artist: currentArtist, artwork: currentArtwork } = optionsRef.current;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: newTitle,
        artist: newArtist || currentArtist,
        artwork: currentArtwork,
      });
    } catch (error) {
      console.error('Failed to update media session metadata:', error);
    }
  }, []);

  useEffect(() => () => stopKeepAlive(), [stopKeepAlive]);

  useEffect(() => {
    if (enabled && !isActiveRef.current) {
      userPausedRef.current = false;
      const timer = setTimeout(() => void startKeepAlive(), 100);
      return () => clearTimeout(timer);
    }
    if (!enabled && isActiveRef.current) stopKeepAlive();
  }, [enabled, startKeepAlive, stopKeepAlive]);

  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== 'visible' || !optionsRef.current.enabled || userPausedRef.current) return;
      const audio = audioElementRef.current;
      if (!isActiveRef.current || !audio) {
        void startKeepAlive();
        return;
      }
      if (audio.paused) audio.play().then(() => markPlaying(audio)).catch(() => {});
    };

    document.addEventListener('visibilitychange', resync);
    window.addEventListener('pageshow', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('pageshow', resync);
    };
  }, [startKeepAlive, markPlaying]);

  return {
    /** True only while the keep-alive audio is actually playing. */
    isActive,
    startKeepAlive,
    stopKeepAlive,
    updateMetadata,
  };
}
