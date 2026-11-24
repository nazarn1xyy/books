import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initServices } from '@/shared/services'

// After a deploy the old hashed chunks are gone: a tab (or PWA) opened before it fails every lazy
// import. Reload once to pick up the new build instead of running half-broken.
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem('libify.chunk-reload')) return;
  sessionStorage.setItem('libify.chunk-reload', '1');
  event.preventDefault();
  window.location.reload();
});
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('libify.chunk-reload'), 10_000));

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
