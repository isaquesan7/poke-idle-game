import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../styles/tokens.css'; // fonte única da paleta oficial Kanto Dark
import './styles/global.css';
import { App } from './app/App';

const target = document.getElementById('root');
if (!target) throw new Error('Raiz React indisponível');
createRoot(target).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
