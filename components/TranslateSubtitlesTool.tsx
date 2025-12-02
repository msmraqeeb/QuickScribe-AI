import React, { useState } from 'react';
import { FileUploader } from './FileUploader';
import { parseSRT, generateSRT, generateVTT } from '../utils/srtHelpers';
import { translateSubtitles } from '../services/geminiService';
import { Subtitle } from '../types';
import { Languages, Download, ArrowRight, CheckCircle, AlertCircle, RefreshCw, Copy } from 'lucide-react';

const LANGUAGES = [
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'tr', name: 'Turkish' },
    { code: 'pl', name: 'Polish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'th', name: 'Thai' },
    { code: 'id', name: 'Indonesian' },
    { code: 'bn', name: 'Bengali' },
];

export const TranslateSubtitlesTool: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [originalSubtitles, setOriginalSubtitles] = useState<Subtitle[]>([]);
    const [translatedSubtitles, setTranslatedSubtitles] = useState<Subtitle[]>([]);
    const [targetLanguage, setTargetLanguage] = useState('es');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = async (selectedFile: File) => {
        setFile(selectedFile);
        setError(null);
        setTranslatedSubtitles([]);
        setOriginalSubtitles([]);

        try {
            const text = await selectedFile.text();
            let cleanText = text;
            // Basic VTT cleanup if needed
            if (text.startsWith('WEBVTT')) {
                cleanText = text.replace(/^WEBVTT\s+/, '').trim();
            }
            const parsed = parseSRT(cleanText);
            if (parsed.length === 0) {
                throw new Error("Could not parse subtitles. Ensure file is a valid SRT or VTT.");
            }
            setOriginalSubtitles(parsed);
        } catch (e: any) {
            setError(e.message || "Invalid file format.");
        }
    };

    const handleTranslate = async () => {
        if (originalSubtitles.length === 0) return;
        setIsProcessing(true);
        setProgress(0);
        setError(null);

        try {
            const langName = LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;
            
            const result = await translateSubtitles(
                originalSubtitles, 
                langName, 
                (pct) => setProgress(pct)
            );
            
            setTranslatedSubtitles(result);
            setProgress(100);
        } catch (e: any) {
            console.error(e);
            setError("Translation failed. Please try again later.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = (format: 'srt' | 'vtt') => {
        const content = format === 'srt' ? generateSRT(translatedSubtitles) : generateVTT(translatedSubtitles);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `translated_${targetLanguage}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-12">
            <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">Translate Subtitles</h1>
            <p className="text-center text-gray-500 mb-12">Instantly translate SRT/VTT files to any language while preserving timestamps.</p>

            {/* Step 1: Upload */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
                         <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-2">1</span>
                            Upload File
                         </h2>
                         <FileUploader
                            accept=".srt,.vtt"
                            onFileSelect={handleFileSelect}
                            label=""
                            buttonText={file ? "Change File" : "Select .SRT / .VTT"}
                            className="mb-0"
                         />
                         {file && originalSubtitles.length > 0 && (
                             <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center">
                                 <CheckCircle className="w-4 h-4 mr-2" />
                                 {originalSubtitles.length} lines loaded
                             </div>
                         )}
                    </div>
                </div>

                {/* Step 2: Configure & Translate */}
                <div className="lg:col-span-2">
                     <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full flex flex-col">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-2">2</span>
                            Select Language & Translate
                        </h2>
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="flex-grow">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Target Language</label>
                                <select
                                    value={targetLanguage}
                                    onChange={(e) => setTargetLanguage(e.target.value)}
                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 py-3 px-4"
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleTranslate}
                                    disabled={!file || isProcessing || originalSubtitles.length === 0}
                                    className={`px-8 py-3 rounded-lg font-bold text-white shadow-md transition-all flex items-center justify-center h-[46px] w-full sm:w-auto
                                        ${!file || isProcessing 
                                            ? 'bg-gray-300 cursor-not-allowed' 
                                            : 'bg-purple-600 hover:bg-purple-700 hover:shadow-lg transform hover:-translate-y-0.5'
                                        }`}
                                >
                                    {isProcessing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Translating...
                                        </>
                                    ) : (
                                        <>
                                            <Languages className="w-4 h-4 mr-2" />
                                            Translate
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                <div 
                                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        )}

                        {error && (
                            <div className="mt-auto p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-start">
                                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}
                     </div>
                </div>
            </div>

            {/* Results Preview */}
            {translatedSubtitles.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-8">
                    <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-900 flex items-center">
                            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                            Translation Complete
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleDownload('srt')}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                            >
                                <Download className="w-4 h-4 mr-2" /> SRT
                            </button>
                            <button
                                onClick={() => handleDownload('vtt')}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center"
                            >
                                <Download className="w-4 h-4 mr-2" /> VTT
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <div className="p-3 border-r border-gray-200">Original</div>
                        <div className="p-3">Translated ({LANGUAGES.find(l => l.code === targetLanguage)?.name})</div>
                    </div>
                    
                    <div className="max-h-[500px] overflow-y-auto scrollbar-thin">
                        {translatedSubtitles.map((sub, idx) => (
                            <div key={sub.id} className="grid grid-cols-2 border-b border-gray-100 hover:bg-blue-50 transition-colors group text-sm">
                                <div className="p-4 border-r border-gray-100 text-gray-600">
                                    <div className="text-xs text-gray-400 font-mono mb-1">
                                        {Math.floor(sub.startTime/60)}:{Math.floor(sub.startTime%60).toString().padStart(2,'0')}
                                    </div>
                                    {originalSubtitles[idx]?.text}
                                </div>
                                <div className="p-4 text-gray-900 font-medium">
                                    <div className="text-xs text-transparent group-hover:text-gray-400 font-mono mb-1 transition-colors">
                                        {Math.floor(sub.startTime/60)}:{Math.floor(sub.startTime%60).toString().padStart(2,'0')}
                                    </div>
                                    {sub.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};