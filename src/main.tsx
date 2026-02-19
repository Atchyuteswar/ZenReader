import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import JSZip from 'jszip';

// Polyfill JSZip for epubjs
if (typeof window !== 'undefined') {
  (window as any).JSZip = JSZip;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
