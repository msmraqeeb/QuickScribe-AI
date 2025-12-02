
import { Subtitle, SubtitleStyle } from '../types';

export const burnSubtitles = async (
  videoFile: File,
  subtitles: Subtitle[],
  config: SubtitleStyle,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.crossOrigin = 'anonymous';
    // We need to play the video to record it. 
    // We unmute it to capture the audio stream.
    video.muted = false; 
    video.preload = 'auto';
    
    // Create AudioContext outside to handle audio mixing
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      // Ensure dimensions are even numbers (requirement for some encoders)
      canvas.width = video.videoWidth % 2 === 0 ? video.videoWidth : video.videoWidth - 1;
      canvas.height = video.videoHeight % 2 === 0 ? video.videoHeight : video.videoHeight - 1;
      
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Audio setup: Source -> Destination (Stream)
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      
      const audioTrack = dest.stream.getAudioTracks()[0];
      const canvasStream = canvas.captureStream(30); // 30 FPS target
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }

      // Strategy: 
      // 1. Force MP4 if possible (User Requirement)
      // 2. Fallback to specific H264 codecs
      // 3. Fallback to WebM only if absolutely necessary
      const mimeTypesCandidates = [
          'video/mp4', // Generic MP4 (Best for modern Chrome/Edge)
          'video/mp4;codecs=avc1',
          'video/mp4;codecs="avc1.42E01E, mp4a.40.2"', // Baseline
          'video/mp4;codecs="avc1.4d002a, mp4a.40.2"', // Main
          'video/mp4;codecs="avc1.64001f, mp4a.40.2"', // High
          'video/mp4;codecs=h264',
          'video/webm;codecs=h264', // WebM with H264
          'video/webm;codecs=vp9',
          'video/webm'
      ];

      // Filter and select supported type
      const selectedMimeType = mimeTypesCandidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
      
      if (!selectedMimeType) {
          reject(new Error("No supported video mime type found for recording."));
          return;
      }

      console.log(`Using MIME type for recording: ${selectedMimeType}`);

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps target quality
      });
      
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedMimeType });
        resolve(blob);
        // Cleanup resources
        setTimeout(() => {
            video.remove();
            canvas.remove();
            audioCtx.close();
            URL.revokeObjectURL(video.src);
        }, 100);
      };
      
      // Handle video ending - Use event listener for reliability
      video.onended = () => {
          onProgress(100);
          console.log("Video playback ended. Stopping recorder...");
          // Add a generous buffer delay to ensure the last frames are captured/encoded
          setTimeout(() => {
              if (recorder.state !== 'inactive') {
                  recorder.stop();
              }
          }, 1500);
      };

      // Error handling
      video.onerror = (e) => reject(new Error("Error playing video during processing."));

      // Render Loop function
      const renderFrame = () => {
        if (video.ended) return;

        if (!video.paused && !video.ended) {
            // Draw Video Frame
            ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Draw Subtitles
            const currentTime = video.currentTime;
            const activeSubtitle = subtitles.find(
                s => currentTime >= s.startTime && currentTime <= s.endTime
            );

            if (activeSubtitle) {
                drawSubtitleText(ctx!, activeSubtitle.text, config, canvas.width, canvas.height);
            }

            // Update Progress
            if (video.duration) {
                const progress = (video.currentTime / video.duration) * 100;
                // Cap progress at 99% until onended fires to avoid premature completion UI
                onProgress(Math.min(progress, 99));
            }
        }

        // Schedule next frame
        if ('requestVideoFrameCallback' in video) {
            // Superior method for video syncing
            (video as any).requestVideoFrameCallback(renderFrame);
        } else {
            // Fallback
            requestAnimationFrame(renderFrame);
        }
      };

      // Start everything
      recorder.start();
      
      // Ensure we start from the beginning
      video.currentTime = 0;
      
      video.play().then(() => {
          // Kick off the render loop
          if ('requestVideoFrameCallback' in video) {
              (video as any).requestVideoFrameCallback(renderFrame);
          } else {
              requestAnimationFrame(renderFrame);
          }
      }).catch(e => {
          console.error("Playback failed during processing", e);
          reject(e);
      });
    };
    
    video.onerror = (e) => reject(new Error("Error loading video source metadata."));
  });
};

export const trimVideo = async (
  videoFile: File,
  startTime: number,
  endTime: number,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.crossOrigin = 'anonymous';
    video.muted = false; // Capture audio
    video.preload = 'auto';

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();

    video.onloadedmetadata = () => {
      // Validate range
      if (startTime >= endTime || startTime < 0 || endTime > video.duration) {
          reject(new Error("Invalid trim range."));
          return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth % 2 === 0 ? video.videoWidth : video.videoWidth - 1;
      canvas.height = video.videoHeight % 2 === 0 ? video.videoHeight : video.videoHeight - 1;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
      }

      // Connect Audio
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      const audioTrack = dest.stream.getAudioTracks()[0];

      const canvasStream = canvas.captureStream(30);
      if (audioTrack) canvasStream.addTrack(audioTrack);

      const mimeTypesCandidates = [
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=h264',
          'video/webm'
      ];
      const selectedMimeType = mimeTypesCandidates.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      const recorder = new MediaRecorder(canvasStream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 8000000 
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      recorder.onstop = () => {
          const blob = new Blob(chunks, { type: selectedMimeType });
          resolve(blob);
          setTimeout(() => {
              video.remove();
              canvas.remove();
              audioCtx.close();
              URL.revokeObjectURL(video.src);
          }, 100);
      };

      // Seek to start
      video.currentTime = startTime;

      video.onseeked = () => {
          recorder.start();
          video.play().then(() => {
              renderFrame();
          }).catch(reject);
      };

      const renderFrame = () => {
          if (video.paused || video.ended) return;

          // Draw
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Check End Condition
          if (video.currentTime >= endTime) {
              video.pause();
              recorder.stop();
              onProgress(100);
              return;
          }

          // Progress
          const duration = endTime - startTime;
          const current = video.currentTime - startTime;
          onProgress(Math.min((current / duration) * 100, 99));

          if ('requestVideoFrameCallback' in video) {
              (video as any).requestVideoFrameCallback(renderFrame);
          } else {
              requestAnimationFrame(renderFrame);
          }
      };
    };
    
    video.onerror = () => reject(new Error("Error loading video."));
  });
};

export const convertVideo = async (
  videoFile: File,
  targetFormat: string,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.crossOrigin = 'anonymous';
    video.muted = false; // Capture audio
    video.preload = 'auto';

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioContextClass();

    video.onloadedmetadata = () => {
      // Setup Audio
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      const audioTrack = dest.stream.getAudioTracks()[0];

      // Check for audio-only formats
      const isAudioOnly = ['weba', 'mpa'].includes(targetFormat.toLowerCase());
      
      let canvas: HTMLCanvasElement | null = null;
      let ctx: CanvasRenderingContext2D | null = null;
      let stream: MediaStream;

      if (!isAudioOnly) {
          canvas = document.createElement('canvas');
          canvas.width = video.videoWidth % 2 === 0 ? video.videoWidth : video.videoWidth - 1;
          canvas.height = video.videoHeight % 2 === 0 ? video.videoHeight : video.videoHeight - 1;
          ctx = canvas.getContext('2d', { alpha: false });
          
          if (!ctx) {
              reject(new Error("Could not get canvas context"));
              return;
          }
          const canvasStream = canvas.captureStream(30); // 30 FPS constant rate
          if (audioTrack) canvasStream.addTrack(audioTrack);
          stream = canvasStream;
      } else {
          // Audio only stream
          stream = dest.stream;
      }

      // Determine Best Output MIME Type for MediaRecorder
      let selectedMimeType = '';
      
      if (isAudioOnly) {
          const audioCandidates = [
              'audio/webm;codecs=opus',
              'audio/webm',
              'audio/mp4' // Some browsers support this
          ];
          selectedMimeType = audioCandidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
      } else {
          // Map target extension to container logic
          const mp4Compatible = ['mp4', 'm4v', 'mov', 'qt', '3gp', 'moov'];
          // const webmCompatible = ['webm', 'mk3d']; 
          // Legacy formats often just want a video stream that can be saved with that extension
          
          if (mp4Compatible.includes(targetFormat)) {
              const mp4Candidates = [
                  'video/mp4;codecs=avc1', 
                  'video/mp4;codecs="avc1.42E01E, mp4a.40.2"',
                  'video/mp4'
              ];
              selectedMimeType = mp4Candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
          }
          
          // Fallback to WebM if MP4 not supported or if target is WebM-ish or Legacy/Unsupported by browser native
          if (!selectedMimeType) {
              const webmCandidates = [
                  'video/webm;codecs=vp9',
                  'video/webm;codecs=h264',
                  'video/webm'
              ];
              selectedMimeType = webmCandidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
          }
      }

      if (!selectedMimeType) {
          reject(new Error(`Your browser cannot encode to a format compatible with ${targetFormat.toUpperCase()}. Try using Chrome or Edge.`));
          return;
      }

      console.log(`Converting to ${targetFormat} using container: ${selectedMimeType}`);

      const recorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 8000000 // 8 Mbps
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      
      recorder.onstop = () => {
          // Create blob with the actual MIME type, but we will let the download anchor tag handle the extension
          const blob = new Blob(chunks, { type: selectedMimeType });
          resolve(blob);
          setTimeout(() => {
              video.remove();
              if (canvas) canvas.remove();
              audioCtx.close();
              URL.revokeObjectURL(video.src);
          }, 100);
      };

      video.onended = () => {
          recorder.stop();
          onProgress(100);
      };

      const renderFrame = () => {
          if (video.paused || video.ended) return;

          if (ctx && canvas) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }

          // Progress
          if (video.duration) {
              onProgress(Math.min((video.currentTime / video.duration) * 100, 99));
          }

          if ('requestVideoFrameCallback' in video) {
              (video as any).requestVideoFrameCallback(renderFrame);
          } else {
              requestAnimationFrame(renderFrame);
          }
      };

      // Start Recording & Playback
      recorder.start();
      video.play().then(() => {
          renderFrame();
      }).catch(reject);
    };
    
    video.onerror = () => reject(new Error("Error loading video file."));
  });
};

function hexToRgba(hex: string, alpha: number) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0,0,0,${alpha})`;
  return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
}

function drawSubtitleText(
  ctx: CanvasRenderingContext2D, 
  text: string, 
  config: SubtitleStyle, 
  width: number, 
  height: number
) {
  const referenceWidth = 800;
  const scaleFactor = width / referenceWidth; 
  const scaledFontSize = Math.max(config.fontSize * scaleFactor, 12);
  
  ctx.font = `600 ${scaledFontSize}px ${config.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = words[0];
  const maxWidth = width * 0.9; 

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width < maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);

  const lineHeight = scaledFontSize * 1.4;
  const totalTextHeight = lines.length * lineHeight;
  
  let startY = 0;
  if (config.position === 'top') {
    startY = height * 0.1;
  } else if (config.position === 'middle') {
    startY = (height - totalTextHeight) / 2;
  } else {
    startY = height * 0.9 - totalTextHeight;
  }

  lines.forEach((line, i) => {
    const y = startY + (i * lineHeight);
    const textWidth = ctx.measureText(line).width;
    const x = width / 2;

    if (config.backgroundOpacity > 0) {
      ctx.fillStyle = hexToRgba(config.backgroundColor, config.backgroundOpacity);
      const padding = scaledFontSize * 0.3;
      const bgY = y - (padding/2);
      ctx.fillRect(
        x - textWidth / 2 - padding,
        bgY,
        textWidth + padding * 2,
        lineHeight
      );
    }

    ctx.fillStyle = config.color;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText(line, x, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });
}
