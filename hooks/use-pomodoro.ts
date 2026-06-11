"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface PomodoroConfig {
  focusMinutes: number;
  breakMinutes?: number;
  totalSessions: number;
}

const DEFAULT_FOCUS = 25;
const DEFAULT_BREAK = 5;
const DEFAULT_SESSIONS = 1;

export function usePomodoro(
  config?: Partial<PomodoroConfig>,
  onComplete?: () => void
) {
  const focusMinutes = config?.focusMinutes ?? DEFAULT_FOCUS;
  const breakMinutes = config?.breakMinutes ?? DEFAULT_BREAK;
  const totalSessions = config?.totalSessions ?? DEFAULT_SESSIONS;

  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [allSessionsDone, setAllSessionsDone] = useState(false);
  const completedRef = useRef(0);

  useEffect(() => {
    setIsRunning(false);
    setIsBreak(false);
    setCompletedSessions(0);
    completedRef.current = 0;
    setAllSessionsDone(false);
    setSecondsLeft(focusMinutes * 60);
  }, [focusMinutes, breakMinutes, totalSessions]);

  useEffect(() => {
    if (!isRunning || allSessionsDone) return;

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;

        if (!isBreak) {
          const nextCompleted = completedRef.current + 1;
          completedRef.current = nextCompleted;
          setCompletedSessions(nextCompleted);
          onComplete?.();

          if (nextCompleted >= totalSessions) {
            setAllSessionsDone(true);
            setIsRunning(false);
            return 0;
          }

          setIsBreak(true);
          return breakMinutes * 60;
        }

        setIsBreak(false);
        return focusMinutes * 60;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isRunning,
    isBreak,
    onComplete,
    focusMinutes,
    breakMinutes,
    totalSessions,
    allSessionsDone,
  ]);

  const toggle = useCallback(() => {
    if (allSessionsDone) return;
    setIsRunning((r) => !r);
  }, [allSessionsDone]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setIsBreak(false);
    setCompletedSessions(0);
    completedRef.current = 0;
    setAllSessionsDone(false);
    setSecondsLeft(focusMinutes * 60);
  }, [focusMinutes]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const currentPhaseTotal = isBreak ? breakMinutes * 60 : focusMinutes * 60;
  const elapsedInPhase = Math.max(0, currentPhaseTotal - secondsLeft);
  const overallElapsedSeconds =
    completedSessions * focusMinutes * 60 + (isBreak ? 0 : elapsedInPhase);
  const overallTotalSeconds = totalSessions * focusMinutes * 60;

  return {
    minutes,
    seconds,
    formatted: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    isRunning,
    isBreak,
    sessions: completedSessions,
    totalSessions,
    focusMinutes,
    breakMinutes,
    allSessionsDone,
    toggle,
    reset,
    progress: allSessionsDone
      ? 1
      : overallTotalSeconds > 0
        ? Math.min(1, overallElapsedSeconds / overallTotalSeconds)
        : 0,
  };
}
