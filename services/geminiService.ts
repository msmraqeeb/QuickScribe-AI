import { GoogleGenAI, Type } from "@google/genai";
import { Subtitle } from '../types';
import { parseSRT, timeToSeconds } from '../utils/srtHelpers';

const API_KEY = process.env.API_KEY || '';

// Robust MIME type mapper
const getMimeType = (file: File): string => {
  // If the file type is specific (audio/ or video/) and not octet-stream, use it directly.
  if (file.type && (file.type.startsWith('audio/') || file.type.startsWith('video/')) && file.type !== 'application/octet-stream') {
      return file.type;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  
  const mimeMap: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'flac': 'audio/flac',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'mp4': 'video/mp4',
    'mpeg': 'video/mpeg',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'webm': 'video/webm',
    'flv': 'video/x-flv',
    'opus': 'audio/ogg',
    'weba': 'audio/webm',
    '3gp': 'video/3gpp',
    'ts': 'video/mp2t',
  };

  if (extension && mimeMap[extension]) {
    return mimeMap[extension];
  }

  if (file.type) return file.type;

  return 'audio/mpeg';
};

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      let result = reader.result as string;
      if (!result || !result.includes(',')) {
          reject(new Error("Failed to read file data."));
          return;
      }
      
      const commaIndex = result.indexOf(',');
      const base64String = result.substring(commaIndex + 1);
      
      // Memory optimization: clear result immediately
      result = ''; 

      resolve({
        inlineData: {
          data: base64String,
          mimeType: getMimeType(file),
        },
      });
    };
    reader.onerror = (error) => {
        console.error("FileReader Error:", error);
        reject(new Error("Failed to read file. The file might be too large for this browser to handle."));
    };
    try {
        reader.readAsDataURL(file);
    } catch (e) {
        reject(new Error("File is too large to process in memory."));
    }
  });
};

const cleanJsonResponse = (text: string): string => {
    // Remove markdown code blocks if present
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
    return cleaned.trim();
};

const isNetworkOrPayloadError = (error: any): boolean => {
    const msg = (error.message || '').toLowerCase();
    const status = error.status || 0;
    
    return msg.includes('xhr error') || 
           msg.includes('rpc failed') || 
           msg.includes('fetch') || 
           msg.includes('networkerror') ||
           msg.includes('413') ||
           status === 413 || // Payload Too Large
           (msg.includes('error code: 6') && msg.includes('rpc')); // gRPC-web XHR error
};

/**
 * CLIENT-SIDE AUDIO ANALYSIS (VAD)
 * Scans the audio file to find the exact millisecond where speech begins.
 * Uses Web Audio API to decode and check RMS amplitude.
 */
export const detectAudioOnset = async (videoFile: File): Promise<number> => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await videoFile.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); // Check first channel
        const sampleRate = audioBuffer.sampleRate;
        
        // Settings for VAD
        const frameSize = Math.floor(sampleRate * 0.05); // 50ms windows
        const threshold = 0.02; // RMS Threshold (adjust based on sensitivity needs)
        
        let consecutiveFrames = 0;
        const requiredConsecutive = 3; // Require ~150ms of sound to trigger to avoid clicks/pops
        
        for (let i = 0; i < rawData.length; i += frameSize) {
            let sumSquares = 0;
            // Calculate RMS for this frame
            const end = Math.min(i + frameSize, rawData.length);
            for (let j = i; j < end; j++) {
                sumSquares += rawData[j] * rawData[j];
            }
            const rms = Math.sqrt(sumSquares / (end - i));
            
            if (rms > threshold) {
                consecutiveFrames++;
                if (consecutiveFrames >= requiredConsecutive) {
                     // Return the start of the detected segment
                     // Backtrack to the start of the sequence
                     const onsetIndex = i - ((requiredConsecutive - 1) * frameSize);
                     return Math.max(0, onsetIndex / sampleRate);
                }
            } else {
                consecutiveFrames = 0;
            }
        }
        
        return 0; // Fallback if silence
    } catch (e) {
        console.warn("VAD Analysis failed, falling back to 0", e);
        return 0;
    }
};

/**
 * Calculates the offset needed to sync the first subtitle with the actual audio onset.
 */
export const calculateAutoSyncOffset = async (videoFile: File, subtitles: Subtitle[]): Promise<number> => {
    if (!subtitles || subtitles.length === 0) return 0;

    const actualAudioStart = await detectAudioOnset(videoFile);
    const firstSubtitleStart = subtitles[0].startTime;

    // We want the subtitle to start exactly when the audio starts (or slightly before).
    // Offset = Target - Current
    const offset = actualAudioStart - firstSubtitleStart;
    
    // Safety clamp: Don't shift more than 5 seconds either way automatically
    if (Math.abs(offset) > 5) return 0;

    return offset;
};

export const generateSubtitlesFromVideo = async (videoFile: File, language?: string): Promise<Subtitle[]> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure it.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash"; 

  try {
    const videoPart = await fileToGenerativePart(videoFile);

    // Optimized prompt for AUDIO-FOCUSED synchronization
    const prompt = `
      Task: Generate subtitles for the audio track of this video.
      Language: ${language ? `Translate or transcribe into ${language}` : 'Detect the ORIGINAL SPOKEN LANGUAGE and transcribe verbatim'}.
      
      CRITICAL TIMING INSTRUCTION:
      1. IGNORE VISUALS: Do not describe what is happening on screen. Listen ONLY to the speech.
      2. PHONETIC ATTACK: Set 'startTime' exactly when the sound of the FIRST syllable begins.
      3. ABSOLUTE ZERO TIMING: The video starts at 00:00:00,000. 
      4. NO BUFFER: Do not add "buffer" silence at the start. If speech starts at 0s, timestamp 0s.
      5. SEGMENTATION: 
         - Split long sentences into shorter chunks (max 10-12 words).
         - Max 2 lines per subtitle.
         - Max 42 characters per line.
      
      Return a JSON array of objects.
    `;

    let lastError: any;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [videoPart, { text: prompt }],
              },
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      startTime: { type: Type.STRING, description: "Start (HH:MM:SS,mmm)" },
                      endTime: { type: Type.STRING, description: "End (HH:MM:SS,mmm)" },
                      text: { type: Type.STRING, description: "The spoken text" }
                    },
                    required: ["startTime", "endTime", "text"]
                  }
                },
                thinkingConfig: { thinkingBudget: 0 },
                // System instruction tailored for precision
                systemInstruction: "You are an Audio Synchronization Engine. Your highest priority is matching the 'startTime' to the exact millisecond the audio waveform begins for that sentence. You ignore visual context and focus purely on speech timing.",
                safetySettings: [
                  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
              }
            });

            const jsonText = response.text;
            if (!jsonText) return [];

            const cleanedJson = cleanJsonResponse(jsonText);
            const json = JSON.parse(cleanedJson);
            
            if (!Array.isArray(json)) throw new Error("Invalid JSON format from AI");

            const parsedSubtitles: Subtitle[] = json.map((item: any, index: number) => {
                if (!item.text || typeof item.startTime === 'undefined') return null;

                let start = timeToSeconds(item.startTime);
                let end = timeToSeconds(item.endTime);

                // Apply simple 0.01s adjustment as requested
                const SHIFT_AMOUNT = 0.01;
                
                start = Math.max(0, start + SHIFT_AMOUNT);
                end = Math.max(start + 0.5, end + SHIFT_AMOUNT);

                return {
                    id: index + 1,
                    startTime: start,
                    endTime: end,
                    text: item.text
                };
            }).filter((s): s is Subtitle => s !== null);

            return parsedSubtitles;

        } catch (e: any) {
            console.warn(`Subtitle Generation Attempt ${attempt + 1} failed:`, e);
            lastError = e;
            
            // Check for Network/Payload error specifically
            if (isNetworkOrPayloadError(e)) {
                 throw new Error("Network Error: The video upload failed. The file might be too large or the connection was interrupted. Please try a smaller file (<20MB).");
            }

            const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
            if (isServerErr && attempt < maxAttempts - 1) {
                const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : 10000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break;
        }
    }
    
    throw lastError || new Error("Failed to generate subtitles.");

  } catch (error: any) {
    console.error("Error generating subtitles:", error);
     if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
        throw new Error("File is too large for the API.");
    }
    throw error;
  }
};

export const translateSubtitles = async (subtitles: Subtitle[], targetLanguage: string, onProgress?: (percent: number) => void): Promise<Subtitle[]> => {
  if (!API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash";

  // Chunking to handle large files and output limits
  const CHUNK_SIZE = 60; // 60 subtitles per batch is safe for output tokens
  const chunks = [];
  
  for (let i = 0; i < subtitles.length; i += CHUNK_SIZE) {
    chunks.push(subtitles.slice(i, i + CHUNK_SIZE));
  }

  const translatedSubtitles: Subtitle[] = [];
  let processedChunks = 0;

  // Process chunks in small batches to respect rate limits but maintain speed
  const CONCURRENCY = 3; 

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      
      const batchPromises = batch.map(async (chunk) => {
          // Simplified payload: just ID and Text to save tokens
          const simplePayload = chunk.map(s => ({ id: s.id, text: s.text }));
          
          const prompt = `
            Task: Translate the 'text' field of these subtitle objects into ${targetLanguage}.
            Requirements:
            1. Keep 'id' exactly as provided.
            2. Maintain the context and tone of the conversation.
            3. Do not translate proper names if inappropriate in target language.
            4. Return ONLY a valid JSON array of objects with 'id' and 'text'.
            
            Input:
            ${JSON.stringify(simplePayload)}
          `;

          try {
              const response = await ai.models.generateContent({
                  model: model,
                  contents: { parts: [{ text: prompt }] },
                  config: {
                      responseMimeType: "application/json",
                      safetySettings: [
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                      ]
                  }
              });

              const text = response.text;
              if (!text) throw new Error("Empty response");
              
              const json = JSON.parse(cleanJsonResponse(text));
              return json;
          } catch (e) {
              console.error("Batch translation error", e);
              // Fallback: Return original text marked as error or try to recover? 
              // For now, return original to avoid crashing entire file
              return chunk.map(s => ({ id: s.id, text: s.text })); 
          }
      });

      const results = await Promise.all(batchPromises);
      
      // Merge results back
      results.forEach((translatedChunk, chunkIndex) => {
          const originalChunk = batch[chunkIndex];
          
          translatedChunk.forEach((tItem: any) => {
              const original = originalChunk.find(o => o.id === tItem.id);
              if (original) {
                  translatedSubtitles.push({
                      ...original,
                      text: tItem.text
                  });
              }
          });
      });

      processedChunks += batch.length;
      if (onProgress) {
          onProgress(Math.round((processedChunks / chunks.length) * 100));
      }
  }

  // Resort to ensure order (though usually preserved)
  return translatedSubtitles.sort((a, b) => a.id - b.id);
};

export const translateAudio = async (audioFile: File, targetLanguage: string): Promise<string> => {
    if (!API_KEY) {
      throw new Error("API Key is missing. Please configure it.");
    }
  
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const model = "gemini-2.5-flash";
  
    try {
      const audioPart = await fileToGenerativePart(audioFile);
  
      const prompt = `
        You are a professional interpreter.
        Listen to the audio content.
        Translate the spoken words directly into ${targetLanguage}.
        Output ONLY the translated text.
        Do not output the original transcript.
        Do not add timestamps.
        Do not add explanations.
      `;
  
      let lastError: any;
      const maxAttempts = 3;
  
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
              console.log(`Translating Audio... Attempt ${attempt + 1}/${maxAttempts}`);
              const response = await ai.models.generateContent({
                model: model,
                contents: {
                  parts: [audioPart, { text: prompt }],
                },
                config: {
                  thinkingConfig: { thinkingBudget: 0 },
                  safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                  ]
                }
              });
  
              const text = (response.text || "").trim();
              
              if (!text) {
                  return "[Translation could not be generated - Audio might be silent]";
              }
  
              return text;
  
          } catch (e: any) {
              console.warn(`Attempt ${attempt + 1} failed:`, e);
              lastError = e;
              
              if (isNetworkOrPayloadError(e)) {
                   throw new Error("Network Error: Upload failed. The file is likely too large for this connection.");
              }
              if (e.status === 400 || (e.message && e.message.includes("400"))) {
                  throw new Error("API Error (400): The file format might be unsupported or corrupted.");
              }
  
              const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
              if (isServerErr && attempt < maxAttempts - 1) {
                  const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : 10000;
                  await new Promise(r => setTimeout(r, delay));
                  continue;
              }
              break; 
          }
      }
      
      let errorMessage = "Unknown API Error";
      if (lastError) {
          if (lastError instanceof Error) {
              errorMessage = lastError.message;
          } else if (typeof lastError === 'string') {
              errorMessage = lastError;
          } else if (lastError.message) {
              errorMessage = lastError.message;
          }
      }
  
      if (errorMessage.includes('500') || (lastError && lastError.status === 500)) {
          throw new Error("Server Error (500): The API timed out. Try a shorter audio clip or a lower quality file (under 25MB).");
      }
      
      throw new Error(errorMessage);
  
    } catch (error: any) {
      console.error("Error translating audio:", error);
      if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
          throw new Error("File is too large for the API. Please use a smaller file.");
      }
      if (error instanceof Error) {
          throw new Error(`${error.message}`);
      }
      throw new Error("Failed to process audio file.");
    }
  };

export const translateVideo = async (videoFile: File, targetLanguage: string): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure it.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash";

  try {
    const videoPart = await fileToGenerativePart(videoFile);

    const prompt = `
      You are a professional interpreter.
      Translate the spoken content of this video directly into ${targetLanguage}.
      Output ONLY the translated text.
      Do not output the original transcript.
      Do not describe visual scenes unless necessary for understanding the speech.
      Do not add timestamps.
    `;

    let lastError: any;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            console.log(`Translating Video... Attempt ${attempt + 1}/${maxAttempts}`);
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [videoPart, { text: prompt }],
              },
              config: {
                thinkingConfig: { thinkingBudget: 0 },
                safetySettings: [
                  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
              }
            });

            const text = (response.text || "").trim();
            if (!text) {
                return "[No speech detected or translation failed]";
            }
            return text;

        } catch (e: any) {
            console.warn(`Attempt ${attempt + 1} failed:`, e);
            lastError = e;
            
            if (isNetworkOrPayloadError(e)) {
                 throw new Error("Network Error: Upload failed. The file is likely too large for this connection.");
            }
            if (e.status === 400 || (e.message && e.message.includes("400"))) {
                throw new Error("API Error (400): The file format might be unsupported or corrupted.");
            }

            const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
            if (isServerErr && attempt < maxAttempts - 1) {
                const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : 10000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break; 
        }
    }
    
    let errorMessage = "Unknown API Error";
    if (lastError) {
        if (lastError instanceof Error) {
            errorMessage = lastError.message;
        } else if (typeof lastError === 'string') {
            errorMessage = lastError;
        } else if (lastError.message) {
            errorMessage = lastError.message;
        }
    }

    if (errorMessage.includes('500') || (lastError && lastError.status === 500)) {
        throw new Error("Server Error (500): The API timed out. Try a shorter video clip or a lower quality file (under 25MB).");
    }
    
    throw new Error(errorMessage);

  } catch (error: any) {
    console.error("Error translating video:", error);
    if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
        throw new Error("File is too large for the API. Please use a smaller file.");
    }
    if (error instanceof Error) {
        throw new Error(`${error.message}`);
    }
    throw new Error("Failed to process video file.");
  }
};

export const transcribeAudio = async (audioFile: File): Promise<{ language: string; text: string }> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure it.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash";

  try {
    const audioPart = await fileToGenerativePart(audioFile);

    const prompt = `
      You are a professional transcriber.
      Transcribe the spoken words or lyrics in this audio file.
      Output ONLY the raw transcript text.
      Do not add timestamps.
      Do not add descriptions like [Music], [Applause], or [Silence].
      If the audio contains a song, transcribe the lyrics.
    `;

    let lastError: any;
    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            console.log(`Transcribing... Attempt ${attempt + 1}/${maxAttempts}`);
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [audioPart, { text: prompt }],
              },
              config: {
                thinkingConfig: { thinkingBudget: 0 },
                safetySettings: [
                  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
              }
            });

            const text = (response.text || "").trim();
            
            if (!text) {
                return { language: "Unknown", text: "[No speech or lyrics detected]" };
            }

            return {
              language: "Detected", 
              text: text
            };

        } catch (e: any) {
            console.warn(`Attempt ${attempt + 1} failed:`, e);
            lastError = e;
            
            if (isNetworkOrPayloadError(e)) {
                 throw new Error("Network Error: Upload failed. The file is likely too large for this connection.");
            }
            if (e.status === 400 || (e.message && e.message.includes("400"))) {
                throw new Error("API Error (400): The file format might be unsupported or corrupted.");
            }

            const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
            if (isServerErr && attempt < maxAttempts - 1) {
                const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : attempt === 2 ? 10000 : 20000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break; 
        }
    }
    
    let errorMessage = "Unknown API Error";
    if (lastError) {
        if (lastError instanceof Error) {
            errorMessage = lastError.message;
        } else if (typeof lastError === 'string') {
            errorMessage = lastError;
        } else if (lastError.message) {
            errorMessage = lastError.message;
        }
    }

    if (errorMessage.includes('500') || (lastError && lastError.status === 500)) {
        throw new Error("Server Error (500): The API timed out. Try a shorter audio clip or a lower quality file (under 25MB).");
    }
    
    throw new Error(errorMessage);

  } catch (error: any) {
    console.error("Error transcribing audio:", error);
    if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
        throw new Error("File is too large for the API. Please use a smaller file.");
    }
    if (error instanceof Error) {
        throw new Error(`${error.message}`);
    }
    throw new Error("Failed to process audio file.");
  }
};

export const transcribeVideo = async (videoFile: File): Promise<{ language: string; text: string }> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure it.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash";

  try {
    const videoPart = await fileToGenerativePart(videoFile);

    const prompt = `
      You are a professional transcriber.
      Transcribe the spoken words in this video file.
      Output ONLY the raw transcript text.
      Do not describe the visual scenes.
      Do not add timestamps.
      Do not add descriptions like [Music], [Applause], or [Silence].
    `;

    let lastError: any;
    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            console.log(`Transcribing Video... Attempt ${attempt + 1}/${maxAttempts}`);
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [videoPart, { text: prompt }],
              },
              config: {
                thinkingConfig: { thinkingBudget: 0 },
                safetySettings: [
                  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
              }
            });

            const text = (response.text || "").trim();
            if (!text) {
                return { language: "Unknown", text: "[No speech detected in video]" };
            }
            return { language: "Detected", text: text };

        } catch (e: any) {
            console.warn(`Attempt ${attempt + 1} failed:`, e);
            lastError = e;
            
            if (isNetworkOrPayloadError(e)) {
                 throw new Error("Network Error: Upload failed. The file is likely too large.");
            }
            if (e.status === 400 || (e.message && e.message.includes("400"))) {
                throw new Error("API Error (400): The file format might be unsupported or corrupted.");
            }
            const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
            if (isServerErr && attempt < maxAttempts - 1) {
                const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : attempt === 2 ? 10000 : 20000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break; 
        }
    }
    
    let errorMessage = "Unknown API Error";
    if (lastError) {
        if (lastError instanceof Error) {
            errorMessage = lastError.message;
        } else if (typeof lastError === 'string') {
            errorMessage = lastError;
        } else if (lastError.message) {
            errorMessage = lastError.message;
        }
    }
    if (errorMessage.includes('500') || (lastError && lastError.status === 500)) {
        throw new Error("Server Error (500): The API timed out. Try a shorter video clip or a lower quality file (under 25MB).");
    }
    throw new Error(errorMessage);

  } catch (error: any) {
    console.error("Error transcribing video:", error);
    if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
        throw new Error("File is too large for the API. Please use a smaller file.");
    }
    if (error instanceof Error) {
        throw new Error(`${error.message}`);
    }
    throw new Error("Failed to process video file.");
  }
};

export const summarizeAudio = async (audioFile: File): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure it.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash";

  try {
    const audioPart = await fileToGenerativePart(audioFile);

    const prompt = `
      You are a professional assistant. 
      Listen to this audio recording and provide a structured summary.
      
      Format your response with the following sections:
      1. Executive Summary (2-3 sentences)
      2. Key Takeaways (Bullet points)
      3. Action Items (if any detected)

      Keep the tone professional and concise.
      Do not add timestamps.
    `;

    let lastError: any;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            console.log(`Summarizing Audio... Attempt ${attempt + 1}/${maxAttempts}`);
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [audioPart, { text: prompt }],
              },
              config: {
                thinkingConfig: { thinkingBudget: 0 },
                safetySettings: [
                  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
              }
            });

            const text = (response.text || "").trim();
            if (!text) {
                return "[Could not generate summary - Audio might be unclear]";
            }
            return text;

        } catch (e: any) {
            console.warn(`Attempt ${attempt + 1} failed:`, e);
            lastError = e;
            
            if (isNetworkOrPayloadError(e)) {
                 throw new Error("Network Error: Upload failed. The file is likely too large for this connection.");
            }
            if (e.status === 400 || (e.message && e.message.includes("400"))) {
                throw new Error("API Error (400): The file format might be unsupported or corrupted.");
            }

            const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
            if (isServerErr && attempt < maxAttempts - 1) {
                const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : 10000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break; 
        }
    }
    
    let errorMessage = "Unknown API Error";
    if (lastError) {
        if (lastError instanceof Error) {
            errorMessage = lastError.message;
        } else if (typeof lastError === 'string') {
            errorMessage = lastError;
        } else if (lastError.message) {
            errorMessage = lastError.message;
        }
    }

    if (errorMessage.includes('500') || (lastError && lastError.status === 500)) {
        throw new Error("Server Error (500): The API timed out. Try a shorter audio clip.");
    }
    
    throw new Error(errorMessage);

  } catch (error: any) {
    console.error("Error summarizing audio:", error);
    if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
        throw new Error("File is too large for the API. Please use a smaller file.");
    }
    if (error instanceof Error) {
        throw new Error(`${error.message}`);
    }
    throw new Error("Failed to process audio file.");
  }
};

export const summarizeVideo = async (videoFile: File): Promise<string> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure it.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash";

  try {
    const videoPart = await fileToGenerativePart(videoFile);

    const prompt = `
      You are an expert video analyst.
      Analyze the video content (visuals, actions, and speech) to provide a comprehensive summary.
      
      Structure your response:
      1. Executive Summary (Overview of the entire video)
      2. Key Topics & Spoken Content (Bullet points of main discussion points)
      3. Visual Highlights (Important visual scenes or actions shown)
      4. Conclusion/Action Items
      
      Do not add timestamps.
    `;

    let lastError: any;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            console.log(`Summarizing Video... Attempt ${attempt + 1}/${maxAttempts}`);
            const response = await ai.models.generateContent({
              model: model,
              contents: {
                parts: [videoPart, { text: prompt }],
              },
              config: {
                thinkingConfig: { thinkingBudget: 0 },
                safetySettings: [
                  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
              }
            });

            const text = (response.text || "").trim();
            if (!text) {
                return "[Could not generate summary - Video content unclear]";
            }
            return text;

        } catch (e: any) {
            console.warn(`Attempt ${attempt + 1} failed:`, e);
            lastError = e;
            
            if (isNetworkOrPayloadError(e)) {
                 throw new Error("Network Error: Upload failed. The file is likely too large for this connection.");
            }
            if (e.status === 400 || (e.message && e.message.includes("400"))) {
                throw new Error("API Error (400): The file format might be unsupported or corrupted.");
            }

            const isServerErr = e.message?.includes('500') || e.status === 500 || e.status === 503;
            if (isServerErr && attempt < maxAttempts - 1) {
                const delay = attempt === 0 ? 2000 : attempt === 1 ? 5000 : 10000;
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            break; 
        }
    }
    
    let errorMessage = "Unknown API Error";
    if (lastError) {
        if (lastError instanceof Error) {
            errorMessage = lastError.message;
        } else if (typeof lastError === 'string') {
            errorMessage = lastError;
        } else if (lastError.message) {
            errorMessage = lastError.message;
        }
    }

    if (errorMessage.includes('500') || (lastError && lastError.status === 500)) {
        throw new Error("Server Error (500): The API timed out. Try a shorter video clip.");
    }
    
    throw new Error(errorMessage);

  } catch (error: any) {
    console.error("Error summarizing video:", error);
    if (error.message && (error.message.includes("413") || error.message.includes("too large"))) {
        throw new Error("File is too large for the API. Please use a smaller file.");
    }
    if (error instanceof Error) {
        throw new Error(`${error.message}`);
    }
    throw new Error("Failed to process video file.");
  }
};