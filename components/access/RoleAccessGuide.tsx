"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { ROLE_PROFILES, getHandoffChecklist } from "@/lib/access-matrix";
import { AccessLevelBadge } from "./AccessLevelBadge";
import { formatRoleLabel } from "@/lib/format-role-label";

/** Compare role templates and handoff tips (Settings → App access). */
export function RoleAccessGuide() {
  const [selectedRole, setSelectedRole] = useState(ROLE_PROFILES[1]?.role ?? "head_of_hr");
  const profile = ROLE_PROFILES.find((p) => p.role === selectedRole) ?? ROLE_PROFILES[0];
  const checklist = getHandoffChecklist(selectedRole);

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon name="BookOpen" size={IconSizes.md} className="text-primary" />
            Role guide
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Pick a role to see what people usually can do. When someone resigns, create the new account,
            use <strong className="text-foreground">Copy access from</strong>, then deactivate the old login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger aria-label="Select role to preview">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_PROFILES.map((p) => (
                  <SelectItem key={p.role} value={p.role}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div>
              <p className="font-medium text-foreground">{profile.title}</p>
              <Caption className="mt-1 block text-muted-foreground leading-relaxed">
                {profile.summary}
              </Caption>
            </div>
            <Caption className="block">
              <span className="font-medium text-foreground">Best for: </span>
              {profile.bestFor}
            </Caption>
            <Caption className="block rounded-md bg-muted/60 px-3 py-2 text-foreground/90">
              <span className="font-medium">Handoff: </span>
              {profile.handoffTip}
            </Caption>
            <Caption className="block">
              <span className="font-medium text-foreground">Pay info: </span>
              {profile.salaryAccessDefault === "always"
                ? "Always on (Admin)"
                : profile.salaryAccessDefault
                  ? "Usually on"
                  : "Off by default — turn on in Team members if needed"}
            </Caption>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">What this role can do</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Area</th>
                    <th className="px-3 py-2 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5 align-top">
                        <span className="font-medium text-foreground">{row.area}</span>
                        <Caption className="block text-muted-foreground">{row.description}</Caption>
                        {row.note ? (
                          <Caption className="mt-0.5 block text-amber-800 dark:text-amber-200">
                            {row.note}
                          </Caption>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <AccessLevelBadge level={row.level} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground mb-2">Replacement checklist</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
              {checklist.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <details className="group rounded-lg border border-border bg-muted/20 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
          <span>Compare all roles (quick table)</span>
          <Icon
            name="CaretDown"
            size={IconSizes.sm}
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <CardContent className="border-t border-border pt-3 pb-4 px-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="px-2 py-1 text-left font-medium">Role</th>
                <th className="px-2 py-1 text-left font-medium">Employees</th>
                <th className="px-2 py-1 text-left font-medium">Payroll</th>
                <th className="px-2 py-1 text-left font-medium">Approvals</th>
                <th className="px-2 py-1 text-left font-medium">Admin tools</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_PROFILES.map((p) => {
                const emp = p.rows.find((r) => r.id === "emp" || r.id === "dash");
                const pay = p.rows.find((r) => r.id === "pay");
                const appr = p.rows.find(
                  (r) =>
                    r.id === "leave_mgr" ||
                    r.id === "leave_hr" ||
                    r.id === "ot" ||
                    r.id === "leave_mgr"
                );
                const admin = p.rows.find((r) => r.id === "admin_mod");
                return (
                  <tr key={p.role} className="border-t border-border/50">
                    <td className="px-2 py-2 font-medium">{formatRoleLabel(p.role)}</td>
                    <td className="px-2 py-2">
                      {emp ? <AccessLevelBadge level={emp.level} /> : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {pay ? <AccessLevelBadge level={pay.level} /> : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {appr ? <AccessLevelBadge level={appr.level} /> : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {admin ? <AccessLevelBadge level={admin.level} /> : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </details>
    </div>
  );
}
