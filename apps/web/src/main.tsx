import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initServices } from './shared/services'

// When a new service worker takes control (after update), reload once to
// prevent stale chunk errors that show the ErrorBoundary on first button click.
if ('serviceWorker' in navigator) {
  let swReloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swReloading) return;
    swReloading = true;
    window.location.reload();
  });
}

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
