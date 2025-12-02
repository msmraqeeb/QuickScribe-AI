import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Mic, Download, Copy, RefreshCw, PenLine, AlertTriangle, Square, Trash2 } from 'lucide-react';
import { transcribeAudio } from '../services/geminiService';

export const AudioToTextTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
  const [file, setFile] = useState<File | null>(null);
  
  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ language: string; text: string } | null>(null);
  const [editableText, setEditableText] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Timer Logic via Effect
  useEffect(() => {
    let interval: number;
    if (isRecording) {
      // Reset duration when recording starts
      setRecordingDuration(0);
      interval = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [isRecording]);

  // Cleanup cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
         if (mediaRecorderRef.current.stream) {
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
         }
      }
    };
  }, []);

  const handleTabChange = (tab: 'upload' | 'record') => {
    if (isProcessing) return;
    setActiveTab(tab);
    handleReset(); // Clear current file/result when switching tabs
  };

  const validateAndSetFile = (selectedFile: File) => {
    // Browser string limit safety & Network Upload Reliability
    // 25MB is the recommended safe limit for inline API calls to prevent Timeouts (500)
    const LIMIT_MB = 25;
    if (selectedFile.size > LIMIT_MB * 1024 * 1024) {
      setError(`File is too large (${(selectedFile.size / 1024 / 1024).toFixed(1)}MB). Please use a file under ${LIMIT_MB}MB for stable transcription.`);
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
    // Reset input value so the same file can be selected again if needed
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeTab === 'upload' && e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // --- Recording Logic ---

  const startRecording = async () => {
    try {
      setError(null);
      
      // Check for secure context (HTTPS) which is required for getUserMedia
      if (window.isSecureContext === false) {
          throw new Error("Microphone access requires a secure context (HTTPS). Please ensure you are connected via HTTPS.");
      }

      // Check for API availability
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microphone API not available. This feature requires a supported browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Prefer opus for better compression/quality if available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create Audio Blob
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // IMPORTANT: Use .weba extension so the service recognizes it as Audio, not Video
        const audioFile = new File([audioBlob], `recording_${Date.now()}.weba`, { type: 'audio/webm' });
        
        validateAndSetFile(audioFile);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      // Timer is handled by useEffect now

    } catch (err: any) {
      console.error("Microphone error:", err);
      // Enhanced error handling for common permission issues
      const msg = err.message || '';

      if (msg.includes('platform in the current context') || msg.includes('not allowed by the user agent')) {
         setError("Microphone access is blocked by the browser environment. If you are using an embedded preview or iframe, try opening the app in a new tab.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || msg.includes('not allowed')) {
          setError("Microphone access denied. Please allow microphone access in your browser settings (click the lock icon in the address bar).");
      } else if (err.name === 'NotFoundError') {
          setError("No microphone found. Please connect a microphone device.");
      } else if (msg.includes("HTTPS")) {
          setError(msg);
      } else {
          setError(`Could not access microphone: ${msg || 'Unknown error'}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Transcription Logic ---

  const handleTranscribe = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    // Simulate progress
    const progressInterval = file.size > 5 * 1024 * 1024 ? 1500 : 500;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + (file.size > 5 * 1024 * 1024 ? 1 : 5);
      });
    }, progressInterval);

    try {
      const data = await transcribeAudio(file);
      setResult(data);
      setEditableText(data.text);
      setProgress(100);
    } catch (err: any) {
      console.error("Transcription UI Error:", err);
      let msg = "Failed to transcribe audio. Please try again.";
      
      if (err instanceof Error) {
          msg = err.message;
      } else if (typeof err === 'string') {
          msg = err;
      } else if (err && typeof err === 'object' && err.message) {
          msg = err.message;
      }
      
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
    a.download = `transcription_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    stopRecording(); // Safety stop
    setFile(null);
    setResult(null);
    setEditableText('');
    setProgress(0);
    setError(null);
    setRecordingDuration(0);
  };

  // --- Render Views ---

  if (result) {
    // Result View
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Transcription</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <PenLine className="w-3 h-3 mr-1" />
              Editable
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleCopy}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
              title="Copy text"
            >
              <Copy className="w-5 h-5" />
            </button>
            <button 
              onClick={handleDownload}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
              title="Download text"
            >
              <Download className="w-5 h-5" />
            </button>
            <button 
              onClick={handleReset}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
              title="Start Over"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
          <textarea
            value={editableText}
            onChange={(e) => setEditableText(e.target.value)}
            className="w-full h-96 p-6 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 text-lg leading-relaxed resize-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">Transcribe</h1>
      
      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex relative">
          <button 
            onClick={() => handleTabChange('upload')}
            className={`px-6 py-2 rounded-md text-sm font-medium flex items-center transition-all duration-200 ${activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload File
          </button>
          <button 
             onClick={() => handleTabChange('record')}
             className={`px-6 py-2 rounded-md text-sm font-medium flex items-center transition-all duration-200 ${activeTab === 'record' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Mic className="w-4 h-4 mr-2" />
            Record Audio
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className={`bg-blue-50/50 border-2 rounded-3xl p-12 text-center transition-all h-[320px] flex flex-col justify-center items-center relative
          ${activeTab === 'upload' ? 'border-dashed border-blue-200 hover:border-blue-400' : 'border-solid border-blue-100'}
          ${isProcessing ? 'opacity-75 pointer-events-none' : ''}
        `}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {activeTab === 'upload' ? (
          /* Upload View */
          <>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="audio/*,video/*"
              className="hidden" 
            />
            
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 rounded-full shadow-sm">
                <UploadCloud className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            {file ? (
                <div className="w-full">
                     <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-lg mb-2">
                        <FileText className="w-6 h-6 text-blue-600 mr-2" />
                        <span className="font-medium text-blue-900 truncate max-w-[200px]">{file.name}</span>
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
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Click to upload or drag and drop</h3>
                    <p className="text-gray-500 mb-8">MP3, WAV, MP4, MOV (Max 25MB)</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                    >
                      Browse Files
                    </button>
                </>
            )}
          </>
        ) : (
          /* Record View */
          <>
            {!file && !isRecording && (
               <>
                 <div className="mb-8">
                   <button 
                      type="button"
                      onClick={startRecording}
                      className="w-20 h-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:shadow-blue-200 transition-all transform hover:scale-105 mx-auto border-none outline-none"
                      aria-label="Start Recording"
                   >
                     <Mic className="w-10 h-10 text-white" />
                   </button>
                 </div>
                 <h3 className="text-xl font-bold text-gray-900 mb-2">Click to Start Recording</h3>
                 <p className="text-gray-500">Ensure microphone access is allowed</p>
               </>
            )}

            {!file && isRecording && (
               <>
                 <div className="mb-8 relative">
                    <span className="absolute -inset-4 rounded-full bg-red-100 animate-ping opacity-75"></span>
                    <button 
                       type="button"
                       onClick={stopRecording}
                       className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg z-10 relative transition-colors border-none outline-none"
                       aria-label="Stop Recording"
                    >
                      <Square className="w-8 h-8 text-white fill-current" />
                    </button>
                 </div>
                 <div className="text-2xl font-mono font-bold text-gray-900 mb-2">
                   {formatTime(recordingDuration)}
                 </div>
                 <p className="text-red-500 font-medium animate-pulse">Recording...</p>
               </>
            )}

            {file && (
                <div className="w-full">
                     <div className="mb-6 flex flex-col items-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Mic className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Recording Complete</h3>
                        <p className="text-gray-500 text-sm mb-4">{formatTime(recordingDuration)} • {(file.size / 1024).toFixed(0)} KB</p>
                        
                        {/* Simple Audio Player Preview */}
                        <audio controls src={URL.createObjectURL(file)} className="mb-4 max-w-[250px]" />
                        
                        <button 
                            onClick={handleReset}
                            className="flex items-center text-gray-500 hover:text-red-600 transition-colors text-sm font-medium"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Discard and Record Again
                        </button>
                     </div>
                </div>
            )}
          </>
        )}
      </div>

      {/* Warning for large files */}
      {file && file.size > 15 * 1024 * 1024 && activeTab === 'upload' && (
        <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-100 flex items-start">
          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>
            Large file detected ({((file.size / (1024 * 1024))).toFixed(0)}MB). 
            Processing may take longer. Please keep this tab active.
            {file.type.includes('wav') && " Uncompressed WAV files often cause timeouts. Try converting to MP3."}
          </span>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-center text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
            <strong>Error: </strong>{error}
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && (
         <div className="mt-8 space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-sm text-center text-gray-500 animate-pulse">
                {progress < 100 ? 'Processing your audio... (This may take a minute)' : 'Finalizing...'}
            </p>
         </div>
      )}

      {/* Action Button */}
      <div className="mt-8">
        <button
          onClick={handleTranscribe}
          disabled={!file || isProcessing}
          className={`w-full py-4 rounded-xl text-lg font-bold transition-all transform active:scale-[0.99] shadow-lg ${
            !file || isProcessing
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-200'
          }`}
        >
          {isProcessing ? 'Transcribing...' : 'Transcribe'}
        </button>
      </div>
    </div>
  );
}