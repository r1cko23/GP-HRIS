import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

export function HubBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="gp-pressable -ml-0.5 h-9 w-fit gap-1.5 self-start px-3 font-medium text-foreground sm:h-9"
    >
      <Link href={href} aria-label={`Back to ${label}`}>
        <Icon name="ArrowLeft" size={IconSizes.sm} aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
