import { ReactNode, CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function H1({ children, className, style, ...props }: TypographyProps) {
  return (
    <h1
      className={cn(
        "text-balance text-2xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </h1>
  );
}

export function PageTitle({ children, className, style, ...props }: TypographyProps) {
  return (
    <h1
      className={cn(
        "text-balance text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl md:text-2xl",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </h1>
  );
}

export function H2({ children, className, style, ...props }: TypographyProps) {
  return (
    <h2
      className={cn(
        "text-balance text-2xl font-semibold leading-tight tracking-tight",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </h2>
  );
}

export function H3({ children, className, style, ...props }: TypographyProps) {
  return (
    <h3
      className={cn("text-balance text-lg font-semibold leading-snug", className)}
      style={style}
      {...props}
    >
      {children}
    </h3>
  );
}

export function H4({ children, className, style, ...props }: TypographyProps) {
  return (
    <h4
      className={cn("text-balance text-base font-semibold leading-snug", className)}
      style={style}
      {...props}
    >
      {children}
    </h4>
  );
}

export function Body({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <p
      className={cn("text-pretty text-base leading-normal text-foreground", className)}
      style={style}
      {...props}
    >
      {children}
    </p>
  );
}

export function BodySmall({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <p
      className={cn(
        "text-pretty text-sm leading-normal text-muted-foreground",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </p>
  );
}

export function PageSubtitle({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <p
      className={cn(
        "text-pretty text-sm leading-relaxed text-muted-foreground",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </p>
  );
}

export function Label({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <label
      className={cn("text-sm font-medium", className)}
      style={style}
      {...props}
    >
      {children}
    </label>
  );
}

export function Caption({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <span
      className={cn(
        "text-pretty text-xs font-medium leading-[1.4] text-muted-foreground",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <h2
      className={cn(
        "text-balance text-lg font-semibold leading-snug tracking-tight text-foreground",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </h2>
  );
}

export function StatValue({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <div
      className={cn(
        "text-2xl font-semibold tabular-nums text-foreground",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function KpiValue({
  children,
  className,
  style,
  ...props
}: TypographyProps) {
  return (
    <div
      className={cn("stats-value tabular-nums text-foreground", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
