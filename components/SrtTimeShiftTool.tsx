
import React, { useState } from 'react';
import { FileUploader } from './FileUploader';
import { parseSRT, generateSRT, generateVTT } from '../utils/srtHelpers';
import { Subtitle } from '../types';
import { Clock, Download, ArrowRight, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const SrtTimeShiftTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [offsetSeconds, setOffsetSeconds] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [previewSubtitles, setPreviewSubtitles] = useState<Subtitle[]>([]);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setSubtitles([]);
    setPreviewSubtitles([]);

    try {
      const text = await selectedFile.text();
      let cleanText = text;
      if (text.startsWith('WEBVTT')) {
        cleanText = text.replace(/^WEBVTT\s+/, '').trim();
      }
      const parsed = parseSRT(cleanText);
      if (parsed.length === 0) throw new Error("No subtitles found in file.");
      setSubtitles(parsed);
    } catch (e: any) {
      setError(e.message || "Failed to parse subtitle file.");
    }
  };

  const getShiftedSubtitles = () => {
    return subtitles.map(sub => ({
      ...sub,
      startTime: Math.max(0, sub.startTime + offsetSeconds),
      endTime: Math.max(0, sub.endTime + offsetSeconds)
    }));
  };

  const formatTime = (seconds: number) => {
    const pad = (num: number, size: number) => ('000' + num).slice(size * -1);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  };

  const handleDownload = (format: 'srt' | 'vtt') => {
    const shifted = getShiftedSubtitles();
    const content = format === 'srt' ? generateSRT(shifted) : generateVTT(shifted);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synced_subtitles.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">SRT Time Shift</h1>
      <p className="text-center text-gray-500 mb-12">Fix out-of-sync subtitles by shifting timestamps forward or backward.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-900 mb-4">1. Upload File</h2>
              <FileUploader
                accept=".srt,.vtt"
                onFileSelect={handleFileSelect}
                label=""
                buttonText={file ? "Change File" : "Select Subtitles"}
                className="mb-0"
              />
              {file && subtitles.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center">
                   <CheckCircle className="w-4 h-4 mr-2" /> {subtitles.length} lines loaded
                </div>
              )}
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
                   <AlertCircle className="w-4 h-4 mr-2" /> {error}
                </div>
              )}
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="font-bold text-gray-900 mb-4">2. Set Offset</h2>
              <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-2">Time Shift (Seconds)</label>
                 <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setOffsetSeconds(prev => Number((prev - 0.5).toFixed(2)))}
                        className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 font-mono"
                    >-</button>
                    <input 
                        type="number"
                        step="0.1"
                        value={offsetSeconds}
                        onChange={(e) => setOffsetSeconds(Number(e.target.value))}
                        className="block w-full text-center rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 py-3 text-lg font-mono font-bold"
                        placeholder="0.0"
                    />
                    <button 
                        onClick={() => setOffsetSeconds(prev => Number((prev + 0.5).toFixed(2)))}
                        className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200 font-mono"
                    >+</button>
                 </div>
                 <p className="text-xs text-gray-500 mt-2">
                    Positive (+) makes subtitles appear later.<br/>
                    Negative (-) makes subtitles appear earlier.
                 </p>
              </div>

              <div className="space-y-2">
                  <button 
                    onClick={() => handleDownload('srt')}
                    disabled={!file}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <Download className="w-5 h-5 mr-2" /> Download SRT
                  </button>
                  <button 
                    onClick={() => handleDownload('vtt')}
                    disabled={!file}
                    className="w-full py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <Download className="w-5 h-5 mr-2" /> Download VTT
                  </button>
              </div>
           </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-gray-500" />
                        Preview Changes
                    </h3>
                    {offsetSeconds !== 0 && (
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${offsetSeconds > 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {offsetSeconds > 0 ? `Delayed by ${offsetSeconds}s` : `Hastened by ${Math.abs(offsetSeconds)}s`}
                        </span>
                    )}
                </div>
                
                <div className="flex-grow overflow-y-auto p-0">
                    {subtitles.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                            {subtitles.slice(0, 50).map((sub) => {
                                const newStart = Math.max(0, sub.startTime + offsetSeconds);
                                const newEnd = Math.max(0, sub.endTime + offsetSeconds);
                                
                                return (
                                    <div key={sub.id} className="p-4 hover:bg-gray-50 transition-colors grid grid-cols-12 gap-4 text-sm">
                                        <div className="col-span-1 text-gray-400 font-mono text-xs pt-1">#{sub.id}</div>
                                        <div className="col-span-4 font-mono text-gray-500">
                                            <div className="line-through opacity-50 text-xs">{formatTime(sub.startTime)}</div>
                                            <div className="text-gray-400 text-xs">↓</div>
                                            <div className="line-through opacity-50 text-xs">{formatTime(sub.endTime)}</div>
                                        </div>
                                        <div className="col-span-1 flex items-center justify-center text-purple-500">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                        <div className="col-span-6">
                                            <div className="font-mono font-bold text-purple-700">
                                                {formatTime(newStart)}
                                            </div>
                                            <div className="text-xs text-transparent select-none">↓</div>
                                            <div className="font-mono font-bold text-purple-700">
                                                {formatTime(newEnd)}
                                            </div>
                                            <p className="mt-2 text-gray-800">{sub.text}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            {subtitles.length > 50 && (
                                <div className="p-4 text-center text-gray-400 text-sm bg-gray-50">
                                    ... and {subtitles.length - 50} more lines
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12">
                            <Clock className="w-16 h-16 mb-4 opacity-20" />
                            <p>Upload a file to preview timestamp changes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
