import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { MobileBottomNav } from '@/layouts/MobileBottomNav';
import { MobileMenu } from '@/layouts/MobileMenu';
import { Sidebar } from '@/layouts/Sidebar';
import { Topbar } from '@/layouts/Topbar';

/**
 * The shell of every private page: sidebar (tablet/desktop), topbar, content,
 * bottom bar + slide-over menu (phone). A lazy page shows its own spinner inside the content
 * area, so the sidebar and topbar stay on screen.
 */
export default function MainLayout() {
  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* pb-28: room for the bottom bar and the floating "Add" button on phones */}
        <main className="flex-1 p-4 pb-28 md:p-6 md:pb-6">
          <Suspense fallback={<LoadingScreen fullScreen={false} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <MobileBottomNav />
      <MobileMenu />
    </div>
  );
}
