import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Subtitle, SubtitleStyle } from '../types';
import { parseSRT, generateSRT, generateVTT } from '../utils/srtHelpers';
import { FileUploader } from './FileUploader';
import { VideoPlayer } from './VideoPlayer';
import { Download, Upload, Plus, Trash2, Video, FileText, Search, AlertCircle, Play } from 'lucide-react';

export const SubtitleEditorTool: React.FC = () => {
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Playback state
  const [currentTime, setCurrentTime] = useState(0);

  // Style for preview
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

  const handleSubtitleSelect = async (file: File) => {
    setSubtitleFile(file);
    setError(null);
    try {
      const text = await file.text();
      // Basic VTT cleanup
      const cleanText = text.replace(/^WEBVTT\s+/, '').trim();
      const parsed = parseSRT(cleanText);
      if (parsed.length === 0) throw new Error("No subtitles found.");
      setSubtitles(parsed);
    } catch (e: any) {
      setError(e.message || "Failed to parse subtitle file.");
      setSubtitles([]);
    }
  };

  const handleVideoSelect = (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
        // Just a warning for large files in local preview, though browser can handle local playback fine usually
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  // --- CRUD Operations ---

  const handleUpdate = (id: number, field: keyof Subtitle, value: any) => {
    setSubtitles(prev => prev.map(sub => 
      sub.id === id ? { ...sub, [field]: value } : sub
    ));
  };

  const handleDelete = (id: number) => {
    setSubtitles(prev => prev.filter(sub => sub.id !== id));
  };

  const handleAdd = () => {
    const newId = subtitles.length > 0 ? Math.max(...subtitles.map(s => s.id)) + 1 : 1;
    // Insert after the current last one, or at 0 if empty
    const lastSub = subtitles[subtitles.length - 1];
    const startTime = lastSub ? lastSub.endTime + 0.1 : 0;
    const endTime = startTime + 2;
    
    setSubtitles(prev => [
      ...prev,
      { id: newId, startTime, endTime, text: "New Subtitle" }
    ]);
  };

  const handleDownload = (format: 'srt' | 'vtt') => {
    const content = format === 'srt' ? generateSRT(subtitles) : generateVTT(subtitles);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited_subtitles.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Helpers for UI Time format (HH:MM:SS,mmm) ---
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
        const parts = normalized.split(',');
        const timeParts = parts[0].split(':').map(Number);
        const ms = parts[1] ? Number(parts[1]) : 0;
        
        let h = 0, m = 0, s = 0;
        if (timeParts.length === 3) [h, m, s] = timeParts;
        else if (timeParts.length === 2) [m, s] = timeParts;
        else if (timeParts.length === 1) [s] = timeParts;
        
        const result = (h * 3600) + (m * 60) + s + (ms / 1000);
        return isNaN(result) ? 0 : result;
    } catch (e) {
        return 0;
    }
  };

  // --- Filtering ---
  const filteredSubtitles = subtitles.filter(s => 
    s.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // If no subtitles loaded yet
  if (!subtitleFile) {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Subtitle Editor</h1>
            <p className="text-center text-gray-500 mb-12">Edit, sync, and fix your subtitle files.</p>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
                 <div className="max-w-md mx-auto">
                    <FileUploader
                        accept=".srt,.vtt"
                        onFileSelect={handleSubtitleSelect}
                        label="Upload Subtitle File"
                        subLabel=".srt or .vtt"
                        buttonText="Start Editing"
                    />
                 </div>
                 {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm inline-flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2" /> {error}
                    </div>
                 )}
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-6 h-[calc(100vh-80px)] flex flex-col">
       {/* Toolbar */}
       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <h1 className="text-xl font-bold text-gray-900 flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-blue-600" />
                  Editor
              </h1>
              <div className="h-6 w-px bg-gray-200 mx-2"></div>
              <span className="text-sm text-gray-500 truncate max-w-[150px]">{subtitleFile.name}</span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
               {!videoFile && (
                   <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 cursor-pointer text-sm font-medium transition-colors whitespace-nowrap">
                       <Video className="w-4 h-4" />
                       Add Video Preview
                       <input type="file" accept="video/*" onChange={(e) => e.target.files && handleVideoSelect(e.target.files[0])} className="hidden" />
                   </label>
               )}
               
               <button 
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-sm font-medium transition-colors whitespace-nowrap"
               >
                   <Plus className="w-4 h-4" /> Add Line
               </button>

               <div className="h-6 w-px bg-gray-200 mx-2"></div>

               <button 
                  onClick={() => handleDownload('srt')}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap shadow-sm"
               >
                   <Download className="w-4 h-4" /> Export SRT
               </button>
               <button 
                  onClick={() => handleDownload('vtt')}
                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
               >
                   <Download className="w-4 h-4" /> Export VTT
               </button>
          </div>
       </div>

       {/* Workspace */}
       <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
           
           {/* Left: Video Player (Visible only if video uploaded) */}
           {videoUrl && (
               <div className="lg:w-1/2 flex flex-col h-full bg-black rounded-xl overflow-hidden shadow-lg relative">
                    <VideoPlayer
                        videoUrl={videoUrl}
                        subtitles={subtitles}
                        styleConfig={previewStyle}
                        fitContainer={true}
                        onTimeUpdate={setCurrentTime}
                    />
               </div>
           )}

           {/* Right: Subtitle List */}
           <div className={`${videoUrl ? 'lg:w-1/2' : 'w-full'} flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full`}>
               {/* Search Bar */}
               <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center">
                   <Search className="w-4 h-4 text-gray-400 mr-2" />
                   <input 
                      type="text" 
                      placeholder="Search subtitles..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-sm w-full text-gray-700 placeholder-gray-400"
                   />
                   <span className="text-xs text-gray-400 font-medium">
                       {filteredSubtitles.length} lines
                   </span>
               </div>

               {/* List */}
               <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin">
                   {filteredSubtitles.map((sub) => {
                       const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;
                       return (
                           <div 
                               key={sub.id} 
                               className={`group relative p-4 rounded-lg border transition-all duration-200 ${isActive ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
                           >
                               <div className="flex items-center gap-3 mb-3">
                                   <span className="text-xs font-bold text-gray-400 w-8">#{sub.id}</span>
                                   
                                   <div className="flex items-center gap-2 text-sm font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                       <input 
                                           className="w-24 bg-transparent text-center focus:text-blue-600 focus:outline-none"
                                           value={formatTimeUI(sub.startTime)}
                                           onChange={(e) => handleUpdate(sub.id, 'startTime', parseTimeUI(e.target.value))}
                                       />
                                       <span className="text-gray-400">→</span>
                                       <input 
                                           className="w-24 bg-transparent text-center focus:text-blue-600 focus:outline-none"
                                           value={formatTimeUI(sub.endTime)}
                                           onChange={(e) => handleUpdate(sub.id, 'endTime', parseTimeUI(e.target.value))}
                                       />
                                   </div>

                                   {videoUrl && (
                                       <button 
                                          onClick={() => {
                                              const video = document.querySelector('video');
                                              if (video) video.currentTime = sub.startTime;
                                          }}
                                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-full transition-colors ml-auto md:ml-0"
                                          title="Seek to this subtitle"
                                       >
                                           <Play className="w-3 h-3 fill-current" />
                                       </button>
                                   )}

                                   <button 
                                      onClick={() => handleDelete(sub.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100"
                                      title="Delete line"
                                   >
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               </div>

                               <textarea 
                                   value={sub.text}
                                   onChange={(e) => handleUpdate(sub.id, 'text', e.target.value)}
                                   className="w-full bg-transparent resize-none outline-none text-gray-800 text-base leading-relaxed p-0 border-none focus:ring-0"
                                   rows={Math.max(1, sub.text.split('\n').length)}
                                   style={{ minHeight: '1.5rem' }}
                                   placeholder="Subtitle text..."
                               />
                           </div>
                       );
                   })}

                   {filteredSubtitles.length === 0 && (
                       <div className="text-center py-12 text-gray-400">
                           <p>No subtitles found matching "{searchTerm}"</p>
                       </div>
                   )}
                   
                   {/* Bottom Add Button */}
                   <button 
                      onClick={handleAdd}
                      className="w-full py-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 font-medium hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                   >
                       <Plus className="w-5 h-5" /> Add New Line
                   </button>
               </div>
           </div>
       </div>
    </div>
  );
};
