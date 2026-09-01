"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CardSection } from "@/components/ui/card-section";
import { H3, BodySmall, Caption } from "@/components/ui/typography";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Skeleton, SkeletonCard, SkeletonForm } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatPHTime } from "@/utils/format";
import {
  epFormField,
  epFormGrid,
  epFormStack,
  epNativeSelect,
  epPageWrapper,
} from "@/lib/employee-portal-ui";
import {
  epRequestHistoryList,
  epRequestStatusBadgeApproved,
  epRequestStatusBadgeCancelled,
  epRequestStatusBadgePending,
  epRequestStatusBadgeRejected,
  ftlEntryTypeLabel,
} from "@/lib/employee-portal-request-history";
import {
  RequestHistoryCard,
  RequestHistoryReasonRow,
  RequestHistoryTimeRow,
} from "@/components/employee-portal/RequestHistoryCard";
import { cn } from "@/lib/utils";

interface EmployeeSession {
  id: string;
  employee_id: string;
  full_name: string;
}

interface FailureToLog {
  id: string;
  time_entry_id: string | null;
  missed_date: string | null;
  actual_clock_in_time: string | null;
  actual_clock_out_time: string | null;
  entry_type: "in" | "out" | "both";
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  rejection_reason: string | null;
  created_at: string;
  time_clock_entries?: {
    clock_in_time: string;
    clock_out_time: string | null;
  };
}

export default function FailureToLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [requests, setRequests] = useState<FailureToLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Form state
  const [entryType, setEntryType] = useState<"in" | "out" | "both">("out");
  const [missedDate, setMissedDate] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [selectedTimeEntryId, setSelectedTimeEntryId] = useState("");

  useEffect(() => {
    const sessionData = localStorage.getItem("employee_session");
    if (!sessionData) {
      router.push("/employee-login");
      return;
    }

    const emp = JSON.parse(sessionData) as EmployeeSession;
    setEmployee(emp);
    fetchFailureToLogRequests(emp.id);
    fetchTimeEntries(emp.id);
  }, [router]);

  async function fetchTimeEntries(employeeId: string) {
    const { data, error } = await supabase
      .from("time_clock_entries")
      .select("id, clock_in_time, clock_out_time, status")
      .eq("employee_id", employeeId)
      .order("clock_in_time", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching time entries:", error);
    } else {
      setTimeEntries(data || []);
    }
  }

  async function fetchFailureToLogRequests(employeeId: string) {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_failure_to_log_requests", {
      p_employee_uuid: employeeId,
    } as any);

    if (error) {
      console.error("Error fetching failure to log requests via RPC:", error);
      toast.error("Failed to load requests");
      setRequests([]);
    } else {
      setRequests((Array.isArray(data) ? data : []) as FailureToLog[]);
    }
    setLoading(false);
  }

  async function handleCancel(requestId: string) {
    setCancelLoading(true);
    const { data, error } = await (supabase.from("failure_to_log") as any)
      .update({ status: "cancelled" })
      .eq("id", requestId)
      .eq("employee_id", employee?.id || "")
      .eq("status", "pending")
      .select()
      .maybeSingle();

    setCancelLoading(false);

    if (error) {
      console.error("Error cancelling request:", error);
      toast.error("Failed to cancel request");
      return;
    }

    if (!data) {
      toast.error("Could not cancel; request may no longer be pending.");
      return;
    }

    toast.success("Request cancelled", {
      description: "Your failure to log request has been cancelled",
    });
    setCancelId(null);
    if (employee) {
      fetchFailureToLogRequests(employee.id);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!employee || !reason.trim()) {
      toast.error("Please fill in the required fields");
      return;
    }

    const buildDateTime = (date: string, time: string) => {
      if (!date || !time) return null;
      return new Date(`${date}T${time}`).toISOString();
    };

    const actualClockInTime =
      entryType === "in" || entryType === "both"
        ? buildDateTime(missedDate, timeIn)
        : null;
    const actualClockOutTime =
      entryType === "out" || entryType === "both"
        ? buildDateTime(missedDate, timeOut)
        : null;

    if (
      (entryType === "in" && !actualClockInTime) ||
      (entryType === "out" && !actualClockOutTime) ||
      (entryType === "both" && (!actualClockInTime || !actualClockOutTime))
    ) {
      toast.error("Please provide the missing clock time(s).");
      return;
    }

    setSubmitting(true);

    const { error } = await (supabase.from("failure_to_log") as any).insert({
      employee_id: employee.id,
      time_entry_id: selectedTimeEntryId || null,
      missed_date: missedDate || null,
      actual_clock_in_time: actualClockInTime,
      actual_clock_out_time: actualClockOutTime,
      entry_type: entryType,
      reason: reason.trim(),
      status: "pending",
    });

    setSubmitting(false);

    if (error) {
      console.error("Error submitting failure to log request:", error);
      toast.error("Failed to submit request");
      return;
    }

    toast.success("Failure to log request submitted successfully!", {
      description: `Status: Pending approval • ${
        entryType === "both"
          ? "Clock in & out"
          : entryType === "in"
          ? "Clock in"
          : "Clock out"
      }`,
    });
    setMissedDate("");
    setTimeIn("");
    setTimeOut("");
    setEntryType("out");
    setReason("");
    setSelectedTimeEntryId("");
    fetchFailureToLogRequests(employee.id);
    fetchTimeEntries(employee.id);
  }

  if (loading || !employee) {
    return (
      <div className={cn("w-full", epPageWrapper)}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const visibleRequests = requests;
  const pendingCount = visibleRequests.filter(
    (r) => r.status === "pending"
  ).length;
  const approvedCount = visibleRequests.filter(
    (r) => r.status === "approved"
  ).length;
  const formatSafe = (value?: string | null, fmt?: string) =>
    value ? formatPHTime(value, fmt || "MMM dd, yyyy h:mm a") : "—";

  return (
    <>
      <div className={cn("w-full", epPageWrapper)}>
        <PortalPageHeader
          title="Failure to log"
          description={employee.full_name}
        />

        {/* Stats */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          <Card className="w-full h-full border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="ClockClockwise"
                    size={IconSizes.sm}
                    className="text-amber-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Pending
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-amber-600">
                  {pendingCount}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="CheckCircle"
                    size={IconSizes.sm}
                    className="text-emerald-600"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Approved
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-emerald-600">
                  {approvedCount}
                </div>
              </VStack>
            </CardContent>
          </Card>
          <Card className="w-full h-full border-l-4 border-l-muted-foreground/40 hover:shadow-md transition-shadow">
            <CardContent className="w-full p-5">
              <VStack gap="2" align="start" className="w-full">
                <HStack gap="2" align="center">
                  <Icon
                    name="List"
                    size={IconSizes.sm}
                    className="text-muted-foreground"
                  />
                  <BodySmall className="font-medium text-muted-foreground">
                    Total requests
                  </BodySmall>
                </HStack>
                <div className="text-3xl font-bold text-foreground">
                  {requests.length}
                </div>
              </VStack>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <CardSection
          title={
            <HStack gap="2" align="center">
              <Icon name="WarningCircle" size={IconSizes.md} />
              File failure to log request
            </HStack>
          }
        >
          <form onSubmit={handleSubmit} className="w-full min-w-0 max-w-full">
            <div className={epFormStack}>
              <div className={epFormField}>
                <Label htmlFor="entry-type">Log type</Label>
                <select
                  id="entry-type"
                  value={entryType}
                  onChange={(e) =>
                    setEntryType(e.target.value as "in" | "out" | "both")
                  }
                  className={epNativeSelect}
                >
                  <option value="out">Time out</option>
                  <option value="in">Time in</option>
                  <option value="both">Time in & out</option>
                </select>
              </div>

              <div className={epFormGrid}>
                <div className={epFormField}>
                  <Label htmlFor="missed-date">Date</Label>
                  <Input
                    id="missed-date"
                    type="date"
                    value={missedDate}
                    onChange={(e) => setMissedDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    required
                  />
                </div>

                {(entryType === "in" || entryType === "both") && (
                  <div className={epFormField}>
                    <Label htmlFor="time-in">Time in</Label>
                    <Input
                      id="time-in"
                      type="time"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                      required={entryType === "in" || entryType === "both"}
                    />
                  </div>
                )}

                {(entryType === "out" || entryType === "both") && (
                  <div className={epFormField}>
                    <Label htmlFor="time-out">Time out</Label>
                    <Input
                      id="time-out"
                      type="time"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      required={entryType === "out" || entryType === "both"}
                    />
                  </div>
                )}
              </div>

              <div className={epFormField}>
                <Label htmlFor="reason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why you missed a punch (required)"
                  rows={4}
                  className="resize-none"
                  required
                  aria-describedby="reason-help"
                />
                <Caption id="reason-help" className="text-muted-foreground">
                  Please provide a detailed explanation to help HR process your
                  request faster
                </Caption>
              </div>

              <Button
                type="submit"
                disabled={submitting || !reason.trim()}
                className="w-full md:w-auto md:min-w-[200px]"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRight" size={IconSizes.sm} />
                    Submit request
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardSection>

        {/* Requests List */}
        <CardSection title="My failure to log requests">
          {visibleRequests.length === 0 ? (
            <div className="text-center py-12">
              <VStack gap="4" align="center">
                <div className="rounded-full bg-muted p-6">
                  <Icon
                    name="Clock"
                    size={IconSizes.xl}
                    className="text-muted-foreground"
                  />
                </div>
                <VStack gap="2" align="center">
                  <H3 className="text-lg font-semibold">No requests yet</H3>
                  <BodySmall className="text-muted-foreground max-w-md">
                    Use the form above if you missed a punch.
                  </BodySmall>
                </VStack>
              </VStack>
            </div>
          ) : (
            <div className={epRequestHistoryList}>
              {visibleRequests.map((request) => {
                const ftlTimeLabel =
                  request.entry_type === "in"
                    ? formatSafe(
                        request.actual_clock_in_time,
                        "MMM d, h:mm a"
                      )
                    : request.entry_type === "out"
                    ? formatSafe(
                        request.actual_clock_out_time,
                        "MMM d, h:mm a"
                      )
                    : request.entry_type === "both" &&
                      request.actual_clock_in_time &&
                      request.actual_clock_out_time
                    ? `${formatSafe(request.actual_clock_in_time, "MMM d, h:mm a")} – ${formatSafe(request.actual_clock_out_time, "h:mm a")}`
                    : null;

                return (
                  <RequestHistoryCard
                    key={request.id}
                    status={request.status}
                    title={formatSafe(request.missed_date, "MMM dd, yyyy")}
                    categoryLabel={ftlEntryTypeLabel(request.entry_type)}
                    filedAt={formatSafe(
                      request.created_at,
                      "MMM dd, yyyy h:mm a"
                    )}
                    statusColumn={
                      <>
                        {request.status === "pending" && (
                          <>
                            <Badge
                              variant="outline"
                              className={epRequestStatusBadgePending}
                            >
                              <Icon name="Hourglass" size={IconSizes.sm} />
                              PENDING
                            </Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelId(request.id);
                              }}
                            >
                              Cancel request
                            </Button>
                          </>
                        )}
                        {request.status === "approved" && (
                          <Badge
                            variant="outline"
                            className={epRequestStatusBadgeApproved}
                          >
                            <Icon name="CheckCircle" size={IconSizes.sm} />
                            APPROVED
                          </Badge>
                        )}
                        {request.status === "rejected" && (
                          <Badge
                            variant="outline"
                            className={epRequestStatusBadgeRejected}
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            REJECTED
                          </Badge>
                        )}
                        {request.status === "cancelled" && (
                          <Badge
                            variant="outline"
                            className={epRequestStatusBadgeCancelled}
                          >
                            <Icon name="XCircle" size={IconSizes.sm} />
                            CANCELLED
                          </Badge>
                        )}
                      </>
                    }
                  >
                    {ftlTimeLabel ? (
                      <RequestHistoryTimeRow>{ftlTimeLabel}</RequestHistoryTimeRow>
                    ) : null}
                    <RequestHistoryReasonRow reason={request.reason} />
                    {request.status === "rejected" &&
                      request.rejection_reason && (
                        <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm">
                          <strong className="text-red-900">
                            Rejection reason:
                          </strong>
                          <div className="mt-1 text-red-800">
                            {request.rejection_reason}
                          </div>
                        </div>
                      )}
                  </RequestHistoryCard>
                );
              })}
            </div>
          )}
        </CardSection>
      </div>
      {cancelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <VStack gap="4">
              <H3>Cancel failure-to-log request?</H3>
              <BodySmall>
                This will mark the request as cancelled.
              </BodySmall>
              <HStack gap="2" justify="end" align="center">
                <Button
                  variant="outline"
                  onClick={() => setCancelId(null)}
                  disabled={cancelLoading}
                >
                  Keep request
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => cancelId && handleCancel(cancelId)}
                  disabled={cancelLoading}
                >
                  Cancel request
                </Button>
              </HStack>
            </VStack>
          </div>
        </div>
      )}
    </>
  );
}