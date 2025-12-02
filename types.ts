export interface Subtitle {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitleStyle {
  fontSize: number; // in px
  color: string;
  backgroundColor: string; // hex or rgba
  backgroundOpacity: number; // 0 to 1
  position: 'top' | 'middle' | 'bottom';
  fontFamily: string;
}

export interface VideoState {
  file: File | null;
  url: string | null;
  duration: number;
}
