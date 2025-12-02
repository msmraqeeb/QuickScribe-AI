
import React, { useState } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { HardcodeSubtitlesTool } from './components/HardcodeSubtitlesTool';
import { AudioToTextTool } from './components/AudioToTextTool';
import { VideoToTextTool } from './components/VideoToTextTool';
import { SubtitleGeneratorTool } from './components/SubtitleGeneratorTool';
import { SubtitleConverterTool } from './components/SubtitleConverterTool';
import { TranslateSubtitlesTool } from './components/TranslateSubtitlesTool';
import { SubtitleEditorTool } from './components/SubtitleEditorTool';
import { SrtTimeShiftTool } from './components/SrtTimeShiftTool';
import { TranslateAudioTool } from './components/TranslateAudioTool';
import { TranslateVideoTool } from './components/TranslateVideoTool';
import { AudioSummarizerTool } from './components/AudioSummarizerTool';
import { SummarizeVideoTool } from './components/SummarizeVideoTool';
import { AudioJoinerTool } from './components/AudioJoinerTool';
import { AudioTrimmerTool } from './components/AudioTrimmerTool';
import { VideoTrimmerTool } from './components/VideoTrimmerTool';
import { AudioConverterTool } from './components/AudioConverterTool';
import { VideoConverterTool } from './components/VideoConverterTool';
import { VideoToAudioTool } from './components/VideoToAudioTool';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');

  const navigateTo = (view: string) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={navigateTo} />;
      case 'hardcode-subtitles':
        return <HardcodeSubtitlesTool />;
      case 'audio-to-text':
        return <AudioToTextTool />;
      case 'video-to-text':
        return <VideoToTextTool />;
      case 'subtitle-generator':
        return <SubtitleGeneratorTool />;
      case 'subtitle-converter':
        return <SubtitleConverterTool />;
      case 'translate-subtitles':
        return <TranslateSubtitlesTool />;
      case 'subtitle-editor':
        return <SubtitleEditorTool />;
      case 'srt-time-shift':
        return <SrtTimeShiftTool />;
      case 'translate-audio':
        return <TranslateAudioTool />;
      case 'translate-video':
        return <TranslateVideoTool />;
      case 'audio-summarizer':
        return <AudioSummarizerTool />;
      case 'summarize-video':
        return <SummarizeVideoTool />;
      case 'audio-joiner':
        return <AudioJoinerTool />;
      case 'audio-trimmer':
        return <AudioTrimmerTool />;
      case 'video-trimmer':
        return <VideoTrimmerTool />;
      case 'audio-converter':
        return <AudioConverterTool />;
      case 'video-converter':
        return <VideoConverterTool />;
      case 'video-to-audio':
        return <VideoToAudioTool />;
      default:
        // Fallback for tools not yet implemented
        return (
          <div className="max-w-7xl mx-auto px-4 py-20 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Coming Soon</h2>
            <p className="text-gray-500 mb-8">This tool is currently under development.</p>
            <button 
              onClick={() => navigateTo('dashboard')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      <Header onLogoClick={() => navigateTo('dashboard')} />
      <main className="flex-grow w-full">
        {renderCurrentView()}
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <p className="text-center text-gray-400 text-sm">
             &copy; {new Date().getFullYear()} QuickScribe AI. All rights reserved. Proudly Presented By: <a href="https://shakil-mahmud.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">Shakil Mahmud</a>
           </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
