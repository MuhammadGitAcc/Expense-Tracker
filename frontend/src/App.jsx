import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from '@/routes/AppRoutes';
import { useSessionBootstrap } from '@/features/auth/useSessionBootstrap';

export default function App() {
  useSessionBootstrap();

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
