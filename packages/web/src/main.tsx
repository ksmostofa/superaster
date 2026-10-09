import React from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource-variable/figtree';
import './theme.css';
import './style.css';
import {App} from './App.js';
document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
if('serviceWorker' in navigator&&!import.meta.env.DEV)void navigator.serviceWorker.register('/sw.js').catch(error=>{console.error('Offline app setup failed',error);});
