import { useEffect, useRef, useState } from "react";

import type { Timer } from "src/types";
import { timerSeconds } from "src/utils";

export function useTimerAlarm(timers: NonNullable<Timer>[], now: number) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const alerted = useRef(new Set<string>());
  const enableSound = async (enabled: boolean) => {
    if (enabled) {
      try {
        audio.current ??= new AudioContext();
        await audio.current.resume();
      } catch {
        setSoundEnabled(false);
        return false;
      }
    }
    setSoundEnabled(enabled);
    return true;
  };
  useEffect(() => {
    for (const timer of timers) {
      if (timer.paused !== undefined || timerSeconds(timer, now) !== 0)
        continue;
      const key = `${timer.mealId}:${timer.step}:${timer.end}`;
      if (alerted.current.has(key)) continue;
      alerted.current.add(key);
      if (soundEnabled && audio.current?.state === "running") {
        const context = audio.current;
        for (let n = 0; n < 3; n++) {
          const oscillator = context.createOscillator();
          const volume = context.createGain();
          volume.gain.value = 0.12;
          oscillator.frequency.value = 880;
          oscillator.connect(volume);
          volume.connect(context.destination);
          oscillator.start(context.currentTime + n * 0.4);
          oscillator.stop(context.currentTime + n * 0.4 + 0.2);
        }
      }
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(
            document.documentElement.lang === "vi"
              ? "Hẹn giờ đã hết"
              : "Cooking timer finished",
            { body: `${timer.mealId} · ${timer.step + 1}` },
          );
        } catch {
          /* Some mobile browsers require a service worker. */
        }
      }
    }
  }, [timers, now, soundEnabled]);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  return { soundEnabled, enableSound };
}
