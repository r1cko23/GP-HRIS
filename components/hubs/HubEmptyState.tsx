import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  title: string;
  detail?: string;
  action?: ReactNode;
};

export function HubEmptyState({ title, detail, action }: Props) {
  return <EmptyState title={title} detail={detail} action={action} />;
}
