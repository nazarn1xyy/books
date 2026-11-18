import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { AppProviders } from './providers';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { AppRoutes } from './router';

function App() {
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
