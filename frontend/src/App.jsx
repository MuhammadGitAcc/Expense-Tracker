import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from '@/routes/AppRoutes';
import { RouteMeta } from '@/routes/RouteMeta';
import { useSessionBootstrap } from '@/features/auth/useSessionBootstrap';

export default function App() {
  useSessionBootstrap();

  return (
    <BrowserRouter>
      <RouteMeta />
      <AppRoutes />
    </BrowserRouter>
  );
}
