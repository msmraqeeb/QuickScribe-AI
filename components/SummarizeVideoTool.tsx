import React, { useState, useRef } from 'react';
import { UploadCloud, Video, Download, Copy, RefreshCw, PenLine, AlertTriangle, Film } from 'lucide-react';
import { summarizeVideo } from '../services/geminiService';

export const SummarizeVideoTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultText, setResultText] = useState('');
  const [editableText, setEditableText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (selectedFile: File) => {
    // 25MB recommended limit for inline uploads
    const LIMIT_MB = 25;
    if (selectedFile.size > LIMIT_MB * 1024 * 1024) {
      setError(`File is too large (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). Please use a file under ${LIMIT_MB}MB to prevent API timeouts.`);
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        validateAndSetFile(droppedFile);
      } else {
        setError("Please upload a valid video file.");
      }
    }
  };

  const handleSummarize = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    // Simulate progress
    const progressInterval = file.size > 10 * 1024 * 1024 ? 2000 : 1000;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + 2;
      });
    }, progressInterval);

    try {
      const text = await summarizeVideo(file);
      setResultText(text);
      setEditableText(text);
      setProgress(100);
    } catch (err: any) {
      console.error("Summarize Video UI Error:", err);
      let msg = "Failed to summarize video. Please try again.";
      if (err instanceof Error) msg = err.message;
      setError(msg);
    } finally {
      clearInterval(interval);
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableText);
  };

  const handleDownload = () => {
    const blob = new Blob([editableText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video_summary_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setResultText('');
    setEditableText('');
    setProgress(0);
    setError(null);
  };

  // --- Result View ---

  if (resultText) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Video Summary</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
              <Film className="w-3 h-3 mr-1" />
              AI Generated
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-gray-200" title="Copy text"><Copy className="w-5 h-5" /></button>
            <button onClick={handleDownload} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-gray-200" title="Download text"><Download className="w-5 h-5" /></button>
            <button onClick={handleReset} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-gray-200" title="Start Over"><RefreshCw className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <div className="bg-white rounded-xl border border-rose-200 shadow-sm overflow-hidden h-full">
                <textarea
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    className="w-full h-96 p-6 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-gray-700 text-lg leading-relaxed resize-none"
                    placeholder="Summary will appear here..."
                />
                </div>
            </div>
            
            <div className="md:col-span-1">
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sticky top-24">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Source Video</h3>
                     {file && (
                        <video 
                            src={URL.createObjectURL(file)} 
                            controls 
                            className="w-full rounded-lg shadow-sm mb-2" 
                        />
                    )}
                    <p className="text-xs text-gray-500 text-center">{file?.name}</p>
                </div>
            </div>
        </div>
      </div>
    );
  }

  // --- Input View ---
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Summarize Video</h1>
      <p className="text-center text-gray-500 mb-8">Analyze video content and get a comprehensive summary with visual insights.</p>
      
      <div 
        className={`bg-rose-50/50 border-2 rounded-3xl p-12 text-center transition-all min-h-[320px] flex flex-col justify-center items-center relative mb-8
          ${!isProcessing ? 'border-dashed border-rose-200 hover:border-rose-400' : 'border-solid border-rose-100'}
          ${isProcessing ? 'opacity-75 pointer-events-none' : ''}
        `}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*"
            className="hidden" 
          />
          
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-full shadow-sm">
              <Video className="w-8 h-8 text-rose-600" />
            </div>
          </div>

          {file ? (
              <div className="w-full max-w-md mx-auto">
                   <div className="mb-4">
                       <video 
                         src={URL.createObjectURL(file)} 
                         className="w-full max-h-48 rounded-lg shadow-sm mx-auto bg-black"
                         controls
                       />
                   </div>
                   <div className="inline-flex items-center justify-center p-2 bg-rose-100 rounded-lg mb-2 w-full">
                      <Film className="w-5 h-5 text-rose-600 mr-2 flex-shrink-0" />
                      <span className="font-medium text-rose-900 truncate">{file.name}</span>
                   </div>
                   <p className="text-sm text-gray-500 mb-4">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                   <button 
                      onClick={() => setFile(null)} 
                      className="text-sm text-red-500 hover:text-red-700 underline"
                   >
                      Remove file
                   </button>
              </div>
          ) : (
              <>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Click to upload video or drag and drop</h3>
                  <p className="text-gray-500 mb-8">MP4, MOV, AVI, WEBM (Max 25MB)</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                  >
                    Browse Files
                  </button>
              </>
          )}
      </div>

      {file && file.size > 25 * 1024 * 1024 && (
        <div className="mb-6 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-100 flex items-start">
        <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
        <span>
            <strong>File too large!</strong> Video files must be under 25MB for this online tool. 
        </span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100 flex items-start">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
        </div>
      )}

      {isProcessing && (
         <div className="mb-6 space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                    className="bg-rose-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-sm text-center text-gray-500 animate-pulse">
                Analyzing video content...
            </p>
         </div>
      )}

      <button
        onClick={handleSummarize}
        disabled={!file || isProcessing || (file ? file.size > 25 * 1024 * 1024 : false)}
        className={`w-full py-4 rounded-xl text-lg font-bold transition-all transform active:scale-[0.99] shadow-lg flex items-center justify-center ${
            !file || isProcessing || (file ? file.size > 25 * 1024 * 1024 : false)
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            : 'bg-rose-600 text-white hover:bg-rose-700 hover:shadow-rose-200'
        }`}
        >
        {isProcessing ? (
            <>
               <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
               Summarizing...
            </>
        ) : (
            <>
               <Film className="w-5 h-5 mr-2" />
               Summarize Video
            </>
        )}
      </button>
    </div>
  );
}