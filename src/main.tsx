import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <StrictMode>
    {/* 最外層的保險：沒有這層的話，任一元件 render 出錯就是整片白畫面 */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
