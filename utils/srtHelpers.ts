import { Subtitle } from '../types';
import { jsPDF } from 'jspdf';

// Helper to convert SRT time string "00:00:01,500" or "00:00:01.500" to seconds
export function timeToSeconds(timeString: string | undefined | null): number {
  if (!timeString) return 0;
  
  // Robustly handle separators. Replace dots with commas to standardize for splitting if needed,
  // or simply split by any non-digit separator.
  // Standard SRT is HH:MM:SS,mmm
  
  // Replace dot with comma just to normalize for the simple split logic below
  const normalized = timeString.replace('.', ',');
  let timePart = normalized;
  let milliseconds = "0";

  if (normalized.includes(',')) {
      const split = normalized.split(',');
      timePart = split[0];
      milliseconds = split[1] || "0";
  }

  const parts = timePart.split(':').map(Number);
  
  let hours = 0, minutes = 0, seconds = 0;
  
  if (parts.length === 3) {
      [hours, minutes, seconds] = parts;
  } else if (parts.length === 2) {
      [minutes, seconds] = parts;
  } else if (parts.length === 1) {
      [seconds] = parts;
  }
  
  // Return robust calculated time, default to 0 if NaN
  const result = hours * 3600 + minutes * 60 + seconds + (Number(milliseconds) || 0) / 1000;
  return isNaN(result) ? 0 : result;
}

// Robust SRT parser that handles variations in AI output
export function parseSRT(srtContent: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Handle double newlines as block separators, but be flexible with whitespace
  const blocks = normalized.split(/\n\s*\n/);

  blocks.forEach((block) => {
    const lines = block.trim().split('\n');
    if (lines.length === 0) return;

    // Try to find the time line. Often it's the second line, but sometimes ID is missing.
    // Look for "-->"
    const timeLineIndex = lines.findIndex(line => line.includes('-->'));

    if (timeLineIndex !== -1) {
      const timeLine = lines[timeLineIndex];
      // Regex accepts comma or dot for ms, and optional milliseconds
      const timeMatch = timeLine.match(/(\d{1,2}:\d{2}:\d{2}(?:[,.]\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}:\d{2}(?:[,.]\d{1,3})?)/);

      if (timeMatch) {
        const startTime = timeToSeconds(timeMatch[1]);
        const endTime = timeToSeconds(timeMatch[2]);
        
        // Text is everything after the time line
        const text = lines.slice(timeLineIndex + 1).join('\n').trim();

        if (text) {
             subtitles.push({
              id: subtitles.length + 1,
              startTime,
              endTime,
              text,
            });
        }
      }
    }
  });

  return subtitles;
}

// Helper to convert seconds back to SRT timestamp format
function secondsToTime(seconds: number, separator: string = ','): string {
  const pad = (num: number, size: number) => ('000' + num).slice(size * -1);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${separator}${pad(ms, 3)}`;
}

export function generateSRT(subtitles: Subtitle[]): string {
  return subtitles.map((sub, index) => {
    return `${index + 1}\n${secondsToTime(sub.startTime)} --> ${secondsToTime(sub.endTime)}\n${sub.text}`;
  }).join('\n\n');
}

export function generateVTT(subtitles: Subtitle[]): string {
  const header = "WEBVTT\n\n";
  const body = subtitles.map((sub) => {
    return `${secondsToTime(sub.startTime, '.')} --> ${secondsToTime(sub.endTime, '.')}\n${sub.text}`;
  }).join('\n\n');
  return header + body;
}

export function generateText(subtitles: Subtitle[]): string {
  return subtitles.map(sub => sub.text).join('\n');
}

export async function convertSubtitles(
  subtitles: Subtitle[], 
  format: 'srt' | 'vtt' | 'docx' | 'txt' | 'pdf'
): Promise<Blob> {
  switch (format) {
    case 'srt':
      return new Blob([generateSRT(subtitles)], { type: 'text/plain' });
    
    case 'vtt':
      return new Blob([generateVTT(subtitles)], { type: 'text/plain' });
    
    case 'txt':
      return new Blob([generateText(subtitles)], { type: 'text/plain' });
    
    case 'docx':
      // Create a basic HTML-based doc for simplicity which Word can open
      const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>Subtitles</title></head>
        <body>
          ${subtitles.map(sub => `
            <p><strong>${secondsToTime(sub.startTime)} --> ${secondsToTime(sub.endTime)}</strong><br/>
            ${sub.text}</p>
          `).join('')}
        </body></html>
      `;
      return new Blob([htmlContent], { type: 'application/msword' });

    case 'pdf':
      const doc = new jsPDF();
      let y = 10;
      const lineHeight = 10;
      const pageHeight = doc.internal.pageSize.height;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);

      subtitles.forEach((sub) => {
        // Check for page break
        if (y + (lineHeight * 2) > pageHeight - 10) {
            doc.addPage();
            y = 10;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`${secondsToTime(sub.startTime)} --> ${secondsToTime(sub.endTime)}`, 10, y);
        y += 6;

        doc.setFont("helvetica", "normal");
        const splitText = doc.splitTextToSize(sub.text, 180);
        doc.text(splitText, 10, y);
        y += (splitText.length * 6) + 4; // Add spacing
      });
      
      return doc.output('blob');

    default:
      throw new Error("Unsupported format");
  }
}