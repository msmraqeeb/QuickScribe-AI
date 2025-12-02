import React from 'react';
import { Sparkles } from 'lucide-react';

interface HeaderProps {
  onLogoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogoClick }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center cursor-pointer" onClick={onLogoClick}>
            <div className="flex-shrink-0 flex items-center text-blue-600">
              <Sparkles className="h-8 w-8 mr-2" />
              <span className="font-bold text-2xl tracking-tight text-gray-900">QuickScribe AI</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};