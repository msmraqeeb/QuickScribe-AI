
import React, { useState, useRef } from 'react';
import { UploadCloud, RefreshCw, Download, Video, AlertTriangle, CheckCircle } from 'lucide-react';
import { convertVideo } from '../services/videoProcessor';

export const VideoConverterTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>('mp4');
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Full list of requested formats
  const formats = [
      '3gp', 'avi', 'flv', 'm4v', 'mk3d', 'moov', 'mov', 'mp4', 
      'mpa', 'mpe', 'mpeg', 'mpg', 'mxf', 'qt', 'vob', 'weba'
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setConvertedBlob(null);
      setError(null);
      setProgress(0);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('video/')) {
        setFile(droppedFile);
        setConvertedBlob(null);
        setError(null);
        setProgress(0);
      } else {
        setError("Please upload a valid video file.");
      }
    }
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsConverting(true);
    setProgress(0);
    setError(null);

    try {
        const blob = await convertVideo(file, targetFormat, (pct) => setProgress(pct));
        setConvertedBlob(blob);
    } catch (e: any) {
        console.error(e);
        setError(e.message || "Conversion failed. Ensure your browser supports this operation.");
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
    // Ensure the filename extension matches the selected target
    a.download = `${originalName}_converted.${targetFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Video Converter</h1>
      <p className="text-center text-gray-500 mb-12">Convert videos to various formats directly in your browser.</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
              {/* Step 1: Upload */}
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer mb-8
                    ${file ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50'}
                    ${isConverting ? 'opacity-70 pointer-events-none' : ''}
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
                  />
                  
                  {file ? (
                      <div className="flex flex-col items-center">
                          <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                              <Video className="w-8 h-8 text-green-600" />
                          </div>
                          <h3 className="font-bold text-gray-900">{file.name}</h3>
                          <p className="text-sm text-gray-500 mb-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
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
                          <p className="text-sm text-gray-400">Supports MOV, AVI, MP4, MKV</p>
                      </div>
                  )}
              </div>

              {/* Step 2: Configure */}
              {file && !convertedBlob && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Target Format</label>
                          <div className="relative">
                              <select
                                value={targetFormat}
                                onChange={(e) => setTargetFormat(e.target.value)}
                                className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4 text-base bg-white"
                                disabled={isConverting}
                              >
                                  {formats.map((fmt) => (
                                      <option key={fmt} value={fmt}>
                                          {fmt.toUpperCase()}
                                      </option>
                                  ))}
                              </select>
                          </div>
                          
                          {/* Note regarding compatibility */}
                          <div className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                              <span>
                                  Note: Some legacy formats (like AVI, FLV, VOB) are generated using modern codecs compatible with most players (VLC, etc.), 
                                  but might not play in older strict environments.
                              </span>
                          </div>
                      </div>

                      {isConverting ? (
                          <div className="space-y-3">
                              <div className="flex justify-between text-sm text-gray-600">
                                  <span>Converting to {targetFormat.toUpperCase()}...</span>
                                  <span>{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div 
                                      className="bg-green-600 h-2.5 rounded-full transition-all duration-300 linear" 
                                      style={{ width: `${progress}%` }}
                                  ></div>
                              </div>
                              <p className="text-xs text-gray-400 text-center">Please keep this tab open during conversion.</p>
                          </div>
                      ) : (
                          <button 
                            onClick={handleConvert}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center transform active:scale-[0.99]"
                          >
                              <RefreshCw className="w-5 h-5 mr-2" />
                              Start Conversion
                          </button>
                      )}

                      {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center border border-red-100">
                            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" /> {error}
                        </div>
                      )}
                  </div>
              )}

              {/* Step 3: Result */}
              {convertedBlob && (
                  <div className="text-center space-y-6 animate-in zoom-in duration-300 pt-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm">
                          <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-gray-900">Conversion Complete!</h3>
                          <p className="text-gray-500">Your {targetFormat.toUpperCase()} file is ready.</p>
                      </div>
                      
                      <button 
                        onClick={handleDownload}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg transition-colors flex items-center justify-center transform hover:-translate-y-1"
                      >
                          <Download className="w-5 h-5 mr-2" />
                          Download File
                      </button>

                      <button 
                        onClick={() => { setConvertedBlob(null); setFile(null); }}
                        className="text-gray-500 hover:text-gray-700 text-sm font-medium hover:underline"
                      >
                          Convert Another Video
                      </button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
