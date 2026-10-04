import {StrictMode} from 'react';
import { AuthGate } from './components/AuthGate';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyActiveFont, restoreUploadedFontIfAny } from './fontManager';

// اعمال فونت فعال و بازیابی فونت آپلود شده قبل از رندر React
applyActiveFont();
restoreUploadedFontIfAny();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate><App /></AuthGate>
  </StrictMode>,
);
