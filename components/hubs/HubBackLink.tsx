import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

export function HubBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="gp-pressable -ml-0.5 h-10 w-fit shrink-0 gap-1.5 px-3 font-medium text-foreground"
    >
      <Link href={href} aria-label={`Back to ${label}`}>
        <Icon name="ArrowLeft" size={IconSizes.sm} aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
