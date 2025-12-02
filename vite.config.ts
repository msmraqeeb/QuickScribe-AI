import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': process.env
  },
  build: {
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'lucide-react',
        '@google/genai',
        'jspdf',
        'lamejs'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'lucide-react': 'lucide',
          '@google/genai': 'GoogleGenAI',
          jspdf: 'jspdf',
          lamejs: 'lamejs'
        }
      }
    }
  }
});