import React, { useState } from 'react';
import { FileUploader } from './FileUploader';
import { parseSRT, convertSubtitles } from '../utils/srtHelpers';
import { Subtitle } from '../types';
import { FileCode, ArrowRight, Download, CheckCircle, AlertCircle } from 'lucide-react';

type Format = 'srt' | 'vtt' | 'docx' | 'txt' | 'pdf';

export const SubtitleConverterTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<Format>('vtt');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setDownloadUrl(null);
    setIsProcessing(true);

    try {
      const text = await selectedFile.text();
      // Basic check if it looks like VTT or SRT
      if (!text.includes('-->')) {
          throw new Error("Invalid subtitle file. Missing timestamp arrows (-->).");
      }

      // If VTT, strip header before parsing
      const cleanText = text.replace(/^WEBVTT\s+/, '').trim();
      const parsed = parseSRT(cleanText);
      
      if (parsed.length === 0) {
          throw new Error("Could not parse any subtitles from this file.");
      }
      
      setSubtitles(parsed);
    } catch (e: any) {
      setError(e.message || "Failed to parse file.");
      setSubtitles([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvert = async () => {
    if (subtitles.length === 0) return;
    setIsProcessing(true);
    
    try {
        const blob = await convertSubtitles(subtitles, selectedFormat);
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
    } catch (e) {
        console.error(e);
        setError("Conversion failed.");
    } finally {
        setIsProcessing(false);
    }
  };

  const getExtension = (fmt: Format) => {
      switch (fmt) {
          case 'docx': return 'doc'; // Use .doc for simple HTML-Word compat
          default: return fmt;
      }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Subtitle Converter</h1>
        <p className="text-center text-gray-500 mb-12">Convert SRT/VTT subtitles to PDF, DOCX, TXT and other formats.</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8">
                 <div className="mb-8">
                    <span className="block text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4">Step 1: Upload</span>
                    <FileUploader
                        accept=".srt,.vtt"
                        onFileSelect={handleFileSelect}
                        label="Upload Subtitle File"
                        subLabel=".srt or .vtt"
                        buttonText={file ? "Change File" : "Select File"}
                        className={file ? "opacity-100" : ""}
                    />
                 </div>

                 {file && subtitles.length > 0 && (
                     <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                         <div className="flex items-center justify-center text-green-600 bg-green-50 p-3 rounded-lg">
                             <CheckCircle className="w-5 h-5 mr-2" />
                             <span className="font-medium">Loaded {subtitles.length} lines from {file.name}</span>
                         </div>

                         <div className="border-t border-gray-100 pt-8">
                            <span className="block text-sm font-bold text-indigo-600 uppercase tracking-wider mb-4">Step 2: Choose Format</span>
                            
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-center p-6 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <FileCode className="w-8 h-8 text-gray-400" />
                                    <span className="font-mono text-gray-600">Original</span>
                                </div>
                                <ArrowRight className="w-5 h-5 text-gray-400 hidden md:block" />
                                <div className="w-full md:w-64">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Format</label>
                                    <div className="relative">
                                        <select
                                            value={selectedFormat}
                                            onChange={(e) => {
                                                setSelectedFormat(e.target.value as Format);
                                                setDownloadUrl(null); // Reset download if format changes
                                            }}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 pl-4 pr-10 text-base"
                                        >
                                            <option value="srt">SubRip (.srt)</option>
                                            <option value="vtt">WebVTT (.vtt)</option>
                                            <option value="docx">Microsoft Word (.doc)</option>
                                            <option value="txt">Text (.txt)</option>
                                            <option value="pdf">PDF (.pdf)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                         </div>

                         <div className="pt-4">
                             {downloadUrl ? (
                                 <a
                                    href={downloadUrl}
                                    download={`converted_subtitles.${getExtension(selectedFormat)}`}
                                    className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 shadow-lg transition-transform hover:-translate-y-0.5"
                                 >
                                     <Download className="w-6 h-6 mr-2" />
                                     Download .{getExtension(selectedFormat).toUpperCase()}
                                 </a>
                             ) : (
                                <button
                                    onClick={handleConvert}
                                    disabled={isProcessing}
                                    className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg transition-transform hover:-translate-y-0.5"
                                >
                                    {isProcessing ? "Converting..." : "Convert Now"}
                                </button>
                             )}
                         </div>
                     </div>
                 )}

                 {error && (
                    <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
                        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                 )}
            </div>
        </div>
    </div>
  );
};