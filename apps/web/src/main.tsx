import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../styles/tokens.css'; // fonte única da paleta oficial Kanto Dark
import './styles/global.css';
import { App } from './app/App';
import { PlayApp } from './play/PlayApp';
import { RegionsPreview } from './regions/RegionsPreview';

const target = document.getElementById('root');
if (!target) throw new Error('Raiz React indisponível');
createRoot(target).render(
  <React.StrictMode>
    {window.location.pathname === '/regions' || window.location.pathname === '/regions/'
      ? <RegionsPreview />
      : window.location.pathname === '/play' || window.location.pathname === '/play/'
        ? <PlayApp /> : <App />}
  </React.StrictMode>
);
