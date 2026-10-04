import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    {/* Outermost, so it catches a crash in the store or the board as well as in a control. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
