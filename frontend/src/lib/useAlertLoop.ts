import { useCallback, useEffect, useRef } from "react";
import {
  cancelAlertAudio,
  isAudioMuted,
  playAlertSequence,
  subscribeAudioMuted,
} from "./audioAlerts";

/** Breath between loop iterations so the chime and voice never trample each other. */
const LOOP_PAUSE_MS = 2000;

/**
 * Repeats the spacecraft chime + spoken warning for as long as an alert
 * surface is open. Closing the surface, muting, or unmounting clears the
 * pending pause, cancels speech mid-sentence, and stops the chime instantly.
 */
export function useAlertLoop(active: boolean, message: string | null): () => void {
  const isAlertLoopingRef = useRef(false);
  const loopTimeoutRef = useRef<number | null>(null);

  const stopAlertLoop = useCallback(() => {
    isAlertLoopingRef.current = false;
    if (loopTimeoutRef.current !== null) {
      window.clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    cancelAlertAudio();
  }, []);

  useEffect(() => {
    if (!active || !message || isAudioMuted()) {
      stopAlertLoop();
      return;
    }

    let cancelled = false;
    isAlertLoopingRef.current = true;
    // Start from silence so an in-flight one-shot alert cannot overlap.
    cancelAlertAudio();

    const loop = async () => {
      if (cancelled || !isAlertLoopingRef.current) return;
      await playAlertSequence(message);
      if (cancelled || !isAlertLoopingRef.current) return;
      if (isAudioMuted()) {
        stopAlertLoop();
        return;
      }
      // onend has fired (or speech failed): hold the 2s pause, then replay.
      loopTimeoutRef.current = window.setTimeout(() => {
        loopTimeoutRef.current = null;
        void loop();
      }, LOOP_PAUSE_MS);
    };

    void loop();

    // Muting from the top bar must silence a running loop immediately.
    const unsubscribe = subscribeAudioMuted(() => {
      if (isAudioMuted()) stopAlertLoop();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      stopAlertLoop();
    };
  }, [active, message, stopAlertLoop]);

  return stopAlertLoop;
}
