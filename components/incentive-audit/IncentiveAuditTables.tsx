"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import {
  buildIncentiveRiskGroups,
  filterRiskGroups,
  type IncentiveRiskGroup,
  type IncentiveRiskKind,
} from "@/lib/incentive-audit/build-risk-groups";
import type {
  AuditedIncentiveRow,
  IncentiveAuditUploadRecord,
  IncentiveSheet,
} from "@/lib/incentive-audit";

function rowKey(row: AuditedIncentiveRow): string {
  return `${row.sheet}-${row.rowIndex}-${row.candidateName}`;
}

function formatExcelDate(value: string | null): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "M/d/yyyy");
  } catch {
    return value;
  }
}

function formatOptionalNumber(value: number | null): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toLocaleString();
}

function riskLabel(risk: IncentiveRiskKind): string {
  if (risk === "duplicate_and_paid") return "Duplicate + already paid";
  if (risk === "duplicate") return "Duplicate";
  return "Already paid";
}

function RiskBadges({ group }: { group: IncentiveRiskGroup }) {
  return (
    <HStack gap="1" className="flex-wrap">
      {group.isDuplicateInFile && (
        <Badge variant="destructive" className="font-normal">
          Duplicate
        </Badge>
      )}
      {group.isAlreadyReceived && (
        <Badge
          variant="outline"
          className="font-normal border-amber-300 text-amber-900"
        >
          Already paid
        </Badge>
      )}
      {group.isFuzzyMatch && (
        <Badge variant="secondary" className="font-normal">
          Fuzzy
          {group.matchScore != null
            ? ` ${Math.round(group.matchScore * 100)}%`
            : ""}
        </Badge>
      )}
    </HStack>
  );
}

function FlagBadges({ row }: { row: AuditedIncentiveRow }) {
  return (
    <HStack gap="1" className="flex-wrap">
      {row.isDuplicateInFile && (
        <Badge variant="destructive" className="font-normal">
          Duplicate
        </Badge>
      )}
      {row.isAlreadyReceived && (
        <Badge
          variant="outline"
          className="font-normal border-amber-300 text-amber-900"
        >
          Already paid
        </Badge>
      )}
      {row.isFuzzyMatch && (
        <Badge variant="secondary" className="font-normal">
          Fuzzy
          {row.matchScore != null
            ? ` ${Math.round(row.matchScore * 100)}%`
            : ""}
        </Badge>
      )}
      {!row.isDuplicateInFile && !row.isAlreadyReceived && (
        <Badge
          variant="outline"
          className="font-normal border-emerald-200 text-emerald-800"
        >
          Clean
        </Badge>
      )}
    </HStack>
  );
}

function resolvePriorUploadLabel(
  uploadId: string | null,
  uploads: IncentiveAuditUploadRecord[]
): string | null {
  if (!uploadId) return null;
  const upload = uploads.find((u) => u.id === uploadId);
  if (!upload) return "Prior upload";
  const when = format(new Date(upload.uploadedAt), "MMM d, yyyy");
  return upload.sourceFileName
    ? `${upload.sourceFileName} · ${when}`
    : when;
}

type SheetFilter = "ALL" | IncentiveSheet;
type RiskFilter = "all" | "duplicates" | "already";

interface IncentiveAuditWorkspaceProps {
  rows: AuditedIncentiveRow[];
  uploads: IncentiveAuditUploadRecord[];
}

export function IncentiveAuditWorkspace({
  rows,
  uploads,
}: IncentiveAuditWorkspaceProps) {
  const [mapQuery, setMapQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [browseAll, setBrowseAll] = useState(false);
  const [evidenceSheet, setEvidenceSheet] = useState<SheetFilter>("ALL");
  const [evidenceQuery, setEvidenceQuery] = useState("");

  const groups = useMemo(() => buildIncentiveRiskGroups(rows), [rows]);
  const filteredGroups = useMemo(
    () =>
      filterRiskGroups(groups, {
        query: mapQuery,
        riskFilter,
      }),
    [groups, mapQuery, riskFilter]
  );

  const selectedGroup =
    groups.find((g) => g.id === selectedGroupId) ?? null;

  useEffect(() => {
    setSelectedGroupId(null);
    setBrowseAll(false);
    setMapQuery("");
    setRiskFilter("all");
    setEvidenceQuery("");
    setEvidenceSheet("ALL");
  }, [rows]);

  const evidenceRows = useMemo(() => {
    const source = browseAll
      ? rows
      : selectedGroup
        ? selectedGroup.rows
        : [];

    const inSheet = source.filter(
      (row) => evidenceSheet === "ALL" || row.sheet === evidenceSheet
    );
    const q = evidenceQuery.trim().toLowerCase();
    if (!q) {
      return [...inSheet].sort((a, b) => {
        if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
        return a.rowIndex - b.rowIndex;
      });
    }
    return inSheet
      .filter((row) => {
        const haystack = [
          row.candidateName,
          row.branchClient,
          row.recruiter,
          row.position,
          row.status,
          row.matchedName,
          row.sheet,
          ...row.duplicatePeers,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        if (a.normalizedName !== b.normalizedName) {
          return a.normalizedName.localeCompare(b.normalizedName);
        }
        if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
        return a.rowIndex - b.rowIndex;
      });
  }, [browseAll, selectedGroup, rows, evidenceSheet, evidenceQuery]);

  const availableSheets = useMemo(() => {
    const source = browseAll
      ? rows
      : selectedGroup
        ? selectedGroup.rows
        : rows;
    const set = new Set(source.map((r) => r.sheet));
    return (["NON-HOTEL", "HOTEL"] as IncentiveSheet[]).filter((s) =>
      set.has(s)
    );
  }, [browseAll, selectedGroup, rows]);

  function openGroup(group: IncentiveRiskGroup) {
    setSelectedGroupId(group.id);
    setBrowseAll(false);
    setEvidenceQuery("");
    setEvidenceSheet("ALL");
  }

  function openBrowseAll() {
    setBrowseAll(true);
    setSelectedGroupId(null);
    setEvidenceQuery(mapQuery.trim());
    setEvidenceSheet("ALL");
  }

  function clearEvidence() {
    setSelectedGroupId(null);
    setBrowseAll(false);
    setEvidenceQuery("");
    setEvidenceSheet("ALL");
  }

  const showEvidence = Boolean(selectedGroup) || browseAll;

  return (
    <div className="space-y-4">
      <CardSection
        title="Risk map"
        description={
          groups.length > 0
            ? `${groups.length} risk group${groups.length === 1 ? "" : "s"} — click one to open Excel evidence`
            : "No duplicates or prior payouts in this upload"
        }
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 max-w-md">
            <Icon
              name="MagnifyingGlass"
              size={IconSizes.sm}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              placeholder="Search people, branches, recruiters…"
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              className="pl-9"
              aria-label="Search risk groups"
            />
          </div>
          <Select
            value={riskFilter}
            onValueChange={(v) => setRiskFilter(v as RiskFilter)}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter risk type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              <SelectItem value="duplicates">Duplicates only</SelectItem>
              <SelectItem value="already">Already paid only</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={openBrowseAll}>
            Browse full Excel
          </Button>
          {(mapQuery || riskFilter !== "all") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setMapQuery("");
                setRiskFilter("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/20">
            <BodySmall className="text-muted-foreground">
              This file looks clean — no duplicate or already-paid groups.
            </BodySmall>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/20">
            <BodySmall className="text-muted-foreground">
              No risk groups match “{mapQuery.trim() || riskFilter}”.
            </BodySmall>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Candidate</TableHead>
                  <TableHead className="text-right">Occurrences</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Sheets</TableHead>
                  <TableHead>Statuses</TableHead>
                  <TableHead className="text-right">Incentive Σ</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Prior match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.map((group) => {
                  const selected = selectedGroupId === group.id;
                  const priorFile = resolvePriorUploadLabel(
                    group.matchedUploadId,
                    uploads
                  );
                  return (
                    <TableRow
                      key={group.id}
                      className={cn(
                        "cursor-pointer",
                        selected
                          ? "bg-emerald-50/80"
                          : "hover:bg-muted/30"
                      )}
                      onClick={() => openGroup(group)}
                    >
                      <TableCell className="font-medium text-sm whitespace-nowrap">
                        {group.displayName}
                        <Caption className="block text-muted-foreground">
                          {riskLabel(group.risk)}
                        </Caption>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            group.occurrenceCount > 1
                              ? "destructive"
                              : "secondary"
                          }
                          className="font-normal tabular-nums"
                        >
                          {group.occurrenceCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Caption className="max-w-[220px] block">
                          {group.branches.length
                            ? group.branches.join(" · ")
                            : "—"}
                        </Caption>
                      </TableCell>
                      <TableCell>
                        <Caption className="whitespace-nowrap">
                          {group.sheets.join(" · ") || "—"}
                        </Caption>
                      </TableCell>
                      <TableCell>
                        <Caption className="max-w-[140px] truncate block">
                          {group.statuses.join(" · ") || "—"}
                        </Caption>
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {formatCurrency(group.incentiveTotal)}
                      </TableCell>
                      <TableCell>
                        <RiskBadges group={group} />
                      </TableCell>
                      <TableCell>
                        {group.matchedName ? (
                          <Caption className="max-w-[200px] block text-amber-900">
                            {group.matchedName}
                            {priorFile ? (
                              <span className="block text-muted-foreground">
                                {priorFile}
                              </span>
                            ) : null}
                          </Caption>
                        ) : (
                          <Caption>—</Caption>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardSection>

      {showEvidence && (
        <CardSection
          title={
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {browseAll
                  ? "Excel evidence — full file"
                  : `Excel evidence — ${selectedGroup?.displayName ?? ""}`}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={clearEvidence}>
                <Icon name="ArrowLeft" size={IconSizes.sm} />
                Back to risk map
              </Button>
            </div>
          }
          description={
            browseAll
              ? "Full spreadsheet view for this upload"
              : `${evidenceRows.length} Excel row${evidenceRows.length === 1 ? "" : "s"} proving the flagged group`
          }
        >
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <HStack gap="2" align="center" className="shrink-0">
              <Caption className="text-muted-foreground whitespace-nowrap">
                Sheet:
              </Caption>
              <Select
                value={evidenceSheet}
                onValueChange={(v) => setEvidenceSheet(v as SheetFilter)}
              >
                <SelectTrigger className="w-[160px]" aria-label="Filter evidence by sheet">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All sheets</SelectItem>
                  {availableSheets.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </HStack>
            <div className="relative min-w-0 flex-1">
              <Icon
                name="MagnifyingGlass"
                size={IconSizes.sm}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Filter Excel rows…"
                value={evidenceQuery}
                onChange={(e) => setEvidenceQuery(e.target.value)}
                className="pl-9"
                aria-label="Filter Excel evidence rows"
              />
            </div>
            <Caption className="text-muted-foreground shrink-0">
              {evidenceRows.length} row{evidenceRows.length === 1 ? "" : "s"}
            </Caption>
          </div>

          {evidenceRows.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed bg-muted/20">
              <BodySmall className="text-muted-foreground">
                No Excel rows in this evidence view.
              </BodySmall>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="sticky left-0 z-20 bg-muted/40 whitespace-nowrap">
                      #
                    </TableHead>
                    <TableHead className="sticky left-10 z-20 bg-muted/40 whitespace-nowrap">
                      Candidate
                    </TableHead>
                    <TableHead className="sticky left-[13.5rem] z-20 bg-muted/40 whitespace-nowrap min-w-[140px]">
                      Branch / client
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Sheet</TableHead>
                    <TableHead className="whitespace-nowrap">Industry</TableHead>
                    <TableHead className="whitespace-nowrap">Position</TableHead>
                    <TableHead className="whitespace-nowrap">Recruiter</TableHead>
                    <TableHead className="whitespace-nowrap">Endorsement</TableHead>
                    <TableHead className="whitespace-nowrap">Deployment</TableHead>
                    <TableHead className="whitespace-nowrap">HRIS verification</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Total hours
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Total days
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Incentive
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Notes</TableHead>
                    <TableHead className="whitespace-nowrap">Flags</TableHead>
                    <TableHead className="whitespace-nowrap">Prior upload match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidenceRows.map((row) => {
                    const priorFile = resolvePriorUploadLabel(
                      row.matchedUploadId,
                      uploads
                    );
                    return (
                      <TableRow
                        key={rowKey(row)}
                        className={
                          row.isDuplicateInFile || row.isAlreadyReceived
                            ? "bg-destructive/[0.04]"
                            : undefined
                        }
                      >
                        <TableCell className="sticky left-0 z-10 bg-background text-muted-foreground text-sm tabular-nums">
                          {row.rowIndex}
                        </TableCell>
                        <TableCell className="sticky left-10 z-10 bg-background font-medium text-sm whitespace-nowrap">
                          {row.candidateName}
                        </TableCell>
                        <TableCell className="sticky left-[13.5rem] z-10 bg-background min-w-[140px]">
                          <Caption className="max-w-[180px] truncate block">
                            {row.branchClient ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="whitespace-nowrap">{row.sheet}</Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="max-w-[120px] truncate block">
                            {row.industry ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="max-w-[140px] truncate block">
                            {row.position ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="max-w-[140px] truncate block">
                            {row.recruiter ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="whitespace-nowrap">
                            {formatExcelDate(row.endorsementDate)}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="whitespace-nowrap">
                            {formatExcelDate(row.deploymentDate)}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="max-w-[140px] truncate block">
                            {row.hrisVerification ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <Caption className="whitespace-nowrap">
                            {row.status ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatOptionalNumber(row.totalHours)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {formatOptionalNumber(row.totalDays)}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {formatCurrency(row.incentiveAmount)}
                        </TableCell>
                        <TableCell>
                          <Caption className="max-w-[160px] truncate block">
                            {row.notes ?? "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>
                          <FlagBadges row={row} />
                        </TableCell>
                        <TableCell>
                          {row.isAlreadyReceived && row.matchedName ? (
                            <Caption className="max-w-[220px] block text-amber-900">
                              {row.matchedName}
                              {row.isFuzzyMatch && row.matchScore != null
                                ? ` (${Math.round(row.matchScore * 100)}%)`
                                : ""}
                              {priorFile ? (
                                <span className="block text-muted-foreground">
                                  {priorFile}
                                </span>
                              ) : null}
                            </Caption>
                          ) : (
                            <Caption>—</Caption>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardSection>
      )}
    </div>
  );
}

interface IncentiveAuditUploadHistoryProps {
  uploads: IncentiveAuditUploadRecord[];
  loading: boolean;
  selectedId: string | null;
  deletingId: string | null;
  clearingAll: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
}

export function IncentiveAuditUploadHistory({
  uploads,
  loading,
  selectedId,
  deletingId,
  clearingAll,
  onSelect,
  onRefresh,
  onClearAll,
  onDelete,
}: IncentiveAuditUploadHistoryProps) {
  return (
    <CardSection
      title={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>Upload history</span>
          <HStack gap="2">
            {uploads.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onClearAll}
                disabled={loading || clearingAll}
              >
                <Icon name="Trash" size={IconSizes.sm} />
                Clear all
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              Refresh
            </Button>
          </HStack>
        </div>
      }
      description="Future uploads compare against prior APPROVED incentives with amount &gt; 0."
      className="overflow-hidden"
    >
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <BodySmall>Loading uploads…</BodySmall>
        </div>
      ) : uploads.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/20">
          <BodySmall className="text-muted-foreground">
            No incentive verification uploads yet.
          </BodySmall>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Uploaded</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Candidates</TableHead>
                <TableHead className="text-right">Duplicates</TableHead>
                <TableHead className="text-right">Already paid</TableHead>
                <TableHead className="text-right">Incentive Σ</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((row) => {
                const selected = selectedId === row.id;
                return (
                  <TableRow
                    key={row.id}
                    className={
                      selected
                        ? "bg-emerald-50/80 cursor-pointer"
                        : "cursor-pointer hover:bg-muted/30"
                    }
                    onClick={() => onSelect(row.id)}
                  >
                    <TableCell>
                      <Caption>
                        {format(new Date(row.uploadedAt), "MMM d, yyyy h:mm a")}
                      </Caption>
                    </TableCell>
                    <TableCell>
                      <Caption className="max-w-[180px] truncate block">
                        {row.sourceFileName ?? "—"}
                      </Caption>
                    </TableCell>
                    <TableCell className="text-right">{row.totalCandidates}</TableCell>
                    <TableCell className="text-right">
                      {row.duplicateCount > 0 ? (
                        <Badge variant="destructive" className="font-normal">
                          {row.duplicateCount}
                        </Badge>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.alreadyReceivedCount > 0 ? (
                        <Badge
                          variant="outline"
                          className="font-normal border-amber-300 text-amber-900"
                        >
                          {row.alreadyReceivedCount}
                        </Badge>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(row.totalIncentiveAmount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === row.id || clearingAll}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(row.id);
                        }}
                        aria-label={`Remove upload ${row.sourceFileName ?? ""}`}
                      >
                        <Icon name="Trash" size={IconSizes.sm} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </CardSection>
  );
}
