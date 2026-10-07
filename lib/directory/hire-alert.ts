export type HireAlertStatus = "open" | "dismissed" | "cleared";

export type HireAlertMatch = {
  id: string;
  personName: string;
  status: HireAlertStatus;
};

export function parseHireAlertName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > 120) return null;
  return name;
}

/** Prefill hire identity from an AS 201-alert name (`Last, First` preferred). */
export function splitHireAlertPersonName(raw: string): {
  last_name: string;
  first_name: string;
} {
  const name = parseHireAlertName(raw) ?? "";
  if (!name) return { last_name: "", first_name: "" };
  const comma = name.indexOf(",");
  if (comma >= 0) {
    return {
      last_name: name.slice(0, comma).trim(),
      first_name: name.slice(comma + 1).trim(),
    };
  }
  return { last_name: name, first_name: "" };
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

export function hireAlertMatchesPick(alertName: string, pickedName: string): boolean {
  const alert = tokens(alertName);
  const picked = new Set(tokens(pickedName));
  if (alert.length === 0 || picked.size === 0) return false;
  const alertText = alert.join(" ");
  const pickedText = [...picked].sort().join(" ");
  if (alert.length < 2) return alertText === pickedText;
  return alert.every((word) => picked.has(word));
}

export function hireAlertsClearedByPick(input: {
  alerts: HireAlertMatch[];
  pickedName: string;
}): string[] {
  return input.alerts
    .filter(
      (alert) =>
        alert.status === "open" &&
        hireAlertMatchesPick(alert.personName, input.pickedName),
    )
    .map((alert) => alert.id);
}
