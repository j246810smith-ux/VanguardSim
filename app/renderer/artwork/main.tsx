import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/orbitron/700.css';
import '../styles.css';
import { ArtworkApp } from './ArtworkApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ArtworkApp />
  </StrictMode>,
);
