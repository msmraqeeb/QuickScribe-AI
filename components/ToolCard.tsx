import React from 'react';
import { LucideIcon, ChevronRight } from 'lucide-react';

interface ToolCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  iconColor?: string;
  bgColor?: string;
}

export const ToolCard: React.FC<ToolCardProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  onClick,
  iconColor = "text-blue-600",
  bgColor = "bg-blue-50"
}) => {
  return (
    <div 
      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-start cursor-pointer group h-full"
      onClick={onClick}
    >
      <div className={`p-3 rounded-xl ${bgColor} mb-4 group-hover:scale-105 transition-transform duration-200`}>
        <Icon className={`w-8 h-8 ${iconColor}`} />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed mb-6 flex-grow">{description}</p>
      <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform">
        Open Tool <ChevronRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );
};