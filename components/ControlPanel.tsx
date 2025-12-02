import React from 'react';
import { SubtitleStyle } from '../types';

interface ControlPanelProps {
  config: SubtitleStyle;
  onChange: (newConfig: SubtitleStyle) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, onChange }) => {
  
  const handleChange = (key: keyof SubtitleStyle, value: any) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Customization</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Font Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="12" 
              max="72" 
              value={config.fontSize}
              onChange={(e) => handleChange('fontSize', Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-500 w-8">{config.fontSize}px</span>
          </div>
        </div>

        {/* Text Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
          <div className="flex items-center gap-2">
            <input 
              type="color" 
              value={config.color}
              onChange={(e) => handleChange('color', e.target.value)}
              className="h-9 w-full rounded border border-gray-300 cursor-pointer p-1"
            />
          </div>
        </div>

         {/* Background Color */}
         <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
           <div className="flex gap-2">
             <input 
              type="color" 
              value={config.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              className="h-9 w-12 flex-shrink-0 rounded border border-gray-300 cursor-pointer p-1"
            />
             <select 
               value={config.backgroundOpacity}
               onChange={(e) => handleChange('backgroundOpacity', Number(e.target.value))}
               className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
             >
               <option value={0}>None</option>
               <option value={0.5}>Low</option>
               <option value={0.8}>High</option>
               <option value={1}>Solid</option>
             </select>
           </div>
        </div>


        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
          <select 
            value={config.position}
            onChange={(e) => handleChange('position', e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </div>

        {/* Font Family */}
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
             <select 
                value={config.fontFamily}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            >
                <option value="Inter, sans-serif">Inter (Default)</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Verdana, sans-serif">Verdana</option>
            </select>
        </div>
      </div>
    </div>
  );
};
