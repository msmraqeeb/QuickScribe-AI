
import React, { useState, useRef } from 'react';
import { UploadCloud, Music, Download, Trash2, ArrowUp, ArrowDown, Play, Pause, Plus, RefreshCw, Layers } from 'lucide-react';
import { audioBufferToWav } from '../utils/audioHelpers';

interface AudioTrack {
  id: string;
  file: File;
  duration: number;
  buffer: AudioBuffer | null;
}

export const AudioJoinerTool: React.FC = () => {
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Preview
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      setError(null);
      
      const newTracks: AudioTrack[] = [];
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      try {
        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          
          try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            newTracks.push({
              id: Math.random().toString(36).substr(2, 9),
              file,
              duration: audioBuffer.duration,
              buffer: audioBuffer
            });
          } catch (err) {
            console.error(`Failed to decode ${file.name}`, err);
            // Skip invalid files but continue others
          }
        }
        
        setTracks(prev => [...prev, ...newTracks]);
      } catch (err) {
        setError("Error processing audio files. Please check file formats.");
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === tracks.length - 1)
    ) return;

    const newTracks = [...tracks];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newTracks[index], newTracks[swapIndex]] = [newTracks[swapIndex], newTracks[index]];
    setTracks(newTracks);
    setMergedBlob(null); // Reset result on change
  };

  const removeTrack = (id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
    setMergedBlob(null);
  };

  const handleMerge = async () => {
    if (tracks.length < 2) {
      setError("Please add at least 2 audio files to join.");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      // Calculate total duration
      const totalDuration = tracks.reduce((acc, track) => acc + track.duration, 0);
      
      // Standardize sample rate (usually 44100 or 48000)
      const sampleRate = 44100;
      const numberOfChannels = 2; // Force stereo

      // Use OfflineAudioContext to render
      const offlineCtx = new OfflineAudioContext(numberOfChannels, sampleRate * totalDuration, sampleRate);
      
      let currentTime = 0;

      tracks.forEach((track, index) => {
        if (!track.buffer) return;

        const source = offlineCtx.createBufferSource();
        source.buffer = track.buffer;
        source.connect(offlineCtx.destination);
        source.start(currentTime);
        
        currentTime += track.duration;
        
        // Simulate progress
        setProgress(Math.round(((index + 1) / tracks.length) * 50));
      });

      // Start rendering
      const renderedBuffer = await offlineCtx.startRendering();
      setProgress(80);

      // Convert to WAV
      const wavBlob = audioBufferToWav(renderedBuffer);
      setMergedBlob(wavBlob);
      setProgress(100);

    } catch (err: any) {
      console.error(err);
      setError("Failed to merge audio files. Browser memory might be full.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    if (!mergedBlob) return;
    const url = URL.createObjectURL(mergedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged_audio_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const togglePreview = () => {
      if (!audioRef.current && mergedBlob) {
          audioRef.current = new Audio(URL.createObjectURL(mergedBlob));
          audioRef.current.onended = () => setIsPlaying(false);
      }

      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.play();
          }
          setIsPlaying(!isPlaying);
      }
  };

  // Reset preview when blob changes
  React.useEffect(() => {
      if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
      }
      setIsPlaying(false);
  }, [mergedBlob]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Audio Joiner</h1>
      <p className="text-center text-gray-500 mb-12">Merge multiple audio files into a single continuous track.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Track List */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-900 flex items-center">
                        <Layers className="w-5 h-5 mr-2 text-orange-600" />
                        Tracks ({tracks.length})
                    </h2>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add Files
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        multiple 
                        accept="audio/*" 
                        className="hidden" 
                        onChange={handleFileSelect}
                    />
                </div>

                <div className="divide-y divide-gray-100 min-h-[300px] max-h-[500px] overflow-y-auto">
                    {tracks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-8 text-center">
                            <Music className="w-12 h-12 mb-4 opacity-20" />
                            <p>No tracks added.</p>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-4 px-6 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-400 hover:text-orange-600 transition-colors"
                            >
                                Upload Audio Files
                            </button>
                        </div>
                    ) : (
                        tracks.map((track, index) => (
                            <div key={track.id} className="p-4 hover:bg-gray-50 flex items-center gap-4 group transition-colors">
                                <div className="text-gray-400 font-mono w-6 text-sm">{index + 1}</div>
                                
                                <div className="flex-grow min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{track.file.name}</div>
                                    <div className="text-xs text-gray-500">{formatTime(track.duration)} • {(track.file.size / 1024 / 1024).toFixed(2)} MB</div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => moveTrack(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-30"
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => moveTrack(index, 'down')}
                                        disabled={index === tracks.length - 1}
                                        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-30"
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                    </button>
                                </div>

                                <button 
                                    onClick={() => removeTrack(track.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                
                {tracks.length > 0 && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600 font-medium">
                        <span>Total Duration:</span>
                        <span>{formatTime(tracks.reduce((acc, t) => acc + t.duration, 0))}</span>
                    </div>
                )}
            </div>
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
                <h3 className="font-bold text-gray-900 mb-4">Merge Audio</h3>
                <p className="text-sm text-gray-500 mb-6">
                    Join {tracks.length} tracks into a single WAV file.
                </p>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {!mergedBlob ? (
                    <button
                        onClick={handleMerge}
                        disabled={tracks.length < 2 || isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all flex items-center justify-center
                            ${tracks.length < 2 || isProcessing
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'bg-orange-600 hover:bg-orange-700 hover:shadow-orange-200'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                                {progress < 90 ? 'Merging...' : 'Encoding...'}
                            </>
                        ) : (
                            <>
                                <UploadCloud className="w-5 h-5 mr-2" />
                                Join Audio
                            </>
                        )}
                    </button>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-center">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Music className="w-6 h-6 text-green-600" />
                            </div>
                            <h4 className="font-bold text-green-800">Ready!</h4>
                            <p className="text-xs text-green-600 mb-3">Merged successfully</p>
                            
                            <button 
                                onClick={togglePreview}
                                className="w-full py-2 bg-white border border-green-200 text-green-700 rounded-md text-sm font-medium hover:bg-green-100 flex items-center justify-center mb-2"
                            >
                                {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                {isPlaying ? 'Pause Preview' : 'Play Preview'}
                            </button>
                        </div>

                        <button 
                            onClick={handleDownload}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center"
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Download Audio
                        </button>

                        <button 
                            onClick={() => setMergedBlob(null)}
                            className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm underline"
                        >
                            Merge Again
                        </button>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};
