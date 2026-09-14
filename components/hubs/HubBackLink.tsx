import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HubBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="gp-pressable -ml-2 h-8 px-2 text-muted-foreground hover:text-foreground"
    >
      <Link href={href}>← {label}</Link>
    </Button>
  );
}
