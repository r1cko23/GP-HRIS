import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  candidateStageLabel,
  type CandidateStage,
} from "@/lib/talent/candidates";

const VARIANT: Record<CandidateStage, BadgeProps["variant"]> = {
  prospect: "outline",
  applicant: "secondary",
  screening: "warning",
  submitted: "warning",
  selected: "success",
  placed: "default",
  withdrawn: "outline",
  rejected: "destructive",
  archived: "outline",
};

export function CandidateStageBadge({ stage }: { stage: CandidateStage }) {
  return (
    <Badge variant={VARIANT[stage]}>{candidateStageLabel(stage)}</Badge>
  );
}
