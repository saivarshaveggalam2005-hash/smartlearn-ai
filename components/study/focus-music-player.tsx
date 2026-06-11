"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Repeat, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FOCUS_MUSIC_STORAGE_KEYS,
  FOCUS_MUSIC_TRACKS,
  getFocusMusicSrc,
  isFocusMusicTrackId,
  type FocusMusicTrackId,
} from "@/lib/focus-music-tracks";

const DEFAULT_TRACK: FocusMusicTrackId = "lofi";
const DEFAULT_VOLUME = 0.5;

function readStoredTrack(): FocusMusicTrackId {
  if (typeof window === "undefined") return DEFAULT_TRACK;
  const stored = localStorage.getItem(FOCUS_MUSIC_STORAGE_KEYS.track);
  return stored && isFocusMusicTrackId(stored) ? stored : DEFAULT_TRACK;
}

function readStoredVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  const stored = localStorage.getItem(FOCUS_MUSIC_STORAGE_KEYS.volume);
  if (!stored) return DEFAULT_VOLUME;
  const parsed = Number.parseFloat(stored);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : DEFAULT_VOLUME;
}

function readStoredLoop(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(FOCUS_MUSIC_STORAGE_KEYS.loop);
  return stored !== "false";
}

export const FocusMusicPlayer = memo(function FocusMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedTrackRef = useRef<FocusMusicTrackId | null>(null);

  const [trackId, setTrackId] = useState<FocusMusicTrackId>(DEFAULT_TRACK);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [loop, setLoop] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTrackId(readStoredTrack());
    setVolume(readStoredVolume());
    setLoop(readStoredLoop());
    setHydrated(true);
  }, []);

  const disposeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audioRef.current = null;
    loadedTrackRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      disposeAudio();
    };
  }, [disposeAudio]);

  const ensureAudio = useCallback(
    (nextTrackId: FocusMusicTrackId) => {
      if (audioRef.current && loadedTrackRef.current === nextTrackId) {
        audioRef.current.volume = volume;
        audioRef.current.loop = loop;
        return audioRef.current;
      }

      disposeAudio();

      const audio = new Audio(getFocusMusicSrc(nextTrackId));
      audio.preload = "none";
      audio.volume = volume;
      audio.loop = loop;
      audioRef.current = audio;
      loadedTrackRef.current = nextTrackId;

      audio.addEventListener("ended", () => {
        if (!audio.loop) setIsPlaying(false);
      });
      audio.addEventListener("pause", () => {
        if (audio.ended && audio.loop) return;
        if (!audio.error) setIsPlaying(false);
      });
      audio.addEventListener("play", () => setIsPlaying(true));

      return audio;
    },
    [disposeAudio, loop, volume]
  );

  const handlePlay = useCallback(async () => {
    try {
      const audio = ensureAudio(trackId);
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [ensureAudio, trackId]);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handleTrackChange = useCallback(
    (nextTrackId: FocusMusicTrackId) => {
      setTrackId(nextTrackId);
      localStorage.setItem(FOCUS_MUSIC_STORAGE_KEYS.track, nextTrackId);

      if (loadedTrackRef.current && loadedTrackRef.current !== nextTrackId) {
        const wasPlaying = isPlaying;
        disposeAudio();
        setIsPlaying(false);
        if (wasPlaying) {
          void (async () => {
            try {
              const audio = ensureAudio(nextTrackId);
              await audio.play();
              setIsPlaying(true);
            } catch {
              setIsPlaying(false);
            }
          })();
        }
      }
    },
    [disposeAudio, ensureAudio, isPlaying]
  );

  const handleVolumeChange = useCallback((nextVolume: number) => {
    const clamped = Math.min(1, Math.max(0, nextVolume));
    setVolume(clamped);
    localStorage.setItem(FOCUS_MUSIC_STORAGE_KEYS.volume, String(clamped));
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const handleLoopToggle = useCallback(() => {
    setLoop((prev) => {
      const next = !prev;
      localStorage.setItem(FOCUS_MUSIC_STORAGE_KEYS.loop, String(next));
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  }, []);

  if (!hydrated) return null;

  return (
    <Card className="glass border-border/60">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Headphones className="h-3.5 w-3.5 text-violet-400" />
          Focus Music
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 px-3 pb-3 pt-0">
        <select
          value={trackId}
          onChange={(e) => handleTrackChange(e.target.value as FocusMusicTrackId)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Focus music track"
        >
          {FOCUS_MUSIC_TRACKS.map((track) => (
            <option key={track.id} value={track.id}>
              {track.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-xs px-2"
            onClick={handlePlay}
            disabled={isPlaying}
            aria-label="Play focus music"
          >
            <Play className="h-3 w-3 mr-1" />
            Play
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-xs px-2"
            onClick={handlePause}
            disabled={!isPlaying}
            aria-label="Pause focus music"
          >
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
          <Button
            type="button"
            size="sm"
            variant={loop ? "secondary" : "outline"}
            className="h-7 w-7 p-0 shrink-0"
            onClick={handleLoopToggle}
            aria-label={loop ? "Loop enabled" : "Loop disabled"}
            title={loop ? "Loop on" : "Loop off"}
          >
            <Repeat className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => handleVolumeChange(Number.parseFloat(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-violet-500"
            aria-label="Focus music volume"
          />
          <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
            {Math.round(volume * 100)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
