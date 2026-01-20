import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SolanaProvider } from './providers/SolanaProvider';
import App from './App';
import './App.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaProvider>
      <App />
    </SolanaProvider>
  </StrictMode>
);
