import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Green Pasture People Management Inc. - Payroll System",
  description:
    "Complete payroll management system with bi-monthly timesheet tracking",
  icons: {
    icon: "/GP_favicon.webp",
    shortcut: "/GP_favicon.webp",
    apple: "/GP_favicon.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
