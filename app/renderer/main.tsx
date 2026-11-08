import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// OFL fonts bundled locally so the app works offline (D-019)
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/orbitron/600.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/orbitron/800.css';
import '@fontsource/orbitron/900.css';
import './styles.css';
import { App } from './App';
import { CrashGuard } from './ui/CrashGuard';
import { runStartMigrations } from './migrations';
import { IS_ANDROID } from './platform';
import { resolveArtFolder } from './android/native';

// before anything loads decks or settings
runStartMigrations();

const start = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CrashGuard>
        <App />
      </CrashGuard>
    </StrictMode>,
  );

// Android: find the phone folder with the card art first (a card that fails to load keeps its
// plain face), but never wait more than a moment for it
if (IS_ANDROID)
  void Promise.race([resolveArtFolder(), new Promise((r) => setTimeout(r, 1500))]).finally(start);
else start();
