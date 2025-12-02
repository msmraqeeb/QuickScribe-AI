import React, { useState, useEffect } from 'react';
import { FileUploader } from './FileUploader';
import { VideoPlayer } from './VideoPlayer';
import { ControlPanel } from './ControlPanel';
import { Subtitle, SubtitleStyle } from '../types';
import { generateSubtitlesFromVideo } from '../services/geminiService';
import { parseSRT, generateSRT } from '../utils/srtHelpers';
import { burnSubtitles } from '../services/videoProcessor';
import { Download, PlayCircle, Sparkles } from 'lucide-react';

export const HardcodeSubtitlesTool: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [styleConfig, setStyleConfig] = useState<SubtitleStyle>({
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.5,
    position: 'bottom',
    fontFamily: 'Inter, sans-serif',
  });

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleVideoSelect = (file: File) => {
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setSubtitles([]); // Reset subtitles on new video
    setError(null);
  };

  const handleSubtitleSelect = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = parseSRT(text);
      setSubtitles(parsed);
      setError(null);
    } catch (e) {
      setError("Invalid SRT file format.");
    }
  };

  const handleAutoGenerate = async () => {
    if (!videoFile) return;
    setIsGenerating(true);
    setError(null);
    
    try {
      const generatedSubtitles = await generateSubtitlesFromVideo(videoFile);
      if (generatedSubtitles.length === 0) {
        setError("No speech detected or could not generate subtitles.");
      } else {
        setSubtitles(generatedSubtitles);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate subtitles. Please check your API Key or try a smaller video.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSRT = () => {
    const content = generateSRT(subtitles);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVideo = async () => {
      if (!videoFile) return;
      setIsExporting(true);
      setExportProgress(0);
      
      try {
        const processedBlob = await burnSubtitles(
            videoFile, 
            subtitles, 
            styleConfig, 
            (progress) => setExportProgress(progress)
        );

        const url = URL.createObjectURL(processedBlob);
        const a = document.createElement('a');
        a.href = url;
        
        // --- Extension Logic ---
        const blobType = processedBlob.type;
        const originalName = videoFile.name;
        const lastDotIndex = originalName.lastIndexOf('.');
        const namePart = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;

        let finalExt = 'mp4'; // Default to MP4 as requested

        // Only fallback to WebM if the browser explicitly forced WebM AND we can't pretend it's MP4
        if (blobType.includes('webm') || blobType.includes('matroska')) {
            finalExt = 'webm';
        }

        a.download = `subtitled_${namePart}.${finalExt}`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        setError("Failed to process video. Please ensure your browser supports video recording.");
      } finally {
        setIsExporting(false);
        setExportProgress(0);
      }
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        
        {/* Intro Text */}
        <div className="text-center max-w-2xl mx-auto">
           <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4">
             Hardcode Subtitles
           </h1>
           <p className="text-lg text-gray-500">
             Upload your video, auto-generate captions with AI, customize the style, and burn them in.
           </p>
        </div>

        {/* Step 1: Upload Video */}
        <div className="space-y-4">
           <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">Step 1</span>
           <FileUploader
             accept="video/mp4,video/x-m4v,video/*"
             onFileSelect={handleVideoSelect}
             label="Select your video file"
             subLabel="(.mp4, .avi, .mov extension)"
             buttonText={videoFile ? "Change Video" : "Select Video"}
             className={videoFile ? "opacity-100" : ""}
           />
           {videoFile && (
               <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center text-blue-700 text-sm">
                   <PlayCircle className="w-5 h-5 mr-2" />
                   Selected: {videoFile.name} ({(videoFile.size / (1024*1024)).toFixed(2)} MB)
               </div>
           )}
        </div>

        {/* Step 2: Subtitles (Only if video selected) */}
        {videoFile && (
          <div className="space-y-6 pt-8 border-t border-gray-200">
             <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">Step 2</span>
             <h2 className="text-2xl font-bold text-gray-900">Select your subtitle file</h2>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Upload SRT */}
                <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-semibold text-lg mb-2">Upload .SRT File</h3>
                        <p className="text-gray-500 text-sm mb-4">If you already have a subtitle file.</p>
                    </div>
                    <FileUploader
                        accept=".srt,.vtt"
                        onFileSelect={handleSubtitleSelect}
                        label=""
                        buttonText="Upload Subtitles"
                    />
                </div>

                {/* Or Auto-generate */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm flex flex-col justify-between">
                     <div>
                        <div className="flex items-center mb-2">
                             <Sparkles className="w-5 h-5 text-purple-600 mr-2" />
                             <h3 className="font-semibold text-lg text-purple-900">Auto-generate with AI</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-4">Use Gemini 2.5 Flash to automatically transcribe audio.</p>
                     </div>
                     <button
                        onClick={handleAutoGenerate}
                        disabled={isGenerating}
                        className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white ${isGenerating ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} transition-colors shadow-md`}
                     >
                        {isGenerating ? (
                           <>
                             <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                             Generating...
                           </>
                        ) : "Auto-Generate Subtitles"}
                     </button>
                </div>
             </div>

             {error && (
                 <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{error}</span>
                </div>
             )}

             {subtitles.length > 0 && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded flex items-center">
                    <span className="font-bold mr-2">Success!</span>
                    {subtitles.length} subtitle lines loaded.
                </div>
             )}
          </div>
        )}

        {/* Step 3: Customization & Preview */}
        {videoFile && subtitles.length > 0 && (
          <div className="space-y-6 pt-8 border-t border-gray-200">
             <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">Step 3 & 4</span>
             
             {/* Preview Player */}
             <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Preview & Customize</h2>
                <VideoPlayer 
                    videoUrl={videoUrl}
                    subtitles={subtitles}
                    styleConfig={styleConfig}
                />
             </div>

             {/* Controls */}
             <ControlPanel config={styleConfig} onChange={setStyleConfig} />
          </div>
        )}

        {/* Step 5: Export */}
        {videoFile && subtitles.length > 0 && (
            <div className="space-y-6 pt-8 border-t border-gray-200 pb-20">
                 <span className="text-blue-600 font-bold tracking-wider uppercase text-sm">Step 5</span>
                 <h2 className="text-2xl font-bold text-gray-900">Download the video</h2>
                 <p className="text-gray-500">
                    Process the video to permanently burn the subtitles with your selected styles.
                 </p>

                 <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={handleDownloadVideo}
                        disabled={isExporting}
                        className="flex-1 flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {isExporting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5 mr-2" />
                                Download Video
                            </>
                        )}
                    </button>
                    
                    <button 
                        onClick={handleDownloadSRT}
                        disabled={isExporting}
                        className="flex-1 sm:flex-none flex items-center justify-center px-8 py-4 border-2 border-gray-300 text-lg font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <Download className="w-5 h-5 mr-2" />
                        Download .SRT
                    </button>
                 </div>
                 
                 {isExporting && (
                     <div className="space-y-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                                style={{ width: `${Math.min(exportProgress, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-center text-gray-500 animate-pulse font-medium">
                            Rendering video ({Math.round(exportProgress)}%)... <br/>
                            <span className="text-red-500">Please keep this tab active to prevent video freezing.</span>
                        </p>
                     </div>
                 )}
            </div>
        )}

    </div>
  );
};