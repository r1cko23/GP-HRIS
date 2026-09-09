/**
 * Stakeholder brief: CSM Verified already had Nabati Batangas right;
 * Directory / GREENHRISMAIN copies were still tagged to the wrong site,
 * status, or a second 201. Snapshot of the 2026-09-05 backfill.
 * Does not dial office SQL Server.
 */

export type TaggingKind =
  | "wrong_site"
  | "wrong_status"
  | "untagged_timesheet"
  | "second_201"
  | "csm_resigned";

export const TAGGING_KIND_LABEL: Record<TaggingKind, string> = {
  wrong_site: "Wrong site",
  wrong_status: "Wrong status",
  untagged_timesheet: "Timesheet untagged",
  second_201: "Second 201",
  csm_resigned: "CSM resigned",
};

export type TaggingFinding = {
  kind: TaggingKind;
  last_name: string;
  first_name: string;
  employee_code: string;
  greenhrismain_employee_id: number;
  csm_said: string;
  directory_had: string;
  timesheet_tag: string;
  gp_did: string;
};

export type TaggingBrief = {
  site: string;
  cutoff: string;
  timesheet_people: number;
  ingested_before_align: number;
  ingested_after_align: number;
  findings: TaggingFinding[];
};

const FINDINGS: TaggingFinding[] = [
  {
    kind: "wrong_site",
    last_name: "Babadilla",
    first_name: "Adrian",
    employee_code: "202512-00041",
    greenhrismain_employee_id: 27143,
    csm_said: "Casual on Nabati Batangas",
    directory_had: "Active on Taytay",
    timesheet_tag: "Directory id present, site wrong",
    gp_did: "Transferred same person Batangas. No new 201.",
  },
  {
    kind: "wrong_site",
    last_name: "Dayto",
    first_name: "Nilo",
    employee_code: "202209-00148",
    greenhrismain_employee_id: 16268,
    csm_said: "Casual on Nabati Batangas",
    directory_had: "Active on Laguna",
    timesheet_tag: "Directory id present, site wrong",
    gp_did: "Transferred same person Batangas. No new 201.",
  },
  {
    kind: "wrong_site",
    last_name: "Mazo",
    first_name: "Dennis",
    employee_code: "202604-00028",
    greenhrismain_employee_id: 28202,
    csm_said: "Casual on Nabati Batangas",
    directory_had: "Active on Baesa",
    timesheet_tag: "Directory id present, site wrong",
    gp_did: "Transferred same person Batangas. No new 201.",
  },
  {
    kind: "wrong_site",
    last_name: "Umali",
    first_name: "Norman",
    employee_code: "202307-00262",
    greenhrismain_employee_id: 19214,
    csm_said: "Casual on Nabati Batangas",
    directory_had: "Active on Baesa",
    timesheet_tag: "Directory id present, site wrong",
    gp_did: "Transferred same person Batangas. No new 201.",
  },
  {
    kind: "wrong_status",
    last_name: "Añonuevo",
    first_name: "Carlo Magno",
    employee_code: "202211-00036",
    greenhrismain_employee_id: 16797,
    csm_said: "Casual on Nabati Batangas",
    directory_had: "Inactive on Batangas (original 201)",
    timesheet_tag: "Untagged",
    gp_did: "Rehired same person. Kept employee code 202211-00036.",
  },
  {
    kind: "wrong_status",
    last_name: "Rubi",
    first_name: "Rence Paul",
    employee_code: "202312-00021",
    greenhrismain_employee_id: 20586,
    csm_said: "Casual on Nabati Batangas",
    directory_had: "For release on Batangas (original 201)",
    timesheet_tag: "Untagged",
    gp_did: "Activated same person. Kept employee code 202312-00021.",
  },
  {
    kind: "untagged_timesheet",
    last_name: "Cadacio",
    first_name: "Raymond",
    employee_code: "202107-00076",
    greenhrismain_employee_id: 12980,
    csm_said: "Casual on Nabati Batangas (Directory spelling Raymund)",
    directory_had: "Active on Batangas, already the right person",
    timesheet_tag: "Untagged",
    gp_did: "Stamped CSM Directory id onto the timesheet. No new 201.",
  },
  {
    kind: "second_201",
    last_name: "Añonuevo",
    first_name: "Carlo Magno",
    employee_code: "202506-00194",
    greenhrismain_employee_id: 25682,
    csm_said: "Same person as 202211-00036 / Employee_id 16797",
    directory_had: "A second active 201 created after resign",
    timesheet_tag: "Not used on this cutoff",
    gp_did: "Left in place. GP register used CSM’s original 201.",
  },
  {
    kind: "second_201",
    last_name: "Rubi",
    first_name: "Rence Paul",
    employee_code: "202503-00044",
    greenhrismain_employee_id: 24741,
    csm_said: "Same person as 202312-00021 / Employee_id 20586",
    directory_had: "A second active 201 created after resign",
    timesheet_tag: "Not used on this cutoff",
    gp_did: "Left in place. GP register used CSM’s original 201.",
  },
  {
    kind: "csm_resigned",
    last_name: "Anuran",
    first_name: "Nikko",
    employee_code: "202307-00143",
    greenhrismain_employee_id: 19087,
    csm_said: "Resigned · Nabati Batangas",
    directory_had: "Still tagged active",
    timesheet_tag: "Not on Aug 16–31 timesheet",
    gp_did: "Marked inactive on the same person.",
  },
  {
    kind: "csm_resigned",
    last_name: "Avila",
    first_name: "Katte",
    employee_code: "202512-00040",
    greenhrismain_employee_id: 27142,
    csm_said: "Resigned · Nabati Batangas",
    directory_had: "Still tagged active",
    timesheet_tag: "Not on Aug 16–31 timesheet",
    gp_did: "Marked inactive on the same person.",
  },
  {
    kind: "csm_resigned",
    last_name: "Ombao",
    first_name: "Renniel",
    employee_code: "202411-00039",
    greenhrismain_employee_id: 23647,
    csm_said: "Resigned · Nabati Batangas",
    directory_had: "Still tagged active",
    timesheet_tag: "Not on Aug 16–31 timesheet",
    gp_did: "Marked inactive on the same person.",
  },
];

export type TaggingRateRow = {
  name: string;
  employee_code: string;
  greenhrismain_employee_id: number;
  directory_daily_rate: number;
  office_daily_rate: number;
  note: string;
};

/** Directory person.daily_rate vs last Batangas office PDF (Jul 16–31 2026). */
export const NABATI_BATANGAS_RATE_GAPS: TaggingRateRow[] = [
  {
    name: "Aban, Claire",
    employee_code: "202309-00023",
    greenhrismain_employee_id: 19635,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Añonuevo, Carlo Magno",
    employee_code: "202211-00036",
    greenhrismain_employee_id: 16797,
    directory_daily_rate: 540,
    office_daily_rate: 695,
    note: "Original 201. Second 201 25682 already 695",
  },
  {
    name: "Bruel, Beverly",
    employee_code: "202307-00021",
    greenhrismain_employee_id: 18937,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Cadacio, Raymund",
    employee_code: "202107-00076",
    greenhrismain_employee_id: 12980,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Dayto, Nilo",
    employee_code: "202209-00148",
    greenhrismain_employee_id: 16268,
    directory_daily_rate: 677.25,
    office_daily_rate: 695,
    note: "No position on 201",
  },
  {
    name: "Dimaculangan, Aron John",
    employee_code: "202303-00316",
    greenhrismain_employee_id: 18316,
    directory_daily_rate: 677.25,
    office_daily_rate: 695,
    note: "Position card already 695",
  },
  {
    name: "Guerrero, Jessie",
    employee_code: "202203-00194",
    greenhrismain_employee_id: 14471,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Morales, John Philip",
    employee_code: "202312-00306",
    greenhrismain_employee_id: 20938,
    directory_daily_rate: 677.25,
    office_daily_rate: 695,
    note: "Position card already 695",
  },
  {
    name: "Nepomuceno, Andrew",
    employee_code: "202106-00060",
    greenhrismain_employee_id: 12805,
    directory_daily_rate: 677.25,
    office_daily_rate: 695,
    note: "Position card already 695",
  },
  {
    name: "Perez, Christian",
    employee_code: "202107-00015",
    greenhrismain_employee_id: 12889,
    directory_daily_rate: 426.11,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Rosales, Angelica",
    employee_code: "202501-00002",
    greenhrismain_employee_id: 15686,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Rubi, Rence Paul",
    employee_code: "202312-00021",
    greenhrismain_employee_id: 20586,
    directory_daily_rate: 546,
    office_daily_rate: 695,
    note: "Original 201. Second 201 24741 already 695",
  },
  {
    name: "Samosa, Ryan",
    employee_code: "202106-00132",
    greenhrismain_employee_id: 12888,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Silva, Randy",
    employee_code: "202205-00133",
    greenhrismain_employee_id: 15075,
    directory_daily_rate: 677.25,
    office_daily_rate: 695,
    note: "Position card already 695",
  },
  {
    name: "Sulabo, Joeffrey",
    employee_code: "202106-00131",
    greenhrismain_employee_id: 12887,
    directory_daily_rate: 677.25,
    office_daily_rate: 695,
    note: "Position card already 695",
  },
  {
    name: "Viar, Nordel",
    employee_code: "202301-00007",
    greenhrismain_employee_id: 12891,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
  {
    name: "Villanueva, Mary Jane",
    employee_code: "202205-00242",
    greenhrismain_employee_id: 15203,
    directory_daily_rate: 540,
    office_daily_rate: 600,
    note: "Position card already 600",
  },
];

export function nabatiBatangasTaggingBrief(): TaggingBrief {
  return {
    site: "Nabati Batangas",
    cutoff: "2026-08-16 to 2026-08-31",
    timesheet_people: 27,
    ingested_before_align: 20,
    ingested_after_align: 27,
    findings: FINDINGS,
  };
}

export function taggingBriefToCsv(brief: TaggingBrief): string {
  const header = [
    "kind",
    "last_name",
    "first_name",
    "employee_code",
    "greenhrismain_employee_id",
    "csm_said",
    "directory_had",
    "timesheet_tag",
    "gp_did",
  ];
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = brief.findings.map((row) =>
    [
      row.kind,
      row.last_name,
      row.first_name,
      row.employee_code,
      row.greenhrismain_employee_id,
      row.csm_said,
      row.directory_had,
      row.timesheet_tag,
      row.gp_did,
    ]
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
