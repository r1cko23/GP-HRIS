import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/10 text-info border-info/25",
  primary: "bg-accent text-accent-foreground border-primary/20",
} as const;

export type StatusBadgeTone = keyof typeof tones;

type Props = {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
