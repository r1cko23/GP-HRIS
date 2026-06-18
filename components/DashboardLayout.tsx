'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export function DashboardLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex min-h-screen overflow-x-clip bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:rounded-md focus:border"
      >
        Skip to main content
      </a>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
      {/* Desktop Sidebar - Always render, only hide on mobile */}
      <aside
        className="hidden lg:flex lg:flex-shrink-0"
        style={{
          position: 'relative',
          zIndex: 10,
          minWidth: '256px',
          width: '256px'
        }}
        aria-label="Primary navigation"
      >
        <Sidebar />
      </aside>
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation menu">
          <div className="absolute inset-0 bg-foreground/40" aria-hidden="true" onClick={closeSidebar} />
          <Sidebar
            className="relative z-50 w-80 max-w-full shadow-lg"
            onClose={closeSidebar}
          />
        </div>
      )}
      <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', 'lg:ml-0')}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden bg-background"
          tabIndex={-1}
        >
          <div
            className={cn(
              "dashboard-content container mx-auto w-full min-w-0 px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6",
              wide ? "max-w-none" : "max-w-7xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}