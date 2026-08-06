# Green Pasture UI — reference

## Apps

- `/Users/ecko/Desktop/CSM-GP`
- `/Users/ecko/Desktop/Green Pasture/GP-HRIS`
- `/Users/ecko/Desktop/Green Pasture/GP-Client-Attendance-Payroll`

## Required `:root` HSL channels

Copy these verbatim (space-separated HSL **without** `hsl()` wrapper):

```css
--background: 40 20% 98%;
--foreground: 216 28% 14%;
--card: 0 0% 100%;
--card-foreground: 216 28% 14%;
--popover: 0 0% 100%;
--popover-foreground: 216 28% 14%;

--primary: 147 66% 33%;
--primary-foreground: 0 0% 100%;
--secondary: 40 14% 93%;
--secondary-foreground: 216 28% 18%;
--muted: 40 12% 94%;
--muted-foreground: 216 12% 42%;
--accent: 146 40% 93%;
--accent-secondary: 146 55% 38%;
--accent-foreground: 148 32% 25%;
--destructive: 0 65% 48%;
--destructive-foreground: 0 0% 100%;
--success: 152 45% 32%;
--success-foreground: 0 0% 100%;
--warning: 38 92% 42%;
--warning-foreground: 216 28% 14%;
--info: 205 65% 38%;
--info-foreground: 0 0% 100%;

--border: 40 10% 86%;
--input: 40 10% 86%;
--ring: 147 66% 33%;

--sidebar: 148 42% 16%;
--sidebar-foreground: 146 30% 94%;
--sidebar-muted: 146 18% 62%;
--sidebar-border: 148 32% 22%;
--sidebar-divider: 148 28% 20%;
--sidebar-active: 148 36% 22%;
--sidebar-accent: 147 66% 45%;

--radius-sm: 0.375rem;
--radius-md: 0.5rem;
--radius-lg: 0.625rem;

--shadow-card: 0 1px 2px rgba(20, 32, 48, 0.06), 0 1px 3px rgba(20, 32, 48, 0.04);
--shadow-hover: 0 2px 8px rgba(20, 32, 48, 0.08);
```

Usage in CSS: `hsl(var(--primary))`. In Tailwind: `bg-primary`, `text-muted-foreground`, etc.

## Font bootstrap (Next.js)

```tsx
import { Source_Sans_3 } from "next/font/google";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans", // or "--font-sans" if theme expects that
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// <html className={sourceSans.variable}>
// <body className="font-sans antialiased">
```

## Component recipes

### Card

```tsx
<div className="rounded-md border border-border bg-card text-card-foreground shadow-card p-5">
```

### Primary / secondary button

```tsx
<button className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:min-h-10">
<button className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted sm:min-h-10">
```

### Page title

```tsx
<h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl md:text-2xl">
<p className="text-sm text-muted-foreground">
```

### Form field

```tsx
<label className="block text-sm font-medium text-foreground">
<input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring/25" />
```

## GP-Client legacy aliases

| Utility | Maps to |
|---------|---------|
| `bg-gp` / `text-gp` | primary |
| `bg-gp-hover` | darker primary |
| `bg-gp-soft` / `bg-gp-muted` | accent / muted |
| `text-gp-muted-text` | muted-foreground |
| `border-gp-border` | border |

Prefer semantic names on new code; keep aliases for existing pages.

## Do not

- Purple-on-white / indigo gradient themes
- Warm cream + terracotta “AI brochure” look
- Flat `#fafcfb` mint replacing warm `--background`
- Plus Jakarta / Inter as primary UI font
- `rounded-2xl` + heavy multi-layer shadows on every card
