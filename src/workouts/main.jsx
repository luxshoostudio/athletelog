import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const root = document.getElementById('workout-v2-root');
if (root) createRoot(root).render(<App />);
