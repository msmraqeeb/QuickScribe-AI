import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Scissors, Download, Play, Pause, RefreshCw, Film, AlertTriangle } from 'lucide-react';
import { trimVideo } from '../services/videoProcessor';

export const VideoTrimmerTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Trim Range
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
      
      // Reset state
      setTrimmedBlob(null);
      setStartTime(0);
      setEndTime(0);
      setProgress(0);
      setError(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      setEndTime(dur);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSetStart = () => {
    if (videoRef.current) {
        const time = videoRef.current.currentTime;
        if (time >= endTime) {
            setEndTime(duration);
        }
        setStartTime(time);
    }
  };

  const handleSetEnd = () => {
    if (videoRef.current) {
        const time = videoRef.current.currentTime;
        if (time <= startTime) {
            setStartTime(0);
        }
        setEndTime(time);
    }
  };

  const handleTrim = async () => {
    if (!file || !videoUrl) return;
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
        const blob = await trimVideo(file, startTime, endTime, (pct) => setProgress(pct));
        setTrimmedBlob(blob);
    } catch (e: any) {
        console.error(e);
        setError("Failed to trim video. Please try a different file.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!trimmedBlob || !file) return;
    const url = URL.createObjectURL(trimmedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    // Attempt to determine extension
    const ext = trimmedBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
    
    a.download = `${originalName}_trimmed.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Video Trimmer</h1>
      <p className="text-center text-gray-500 mb-12">Cut specific parts of your video files precisely.</p>

      {!file ? (
         <div 
            className="bg-red-50/50 border-2 border-dashed border-red-200 rounded-3xl p-12 text-center transition-all min-h-[320px] flex flex-col justify-center items-center hover:border-red-400 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
         >
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="video/*"
                className="hidden" 
            />
            <div className="bg-white p-4 rounded-full shadow-sm mb-6">
                <Scissors className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Click to upload video</h3>
            <p className="text-gray-500 mb-8">MP4, MOV, AVI (Max 100MB)</p>
            <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors">
                Select Video File
            </button>
         </div>
      ) : (
         <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             {/* Header */}
             <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-white rounded-lg border border-gray-200">
                         <Film className="w-5 h-5 text-gray-600" />
                     </div>
                     <div>
                         <h3 className="font-bold text-gray-900 max-w-[200px] truncate">{file.name}</h3>
                         <p className="text-xs text-gray-500">Duration: {formatTime(duration)}</p>
                     </div>
                 </div>
                 <button 
                    onClick={() => {
                        setFile(null);
                        setVideoUrl(null);
                    }}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                 >
                     Change File
                 </button>
             </div>

             <div className="p-6">
                 {/* Video Preview */}
                 <div className="bg-black rounded-xl overflow-hidden aspect-video shadow-lg mb-6 flex justify-center relative">
                     <video 
                        ref={videoRef}
                        src={videoUrl || ''}
                        className="max-w-full max-h-full"
                        controls
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                     />
                 </div>

                 {/* Controls */}
                 <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                     
                     <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 w-full md:w-auto justify-center">
                         {/* Start Control */}
                         <div className="text-center">
                             <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 text-blue-600">Start</label>
                             <div className="flex flex-col gap-1">
                                 <input 
                                    type="number"
                                    step="0.1"
                                    value={startTime.toFixed(1)}
                                    onChange={(e) => setStartTime(Math.max(0, Number(e.target.value)))}
                                    className="w-20 text-center border border-gray-300 rounded-md p-1 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                 />
                                 <button 
                                    onClick={handleSetStart}
                                    className="text-xs text-blue-600 hover:underline"
                                 >
                                     Set Current
                                 </button>
                             </div>
                         </div>

                         <span className="text-gray-300">→</span>

                         {/* End Control */}
                         <div className="text-center">
                             <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-1 text-blue-600">End</label>
                             <div className="flex flex-col gap-1">
                                 <input 
                                    type="number"
                                    step="0.1"
                                    value={endTime.toFixed(1)}
                                    onChange={(e) => setEndTime(Math.min(duration, Number(e.target.value)))}
                                    className="w-20 text-center border border-gray-300 rounded-md p-1 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                 />
                                 <button 
                                    onClick={handleSetEnd}
                                    className="text-xs text-blue-600 hover:underline"
                                 >
                                     Set Current
                                 </button>
                             </div>
                         </div>

                         <div className="text-center pl-4 border-l border-gray-200 hidden sm:block">
                             <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">New Duration</label>
                             <span className="font-mono text-sm font-bold text-gray-700">
                                 {formatTime(Math.max(0, endTime - startTime))}
                             </span>
                         </div>
                     </div>

                     <div>
                         {trimmedBlob ? (
                             <button
                                onClick={handleDownload}
                                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center animate-in zoom-in"
                             >
                                 <Download className="w-5 h-5 mr-2" /> Download Video
                             </button>
                         ) : (
                             <button
                                onClick={handleTrim}
                                disabled={isProcessing || startTime >= endTime}
                                className={`px-8 py-3 rounded-lg font-bold shadow-md transition-colors flex items-center
                                    ${isProcessing || startTime >= endTime 
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                        : 'bg-red-600 hover:bg-red-700 text-white'}`
                                }
                             >
                                 {isProcessing ? (
                                     <>
                                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                                        Processing {Math.round(progress)}%...
                                     </>
                                 ) : (
                                     <>
                                        <Scissors className="w-5 h-5 mr-2" />
                                        Trim Video
                                     </>
                                 )}
                             </button>
                         )}
                     </div>
                 </div>
                 
                 {isProcessing && (
                     <p className="mt-4 text-center text-sm text-gray-500 animate-pulse">
                         Recording selected segment... Please keep tab active.
                     </p>
                 )}

                 {error && (
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center animate-in fade-in">
                        <AlertTriangle className="w-5 h-5 mr-2" /> {error}
                    </div>
                 )}
             </div>
         </div>
      )}
    </div>
  );
};
