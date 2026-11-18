import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initServices } from '@/shared/services'

const container = document.getElementById('root')!;

initServices()
  .then(() => {
    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    console.error('Failed to start Libify', err);
    container.textContent = 'Libify could not open local storage. Disable private mode or free up space and reload.';
  });
