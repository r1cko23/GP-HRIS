'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserRole } from '@/lib/hooks/useUserRole';
import HRDashboard from '@/app/dashboard/HRDashboard';
import AdminDashboard from '@/app/dashboard/AdminDashboard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Icon, IconSizes } from '@/components/ui/phosphor-icon';
import Link from 'next/link';
import { cn } from '@/lib/utils';

function ReportsOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isRestrictedAccess, loading } = useUserRole();
  const [dashboardType, setDashboardType] = useState<'executive' | 'workforce'>('executive');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!loading && isRestrictedAccess) {
      router.push('/time');
    }
  }, [loading, isRestrictedAccess, router]);

  useEffect(() => {
    if (loading || initialized) return;

    const type = searchParams.get('type');
    if (type === 'workforce' || type === 'executive') {
      setDashboardType(type);
      setInitialized(true);
    } else if (isAdmin) {
      setDashboardType('executive');
      router.replace('/reports?type=executive');
      setInitialized(true);
    } else {
      setDashboardType('workforce');
      router.replace('/reports?type=workforce');
      setInitialized(true);
    }
  }, [searchParams, isAdmin, loading, initialized, router]);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'workforce' || type === 'executive') {
      setDashboardType(type);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (isRestrictedAccess) {
    return null;
  }

  if (isAdmin) {
    return (
      <DashboardLayout>
        <div className="mb-4 flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1">
          <Link
            href="/reports?type=executive"
            aria-current={dashboardType === "executive" ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium sm:min-h-10",
              dashboardType === "executive"
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            Executive
          </Link>
          <Link
            href="/reports?type=workforce"
            aria-current={dashboardType === "workforce" ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium sm:min-h-10",
              dashboardType === "workforce"
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            Workforce
          </Link>
        </div>
        {dashboardType === 'executive' ? <AdminDashboard /> : <HRDashboard />}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <HRDashboard />
    </DashboardLayout>
  );
}

const LoadingFallback = () => (
  <DashboardLayout>
    <div className="flex h-64 items-center justify-center">
      <Icon
        name="ArrowsClockwise"
        size={IconSizes.lg}
        className="animate-spin text-muted-foreground"
      />
    </div>
  </DashboardLayout>
);

export default function ReportsOverviewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReportsOverviewContent />
    </Suspense>
  );
}
