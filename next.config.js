/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
    ],
    optimizePackageImports: [
      "lucide-react",
      "phosphor-react",
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "date-fns",
      "recharts",
    ],
  },
  outputFileTracingIncludes: {
    "/api/payroll/summary-audit/upload": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals ?? []),
        "pdf-parse",
        "pdfjs-dist",
        "@napi-rs/canvas",
      ];
    }
    return config;
  },
  async redirects() {
    return [
      { source: "/directory", destination: "/people", permanent: true },
      { source: "/directory/:path*", destination: "/people/:path*", permanent: true },
      { source: "/loans", destination: "/benefits/loans", permanent: true },
      { source: "/allowances", destination: "/benefits/allowances", permanent: true },
      { source: "/deductions", destination: "/benefits/deductions", permanent: true },
      { source: "/payslips", destination: "/payroll/payslips", permanent: true },
      { source: "/payslips/:path*", destination: "/payroll/payslips/:path*", permanent: true },
      { source: "/timesheet", destination: "/time/attendance", permanent: true },
      { source: "/time-entries", destination: "/time/entries", permanent: true },
      { source: "/leave-approval", destination: "/time/leave", permanent: true },
      { source: "/overtime-approval", destination: "/time/overtime", permanent: true },
      { source: "/failure-to-log-approval", destination: "/time/failure-to-log", permanent: true },
      { source: "/schedules", destination: "/time/schedules", permanent: true },
      { source: "/employees", destination: "/time/enrollment", permanent: true },
      { source: "/employees/:path*", destination: "/time/enrollment/:path*", permanent: true },
      { source: "/dashboard", destination: "/reports", permanent: false },
      { source: "/bir-reports", destination: "/reports/bir", permanent: true },
      { source: "/audit", destination: "/reports/audit", permanent: true },
      { source: "/device-activity", destination: "/reports/devices", permanent: true },
      { source: "/payroll-audit", destination: "/reports/payroll-audit", permanent: true },
      { source: "/incentive-audit", destination: "/reports/incentive-audit", permanent: true },
      { source: "/clock", destination: "/time/entries", permanent: true },
      { source: "/activity", destination: "/time/entries", permanent: true },
    ];
  },
};

module.exports = nextConfig;