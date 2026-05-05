import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-serif/latin-400.css';
import '@fontsource/ibm-plex-serif/latin-400-italic.css';
import '@fontsource/ibm-plex-serif/latin-500.css';
import '@fontsource/ibm-plex-serif/latin-600.css';
import '@fontsource/ibm-plex-serif/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import './styles/global.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
