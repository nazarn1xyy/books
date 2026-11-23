import { BrowserRouter } from 'react-router-dom';
import { useTheme } from '@/shared/theme/useTheme';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { AppProviders } from './providers';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { AppRoutes } from './router';

function App() {
  // Keeps <html data-theme> in sync with the stored choice and the system setting on every page.
  useTheme();
  return (
    <ErrorBoundary>
      <AppProviders>
        <BrowserRouter>
          <AppRoutes />
          <UpdatePrompt />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
