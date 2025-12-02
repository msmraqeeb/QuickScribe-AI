import React, { useRef } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploaderProps {
  accept: string;
  onFileSelect: (file: File) => void;
  label: string;
  subLabel?: string;
  buttonText: string;
  className?: string;
  isLoading?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  accept,
  onFileSelect,
  label,
  subLabel,
  buttonText,
  className = '',
  isLoading = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    // Reset value to allow re-selecting the same file if needed
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`mb-8 ${className}`}>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{label}</h2>
      {subLabel && <p className="text-gray-500 mb-4">{subLabel}</p>}
      
      <input
        type="file"
        accept={accept}
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      <button
        onClick={handleButtonClick}
        disabled={isLoading}
        className={`w-full md:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
            <span className="flex items-center">
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                Processing...
            </span>
        ) : (
            <>
                <UploadCloud className="w-5 h-5 mr-2" />
                {buttonText}
            </>
        )}
      </button>
    </div>
  );
};
