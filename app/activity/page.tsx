"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { BodySmall } from "@/components/ui/typography";
import { VStack } from "@/components/ui/stack";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";

export default function ActivityPage() {
  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        <DashboardPageHeader
          title="Activity"
          description="Coming soon: consolidated time and location activity feed."
        />
        <CardSection>
          <BodySmall>
            This page will show activity logs (time, location) without affecting
            approval routes.
          </BodySmall>
        </CardSection>
      </VStack>
    </DashboardLayout>
  );
}