
import React from 'react';
import { ToolCard } from './ToolCard';
import { 
  FileText, 
  Video, 
  Captions, 
  FileCode, 
  Languages, 
  Type, 
  Clock, 
  Layers, 
  Globe, 
  Sparkles, 
  Film, 
  Music, 
  Scissors, 
  RefreshCw, 
  MonitorPlay,
  FileAudio
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (toolId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const tools = [
    {
      id: 'audio-to-text',
      title: 'Audio to text',
      description: 'Transcribe your audio recordings fast. Accurate, speaker-ready text instantly.',
      icon: FileText,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'video-to-text',
      title: 'Video to Text',
      description: 'Extract speech from video files into accurate text documents.',
      icon: Video,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50'
    },
    {
      id: 'subtitle-generator',
      title: 'Subtitle Generator',
      description: 'Create synchronized SRT subtitles for your videos automatically.',
      icon: Captions,
      iconColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      id: 'subtitle-converter',
      title: 'Subtitle Converter',
      description: 'Convert SRT/VTT subtitles to PDF, DOCX, TXT and other formats.',
      icon: FileCode,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      id: 'translate-subtitles',
      title: 'Translate Subtitles',
      description: 'Translate SRT/VTT files to other languages while preserving timecodes.',
      icon: Languages,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'subtitle-editor',
      title: 'Subtitle Editor',
      description: 'Edit text and timestamps of SRT/VTT files with ease.',
      icon: Type,
      iconColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50'
    },
    {
      id: 'srt-time-shift',
      title: 'SRT Time Shift',
      description: 'Sync your SRT file by shifting timecodes (offset) to match the video.',
      icon: Clock,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'hardcode-subtitles',
      title: 'Hardcode Subtitles',
      description: 'Merge an existing subtitle file permanently into your video.',
      icon: Layers,
      iconColor: 'text-pink-600',
      bgColor: 'bg-pink-50'
    },
    {
      id: 'translate-audio',
      title: 'Translate Audio',
      description: 'Translate spoken audio into English, Spanish, French and more.',
      icon: Globe, // Fallback icon for translate audio if needed
      iconColor: 'text-violet-600',
      bgColor: 'bg-violet-50'
    },
    {
      id: 'translate-video',
      title: 'Translate Video',
      description: 'Translate spoken content in videos with unlimited file size.',
      icon: Globe,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50'
    },
    {
      id: 'audio-summarizer',
      title: 'Audio Summarizer',
      description: 'Capture key points from audio quickly. Get concise insights.',
      icon: Sparkles,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    {
      id: 'summarize-video',
      title: 'Summarize Video',
      description: 'Analyze video content and get a comprehensive summary with key visual insights.',
      icon: Film,
      iconColor: 'text-rose-600',
      bgColor: 'bg-rose-50'
    },
    {
      id: 'audio-joiner',
      title: 'Audio Joiner',
      description: 'Merge multiple audio files into a single continuous track.',
      icon: Music,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'audio-trimmer',
      title: 'Audio Trimmer',
      description: 'Cut and trim specific parts of your audio files precisely.',
      icon: Scissors,
      iconColor: 'text-red-400',
      bgColor: 'bg-red-50'
    },
    {
      id: 'video-trimmer',
      title: 'Video Trimmer',
      description: 'Cut and trim specific parts of your video files precisely.',
      icon: Scissors,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50'
    },
    {
      id: 'audio-converter',
      title: 'Audio Converter',
      description: 'Convert audio files between WAV and WebM formats instantly.',
      icon: RefreshCw,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'video-converter',
      title: 'Video Converter',
      description: 'Convert videos to different formats (MP4, AVI, MKV, etc).',
      icon: MonitorPlay,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'video-to-audio',
      title: 'Video to Audio',
      description: 'Extract audio from video files and convert to MP3, WAV, M4A, etc.',
      icon: FileAudio,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-4">
           <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg">
             <Sparkles className="w-12 h-12" />
           </div>
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight mb-4">QuickScribe AI</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          Professional AI tools for your audio and video content.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tools.map((tool) => (
          <ToolCard 
            key={tool.id}
            {...tool}
            onClick={() => onNavigate(tool.id)}
          />
        ))}
      </div>
    </div>
  );
};
