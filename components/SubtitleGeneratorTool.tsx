import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FileUploader } from './FileUploader';
import { VideoPlayer } from './VideoPlayer';
import { WaveformTimeline } from './WaveformTimeline';
import { Subtitle, SubtitleStyle } from '../types';
import { generateSubtitlesFromVideo, calculateAutoSyncOffset } from '../services/geminiService';
import { generateSRT, generateVTT } from '../utils/srtHelpers';
import { Download, Sparkles, AlertCircle, PenLine, Copy, RefreshCw, ChevronLeft, Clock, ArrowRightLeft, Check, Wand2 } from 'lucide-react';

type Step = 'upload' | 'configure' | 'processing' | 'editor';

// Memoized Subtitle Item to prevent heavy re-renders on playback
const SubtitleEditorItem = React.memo(({ 
    sub, 
    isActive, 
    onUpdate, 
    onActivate 
}: { 
    sub: Subtitle, 
    isActive: boolean, 
    onUpdate: (id: number, field: keyof Subtitle, value: any) => void,
    onActivate: (id: number) => void
}) => {
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isActive && rowRef.current) {
            rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isActive]);

    const formatTimeUI = (seconds: number): string => {
        const pad = (num: number, size: number) => ('000' + num).slice(size * -1);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.round((seconds % 1) * 1000);
        return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
    };

    const parseTimeUI = (str: string): number => {
        try {
            const normalized = str.replace('.', ',');
            const [time, ms] = normalized.split(',');
            const [h, m, s] = time.split(':').map(Number);
            return (h * 3600) + (m * 60) + s + (Number(ms) / 1000);
        } catch (e) {
            return 0;
        }
    };

    return (
        <div 
            ref={rowRef}
            className={`group p-3 rounded-lg transition-colors border border-transparent ${isActive ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-gray-50'}`}
            onClick={() => onActivate(sub.id)}
        >
            <div className="text-gray-400 font-medium text-xs mb-1">#{sub.id}</div>
            
            <div className="flex items-center gap-2 text-sm font-mono text-gray-500 mb-2">
                <input 
                    type="text" 
                    value={formatTimeUI(sub.startTime)}
                    className="bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none w-28 transition-colors"
                    onChange={(e) => onUpdate(sub.id, 'startTime', parseTimeUI(e.target.value))}
                />
                <span className="text-gray-300">→</span>
                <input 
                    type="text" 
                    value={formatTimeUI(sub.endTime)}
                    className="bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 focus:outline-none w-28 transition-colors"
                    onChange={(e) => onUpdate(sub.id, 'endTime', parseTimeUI(e.target.value))}
                />
            </div>
            
            <textarea 
                value={sub.text}
                onChange={(e) => onUpdate(sub.id, 'text', e.target.value)}
                className="w-full bg-transparent resize-none outline-none text-gray-800 text-base leading-relaxed overflow-hidden border-l-2 border-transparent focus:border-blue-500 pl-2 transition-all"
                rows={Math.max(1, sub.text.split('\n').length)}
                style={{ minHeight: '1.5rem' }}
            />
        </div>
    );
});
SubtitleEditorItem.displayName = 'SubtitleEditorItem';


export const SubtitleGeneratorTool: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeSubtitleId, setActiveSubtitleId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  // Playback state lifted from VideoPlayer
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showSyncTools, setShowSyncTools] = useState(false);
  const [syncOffset, setSyncOffset] = useState<number>(0);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncMsg, setAutoSyncMsg] = useState<string | null>(null);

  // Memoize style to prevent re-renders in VideoPlayer
  const previewStyle: SubtitleStyle = useMemo(() => ({
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    position: 'bottom',
    fontFamily: 'Inter, sans-serif',
  }), []);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Sync Active ID with Playback
  useEffect(() => {
      const active = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);
      if (active && active.id !== activeSubtitleId) {
          setActiveSubtitleId(active.id);
      }
  }, [currentTime, subtitles]);

  // Clear toast message after 3 seconds
  useEffect(() => {
      if (autoSyncMsg) {
          const timer = setTimeout(() => setAutoSyncMsg(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [autoSyncMsg]);

  const handleVideoSelect = (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
        setError("File too large. Please use a video under 25MB for this AI tool.");
        return;
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setError(null);
    setStep('configure');
  };

  const handleGenerate = async () => {
    if (!videoFile) return;
    setStep('processing');
    setError(null);
    setProgress(0);

    const interval = setInterval(() => {
        setProgress(p => (p < 90 ? p + 5 : p));
    }, 500);

    try {
      const generated = await generateSubtitlesFromVideo(videoFile);
      clearInterval(interval);
      setProgress(100);

      if (generated.length === 0) {
        setError("No speech detected.");
        setStep('configure');
      } else {
        setSubtitles(generated);
        setStep('editor');
      }
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setError(err.message || "Failed to generate subtitles.");
      setStep('configure');
    }
  };

  const handleAutoSync = async () => {
    if (!videoFile || subtitles.length === 0) return;
    
    setIsAutoSyncing(true);
    setAutoSyncMsg(null);
    try {
        const offset = await calculateAutoSyncOffset(videoFile, subtitles);
        
        if (Math.abs(offset) < 0.05) {
            setAutoSyncMsg("Synced (Difference < 0.05s)");
        } else {
            setSubtitles(prev => prev.map(sub => ({
                ...sub,
                startTime: Math.max(0, sub.startTime + offset),
                endTime: Math.max(0, sub.endTime + offset)
            })));
            const sign = offset > 0 ? '+' : '';
            setAutoSyncMsg(`Shifted ${sign}${offset.toFixed(2)}s to match audio start`);
        }
    } catch (e) {
        console.error(e);
        setAutoSyncMsg("Auto sync failed.");
    } finally {
        setIsAutoSyncing(false);
    }
  };

  const handleSubtitleUpdate = useCallback((id: number, field: keyof Subtitle, value: any) => {
    setSubtitles(prev => prev.map(sub => 
        sub.id === id ? { ...sub, [field]: value } : sub
    ));
  }, []);

  const handleActivateSubtitle = useCallback((id: number) => {
      setActiveSubtitleId(id);
  }, []); 

  const handleApplySync = () => {
    if (syncOffset === 0) return;
    
    setSubtitles(prev => prev.map(sub => ({
        ...sub,
        startTime: Math.max(0, sub.startTime + syncOffset),
        endTime: Math.max(0, sub.endTime + syncOffset)
    })));
    
    setSyncOffset(0);
    setShowSyncTools(false);
  };

  const handleDownload = (format: 'srt' | 'vtt') => {
    const content = format === 'srt' ? generateSRT(subtitles) : generateVTT(subtitles);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = () => {
      const text = generateSRT(subtitles);
      navigator.clipboard.writeText(text);
  }

  const handleSeek = (time: number) => {
      if (videoRef.current) {
          videoRef.current.currentTime = time;
      }
  };

  if (step === 'upload') {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Subtitle Generator</h1>
            <p className="text-center text-gray-500 mb-8">Automatically generate synchronized subtitles for your videos.</p>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                <FileUploader
                    accept="video/*"
                    onFileSelect={handleVideoSelect}
                    label="Upload Video"
                    subLabel="MP4, MOV, WEBM (Max 25MB)"
                    buttonText="Select Video"
                />
                 {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                 )}
            </div>
        </div>
    );
  }

  if (step === 'configure') {
      return (
          <div className="max-w-2xl mx-auto px-4 py-12">
              <button 
                onClick={() => setStep('upload')}
                className="mb-6 flex items-center text-gray-500 hover:text-blue-600 transition-colors"
              >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </button>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
                  <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Generate Subtitles</h1>
                  <p className="text-gray-500 mb-8">Ready to process your video?</p>

                  <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                     <p className="text-sm text-blue-800 font-medium">
                        Language will be auto-detected from the video's original audio.
                     </p>
                  </div>

                  {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm text-left">
                        <span className="font-bold">Error:</span> {error}
                    </div>
                  )}

                  <button
                    onClick={handleGenerate}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center"
                  >
                      <Sparkles className="w-5 h-5 mr-2" />
                      Start Processing
                  </button>
              </div>
          </div>
      )
  }

  if (step === 'processing') {
      return (
          <div className="max-w-xl mx-auto px-4 py-20 text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                 <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                 <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating Subtitles...</h2>
              <p className="text-gray-500 mb-6">Analyzing Audio Waveform & Syncing...</p>
              
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                ></div>
              </div>
          </div>
      )
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 mb-6 flex-shrink-0">
          <div className="flex justify-between items-center p-4">
            <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Generated Subtitles</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <PenLine className="w-3 h-3 mr-1" />
                    Editable
                </span>
                {autoSyncMsg && (
                    <span className="ml-2 text-sm font-medium text-green-600 animate-in fade-in slide-in-from-bottom-1">
                        {autoSyncMsg}
                    </span>
                )}
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={handleAutoSync}
                    disabled={isAutoSyncing}
                    className="p-2 rounded-lg transition-colors border border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-600 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                    title="Automatically align the first subtitle with the start of speech in the audio track."
                >
                    {isAutoSyncing ? (
                         <div className="animate-spin w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full" />
                    ) : (
                         <Wand2 className="w-5 h-5" />
                    )}
                    <span className="hidden sm:inline">Auto Sync</span>
                </button>

                <button 
                    onClick={() => setShowSyncTools(!showSyncTools)}
                    className={`p-2 rounded-lg transition-colors border border-gray-200 flex items-center gap-2 text-sm font-medium ${showSyncTools ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-gray-600 hover:bg-gray-50'}`}
                    title="Manual Timing Adjustment"
                >
                    <Clock className="w-5 h-5" />
                    <span className="hidden sm:inline">Sync Timing</span>
                </button>

                <div className="w-px h-8 bg-gray-200 mx-2"></div>

                <button 
                    onClick={handleCopyAll}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                    title="Copy SRT"
                >
                    <Copy className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => handleDownload('srt')}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                    title="Download SRT"
                >
                    <Download className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => { setStep('upload'); setSubtitles([]); }}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                    title="Start Over"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>
          </div>

          {showSyncTools && (
             <div className="border-t border-gray-100 p-4 bg-gray-50 flex items-center gap-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Shift all subtitles by:</span>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setSyncOffset(prev => Number((prev - 0.5).toFixed(1)))}
                        className="w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center font-bold text-gray-600"
                    >
                        -
                    </button>
                    <div className="relative">
                        <input 
                            type="number" 
                            step="0.1"
                            value={syncOffset}
                            onChange={(e) => setSyncOffset(Number(e.target.value))}
                            className="w-20 p-1 pl-2 pr-8 border border-gray-300 rounded text-center font-mono"
                        />
                        <span className="absolute right-2 top-1.5 text-xs text-gray-400">sec</span>
                    </div>
                    <button 
                        onClick={() => setSyncOffset(prev => Number((prev + 0.5).toFixed(1)))}
                        className="w-8 h-8 rounded border border-gray-300 bg-white hover:bg-gray-50 flex items-center justify-center font-bold text-gray-600"
                    >
                        +
                    </button>
                </div>

                <div className="text-xs text-gray-400 italic">
                    (Negative = earlier, Positive = later)
                </div>

                <button 
                    onClick={handleApplySync}
                    className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                >
                    <Check className="w-4 h-4" /> Apply Shift
                </button>
             </div>
          )}
      </div>

      <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
          
          <div className="lg:w-1/2 flex flex-col gap-4 h-full">
               <div className="bg-black rounded-xl overflow-hidden shadow-lg flex items-center justify-center flex-grow relative">
                   {/* Subtitle Overlay in Parent Container for robustness if needed, 
                       but kept in VideoPlayer for now with z-index fix */}
                   <VideoPlayer 
                    ref={videoRef}
                    videoUrl={videoUrl} 
                    subtitles={subtitles}
                    styleConfig={previewStyle}
                    fitContainer={true}
                    onTimeUpdate={setCurrentTime}
                    onDurationChange={setDuration}
                   />
               </div>
               
               <WaveformTimeline 
                  file={videoFile}
                  subtitles={subtitles}
                  currentTime={currentTime}
                  duration={duration}
                  onSeek={handleSeek}
               />
          </div>

          <div className="lg:w-1/2 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
              <div className="flex-grow overflow-y-auto p-6 space-y-4 scrollbar-thin">
                  {subtitles.length > 0 ? (
                      subtitles.map((sub) => (
                        <SubtitleEditorItem 
                            key={sub.id} 
                            sub={sub} 
                            isActive={activeSubtitleId === sub.id} 
                            onUpdate={handleSubtitleUpdate}
                            onActivate={handleActivateSubtitle}
                        />
                      ))
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                          <p>No subtitles to display.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};