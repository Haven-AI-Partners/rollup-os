import { Building2, TrendingUp, Shield, BarChart3 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/10">
              <Building2 className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Rollup OS
            </span>
          </div>
        </div>

        <div className="space-y-8">
          <h1 className="text-4xl font-bold leading-tight">
            M&A Deal Flow
            <br />
            Analysis & Automation
          </h1>
          <p className="text-lg text-primary-foreground/70 max-w-md">
            Manage your rollup acquisitions across multiple portfolio companies
            with a unified deal pipeline.
          </p>

          <div className="grid gap-4 pt-4">
            <FeatureItem
              icon={<TrendingUp className="h-5 w-5" />}
              title="Deal Pipeline Management"
              description="Track every deal from sourcing through close with customizable stages."
            />
            <FeatureItem
              icon={<BarChart3 className="h-5 w-5" />}
              title="Portfolio Analytics"
              description="Unified KPI tracking and financial analysis across all PortCos."
            />
            <FeatureItem
              icon={<Shield className="h-5 w-5" />}
              title="Role-Based Access"
              description="Granular permissions for owners, admins, analysts, and viewers."
            />
          </div>
        </div>

        <p className="text-sm text-primary-foreground/40">
          &copy; {new Date().getFullYear()} Rollup OS. All rights reserved.
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="lg:hidden mb-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">Rollup OS</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-primary-foreground/60">{description}</p>
      </div>
    </div>
  );
}
