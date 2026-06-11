export const FOCUS_MUSIC_STORAGE_KEYS = {
  track: "focusMusicTrack",
  volume: "focusMusicVolume",
  loop: "focusMusicLoop",
} as const;

export const FOCUS_MUSIC_TRACKS = [
  { id: "lofi", label: "LoFi Beats", file: "lofi.mp3" },
  { id: "rain", label: "Rain Sounds", file: "rain.mp3" },
  { id: "brown-noise", label: "Brown Noise", file: "brown-noise.mp3" },
  { id: "forest", label: "Forest Ambience", file: "forest.mp3" },
  { id: "library", label: "Library Ambience", file: "library.mp3" },
] as const;

export type FocusMusicTrackId = (typeof FOCUS_MUSIC_TRACKS)[number]["id"];

export function getFocusMusicSrc(trackId: FocusMusicTrackId): string {
  const track = FOCUS_MUSIC_TRACKS.find((t) => t.id === trackId);
  return track ? `/focus-music/${track.file}` : `/focus-music/${FOCUS_MUSIC_TRACKS[0].file}`;
}

export function isFocusMusicTrackId(value: string): value is FocusMusicTrackId {
  return FOCUS_MUSIC_TRACKS.some((t) => t.id === value);
}
