
import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, RefreshCw, Download, Video, AlertTriangle, CheckCircle, Clock, Zap, Music } from 'lucide-react';
import { audioBufferToWav, audioBufferToMp3 } from '../utils/audioHelpers';

type TargetFormat = 'wav' | 'mp3' | 'webm' | 'ogg' | 'm4a' | 'aac' | 'flac' | 'opus' | 'aiff' | 'wma';

interface FormatOption {
    id: TargetFormat;
    label: string;
    description: string;
    method: 'fast' | 'realtime' | 'unsupported';
    mimeType?: string;
}

export const VideoToAudioTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat>('mp3');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Define formats configuration
  const formats: FormatOption[] = [
      { id: 'mp3', label: 'MP3', description: 'Universal, Compressed', method: 'fast' },
      { id: 'wav', label: 'WAV', description: 'Uncompressed, High Quality', method: 'fast' },
      { id: 'm4a', label: 'M4A (AAC)', description: 'Apple Friendly', method: 'realtime', mimeType: 'audio/mp4' },
      { id: 'aac', label: 'AAC', description: 'Advanced Audio Coding', method: 'realtime', mimeType: 'audio/aac' },
      { id: 'webm', label: 'WebM', description: 'Web Optimized', method: 'realtime', mimeType: 'audio/webm' },
      { id: 'ogg', label: 'OGG', description: 'Open Source', method: 'realtime', mimeType: 'audio/ogg' },
      { id: 'opus', label: 'Opus', description: 'Low Latency, High Quality', method: 'realtime', mimeType: 'audio/webm;codecs=opus' },
      { id: 'flac', label: 'FLAC', description: 'Lossless Compressed', method: 'realtime', mimeType: 'audio/flac' }, 
      { id: 'aiff', label: 'AIFF', description: 'Apple Uncompressed', method: 'unsupported' }, 
      { id: 'wma', label: 'WMA', description: 'Windows Media', method: 'unsupported' }, 
  ];

  // Helper to check format support
  const getFormatStatus = (format: FormatOption) => {
      if (format.method === 'fast') return 'supported';
      if (format.method === 'unsupported') return 'unsupported';
      
      if (format.mimeType && MediaRecorder.isTypeSupported(format.mimeType)) {
          return 'supported';
      }
      
      // Fallback check for common aliases
      if (format.id === 'm4a' || format.id === 'aac') {
          if (MediaRecorder.isTypeSupported('audio/mp4')) return 'supported';
      }
      if (format.id === 'opus') {
          if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'supported';
      }

      return 'unsupported';
  };

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setConvertedBlob(null);
      setError(null);
      setProgress(0);
      setDuration(0);

      // Get duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        setDuration(video.duration);
      }
      video.src = URL.createObjectURL(selectedFile);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        // Reuse handleFile logic
        setFile(droppedFile);
        setConvertedBlob(null);
        setError(null);
        setProgress(0);
        setDuration(0);
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            setDuration(video.duration);
        }
        video.src = URL.createObjectURL(droppedFile);
      } else {
        setError("Please upload a valid video file.");
      }
    }
  };

  // Fast offline conversion (MP3 via LameJS, WAV via Buffer)
  const convertFast = async (file: File, format: 'wav' | 'mp3') => {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;
    
    setProgress(10);
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    setProgress(40);
    
    let blob: Blob;
    if (format === 'mp3') {
        blob = audioBufferToMp3(audioBuffer);
    } else {
        blob = audioBufferToWav(audioBuffer);
    }
    
    setProgress(100);
    return blob;
  };

  // Real-time conversion using MediaRecorder
  const convertRealTime = async (file: File, targetMimeType: string) => {
    return new Promise<Blob>(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = ctx;
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            
            const dest = ctx.createMediaStreamDestination();
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(dest);

            let mimeType = targetMimeType;
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                if (mimeType.includes('aac') && MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
                else if (mimeType.includes('opus') && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) mimeType = 'audio/ogg;codecs=opus';
                else reject(new Error(`Browser does not support encoding to ${targetMimeType}`));
            }

            const recorder = new MediaRecorder(dest.stream, { mimeType });
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                resolve(blob);
            };

            recorder.onerror = (e) => reject(e);

            const duration = audioBuffer.duration;
            const startTime = ctx.currentTime;
            
            const updateProgress = () => {
                if (recorder.state === 'inactive') return;
                const elapsed = ctx.currentTime - startTime;
                const pct = Math.min(99, Math.round((elapsed / duration) * 100));
                setProgress(pct);
                requestAnimationFrame(updateProgress);
            };

            recorder.start();
            source.start();
            updateProgress();

            source.onended = () => {
                recorder.stop();
                setProgress(100);
            };

        } catch (e) {
            reject(e);
        }
    });
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    setError(null);
    setProgress(0);

    try {
        let blob: Blob;
        const formatConfig = formats.find(f => f.id === targetFormat);
        
        if (!formatConfig) throw new Error("Unknown format");

        if (formatConfig.method === 'fast') {
            blob = await convertFast(file, targetFormat as 'mp3' | 'wav');
        } else if (formatConfig.method === 'realtime') {
            if (getFormatStatus(formatConfig) === 'unsupported') {
                throw new Error(`Your browser does not support encoding to ${formatConfig.label} natively.`);
            }
            blob = await convertRealTime(file, formatConfig.mimeType || '');
        } else {
            throw new Error(`The format ${formatConfig.label} is not supported by standard web browsers for client-side encoding.`);
        }
        
        setConvertedBlob(blob);
    } catch (e: any) {
        console.error(e);
        setError(e.message || "Conversion failed.");
    } finally {
        setIsConverting(false);
    }
  };

  const handleDownload = () => {
      if (!convertedBlob || !file) return;
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url;
      
      const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
      a.download = `${originalName}.${targetFormat}`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedFormatConfig = formats.find(f => f.id === targetFormat);
  const isSelectedFormatSupported = selectedFormatConfig ? getFormatStatus(selectedFormatConfig) === 'supported' : false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Video to Audio</h1>
      <p className="text-center text-gray-500 mb-12">Extract audio from video files and convert to any format.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
              {/* Step 1: Upload */}
              <div className="mb-8">
                  <div 
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
                        ${file ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'}
                    `}
                    onClick={() => !isConverting && fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="video/*"
                        className="hidden" 
                        disabled={isConverting}
                      />
                      
                      {file ? (
                          <div className="flex flex-col items-center">
                              <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                                  <Video className="w-8 h-8 text-indigo-600" />
                              </div>
                              <h3 className="font-bold text-gray-900">{file.name}</h3>
                              <p className="text-sm text-gray-500 mb-2">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB 
                                  {duration > 0 && ` • ${formatTime(duration)}`}
                              </p>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setFile(null); setConvertedBlob(null); }}
                                className="text-sm text-red-500 hover:text-red-700 font-medium"
                              >
                                  Change File
                              </button>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center">
                              <UploadCloud className="w-10 h-10 text-gray-400 mb-3" />
                              <h3 className="font-bold text-gray-700 mb-1">Click to Upload Video</h3>
                              <p className="text-sm text-gray-400">MP4, MOV, MKV, AVI, etc.</p>
                          </div>
                      )}
                  </div>
              </div>

              {/* Step 2: Configure & Convert */}
              {file && !convertedBlob && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Choose Output Audio Format</label>
                          <div className="relative">
                              <select
                                value={targetFormat}
                                onChange={(e) => setTargetFormat(e.target.value as TargetFormat)}
                                className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4 text-base bg-white cursor-pointer"
                                disabled={isConverting}
                              >
                                  {formats.map((fmt) => (
                                      <option key={fmt.id} value={fmt.id}>
                                          {fmt.label} {getFormatStatus(fmt) === 'unsupported' ? '(Not Supported in Browser)' : ''}
                                      </option>
                                  ))}
                              </select>
                          </div>

                          {/* Info / Warning Box */}
                          <div className="mt-4">
                              {selectedFormatConfig?.method === 'fast' && (
                                  <div className="text-sm text-green-700 flex items-center bg-green-50 p-3 rounded-lg border border-green-100">
                                      <Zap className="w-4 h-4 mr-2" />
                                      <span><strong>Fast Extraction:</strong> Audio extraction to {selectedFormatConfig.label} happens instantly.</span>
                                  </div>
                              )}
                              {selectedFormatConfig?.method === 'realtime' && isSelectedFormatSupported && (
                                  <div className="text-sm text-orange-700 flex items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
                                      <Clock className="w-4 h-4 mr-2" />
                                      <span><strong>Real-time Extraction:</strong> {selectedFormatConfig.label} conversion takes time equal to duration.</span>
                                  </div>
                              )}
                              {!isSelectedFormatSupported && (
                                  <div className="text-sm text-red-700 flex items-center bg-red-50 p-3 rounded-lg border border-red-100">
                                      <AlertTriangle className="w-4 h-4 mr-2" />
                                      <span><strong>Not Supported:</strong> Your browser cannot natively encode {selectedFormatConfig?.label}. Please choose MP3 or WAV.</span>
                                  </div>
                              )}
                          </div>
                      </div>

                      {isConverting ? (
                          <div className="space-y-3">
                              <div className="flex justify-between text-sm text-gray-600">
                                  <span>Converting to {targetFormat.toUpperCase()}...</span>
                                  <span>{progress}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div 
                                      className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-linear" 
                                      style={{ width: `${progress}%` }}
                                  ></div>
                              </div>
                          </div>
                      ) : (
                          <button 
                            onClick={handleConvert}
                            disabled={!isSelectedFormatSupported}
                            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center transform active:scale-[0.99]
                                ${!isSelectedFormatSupported 
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
                            `}
                          >
                              <RefreshCw className="w-5 h-5 mr-2" />
                              Convert Now
                          </button>
                      )}

                      {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center border border-red-100">
                            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" /> {error}
                        </div>
                      )}
                  </div>
              )}

              {/* Step 3: Download */}
              {convertedBlob && (
                  <div className="text-center space-y-6 animate-in zoom-in duration-300 pt-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-gray-900">Extraction Successful!</h3>
                          <p className="text-gray-500">Your {targetFormat.toUpperCase()} audio file is ready.</p>
                      </div>
                      
                      <button 
                        onClick={handleDownload}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center transform hover:-translate-y-1"
                      >
                          <Download className="w-5 h-5 mr-2" />
                          Download Audio
                      </button>

                      <button 
                        onClick={() => { setConvertedBlob(null); setFile(null); }}
                        className="text-gray-500 hover:text-gray-700 text-sm font-medium hover:underline"
                      >
                          Convert Another File
                      </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
