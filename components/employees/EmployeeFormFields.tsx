"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { EmployeeFormData } from "@/lib/employees/employeeFormState";

export interface OfficeLocationOption {
  id: string;
  name: string;
}

export interface OvertimeGroupOption {
  id: string;
  name: string;
  description: string | null;
}

export interface TransferEmployeeOption {
  id: string;
  employee_id: string;
  full_name: string;
}

interface EmployeeFormFieldsProps {
  formData: EmployeeFormData;
  setFormData: React.Dispatch<React.SetStateAction<EmployeeFormData>>;
  locations: OfficeLocationOption[];
  overtimeGroups: OvertimeGroupOption[];
  transferEmployeeOptions: TransferEmployeeOption[];
  hireDateEditable: boolean;
  employeeIdEditable: boolean;
  canAccessSalaryInfo: boolean;
  onToggleLocation: (locationId: string) => void;
}

export function EmployeeFormFields({
  formData,
  setFormData,
  locations,
  overtimeGroups,
  transferEmployeeOptions,
  hireDateEditable,
  employeeIdEditable,
  canAccessSalaryInfo,
  onToggleLocation,
}: EmployeeFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employee-id">Employee ID</Label>
          <Input
            id="employee-id"
            required
            value={formData.employee_id}
            onChange={(e) =>
              setFormData({ ...formData, employee_id: e.target.value })
            }
            disabled={!employeeIdEditable}
            placeholder="EMP001"
          />
          <p className="text-xs text-muted-foreground">
            Unique identifier. Immutable after creation.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hire-date">Hire Date</Label>
          <Input
            id="hire-date"
            type="date"
            value={formData.hire_date}
            onChange={(e) =>
              setFormData({ ...formData, hire_date: e.target.value })
            }
            required
            disabled={!hireDateEditable}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="last-name">Last Name</Label>
          <Input
            id="last-name"
            required
            value={formData.last_name}
            onChange={(e) =>
              setFormData({ ...formData, last_name: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="first-name">First Name</Label>
          <Input
            id="first-name"
            required
            value={formData.first_name}
            onChange={(e) =>
              setFormData({ ...formData, first_name: e.target.value })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="middle-initial">Middle Initial</Label>
          <Input
            id="middle-initial"
            value={formData.middle_initial}
            onChange={(e) =>
              setFormData({
                ...formData,
                middle_initial: e.target.value.toUpperCase().slice(0, 1),
              })
            }
            placeholder="M"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth-date">Birth Date</Label>
          <Input
            id="birth-date"
            type="date"
            value={formData.birth_date}
            onChange={(e) =>
              setFormData({ ...formData, birth_date: e.target.value })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) =>
              setFormData({ ...formData, gender: value })
            }
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used to auto-allocate maternity/paternity leave.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            placeholder="Residential address"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Assigned Locations</Label>
        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active locations configured yet. Add locations first.
            </p>
          ) : (
            locations.map((loc) => {
              const checked = formData.locations.includes(loc.id);
              return (
                <label
                  key={loc.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    checked
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    checked={checked}
                    onChange={() => onToggleLocation(loc.id)}
                  />
                  <span>{loc.name}</span>
                </label>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Select at least one location. The first selected becomes the primary
          location.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tin">TIN #</Label>
          <Input
            id="tin"
            value={formData.tin_number}
            onChange={(e) =>
              setFormData({ ...formData, tin_number: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sss">SSS #</Label>
          <Input
            id="sss"
            value={formData.sss_number}
            onChange={(e) =>
              setFormData({ ...formData, sss_number: e.target.value })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="philhealth">PhilHealth #</Label>
          <Input
            id="philhealth"
            value={formData.philhealth_number}
            onChange={(e) =>
              setFormData({
                ...formData,
                philhealth_number: e.target.value,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pagibig">Pag-IBIG #</Label>
          <Input
            id="pagibig"
            value={formData.pagibig_number}
            onChange={(e) =>
              setFormData({
                ...formData,
                pagibig_number: e.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hmo">HMO</Label>
        <Input
          id="hmo"
          value={formData.hmo_provider}
          onChange={(e) =>
            setFormData({ ...formData, hmo_provider: e.target.value })
          }
          placeholder="Provider name"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="position">Position</Label>
          <Input
            id="position"
            value={formData.position}
            onChange={(e) =>
              setFormData({ ...formData, position: e.target.value })
            }
            placeholder="e.g., Account Supervisor"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-level">Job Level</Label>
          <Select
            value={formData.job_level}
            onValueChange={(value) =>
              setFormData({ ...formData, job_level: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select job level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RANK AND FILE">Rank and File</SelectItem>
              <SelectItem value="SUPERVISORY">Supervisory</SelectItem>
              <SelectItem value="MANAGERIAL">Managerial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee-type">Employee Type</Label>
        <Select
          value={formData.employee_type}
          onValueChange={(value: "office-based" | "client-based") =>
            setFormData({ ...formData, employee_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select employee type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="office-based">Office-Based</SelectItem>
            <SelectItem value="client-based">Client-Based</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Office-Based: All employees except Account Supervisors. Client-Based:
          Account Supervisors only.
        </p>
      </div>

      {canAccessSalaryInfo && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="monthly-rate">Monthly Rate</Label>
            <Input
              id="monthly-rate"
              type="number"
              step="0.01"
              min="0"
              value={formData.monthly_rate}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  monthly_rate: e.target.value,
                })
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="per-day">Per Day Rate</Label>
            <Input
              id="per-day"
              type="number"
              step="0.01"
              min="0"
              value={formData.per_day}
              onChange={(e) =>
                setFormData({ ...formData, per_day: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Eligible for OT</Label>
        <Select
          value={formData.eligible_for_ot ? "YES" : "NO"}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              eligible_for_ot: value === "YES",
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="YES">Yes</SelectItem>
            <SelectItem value="NO">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="overtime-group">Group</Label>
        <Select
          value={formData.overtime_group_id || "none"}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              overtime_group_id: value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select group (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              None (any account manager/admin)
            </SelectItem>
            {overtimeGroups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
                {group.description && ` - ${group.description}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Put this person in a{" "}
          <strong className="text-foreground">group</strong> so their manager
          (group approver/viewer) can handle{" "}
          <strong className="text-foreground">first-step</strong> approvals for
          leave, failure to log, and overtime.{" "}
          <strong className="text-foreground">HR</strong> always completes
          final leave approval. Configure groups and leads in{" "}
          <Link
            href="/overtime-groups"
            className="text-emerald-600 underline font-medium"
          >
            Groups &amp; approvers
          </Link>{" "}
          or{" "}
          <Link
            href="/settings"
            className="text-emerald-600 underline font-medium"
          >
            Settings
          </Link>
          .
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transferred-from">
          Transferred from (previous employee)
        </Label>
        <Select
          value={formData.transferred_from_employee_id || "none"}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              transferred_from_employee_id: value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="None (OT loads from this record only)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              None (OT loads from this record only)
            </SelectItem>
            {transferEmployeeOptions.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.employee_id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          If this record was created when transferring an employee, select the
          previous employee so OT and attendance from the old record still load
          on Payslips and Time Attendance.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">
          Leave Allocations (auto-managed)
        </p>
        <p className="text-xs text-muted-foreground">
          SIL: 10 days after first anniversary (usable until Dec 31), then
          prorated monthly each year. Maternity: 105 days when gender is
          female.
        </p>
        {formData.gender === "male" && (
          <div className="space-y-2">
            <Label htmlFor="paternity">Paternity Leave (days)</Label>
            <Input
              id="paternity"
              type="number"
              min="0"
              step="0.5"
              value={formData.paternity_days}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  paternity_days: e.target.value,
                })
              }
              placeholder="e.g., 7"
            />
          </div>
        )}
      </div>
    </div>
  );
}
