/**
 * Who to show on a loan row. Directory is person SoT; Bundy is optional
 * (Deployed loans often have no office clock row).
 */

export type LoanDirectoryPerson = {
  id: string;
  client_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
};

export type LoanOfficePerson = {
  id: string;
  employee_id?: string | null;
  full_name?: string | null;
  last_name?: string | null;
  first_name?: string | null;
};

export type LoanDisplayPerson = {
  directory_employee_id: string | null;
  office_employee_id: string | null;
  client_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  full_name: string;
};

function joinName(last: string | null | undefined, first: string | null | undefined) {
  const lastName = (last ?? "").trim();
  const firstName = (first ?? "").trim();
  return [lastName, firstName].filter(Boolean).join(", ");
}

export function resolveLoanDisplayPerson(input: {
  directoryEmployeeId?: string | null;
  officeEmployeeId?: string | null;
  directory?: LoanDirectoryPerson | null;
  office?: LoanOfficePerson | null;
}): LoanDisplayPerson {
  const directoryId =
    (input.directory?.id ?? input.directoryEmployeeId ?? "").trim() || null;
  const officeId =
    (input.office?.id ?? input.officeEmployeeId ?? "").trim() || null;
  const directory = input.directory ?? null;
  const office = input.office ?? null;

  if (directory) {
    return {
      directory_employee_id: directoryId,
      office_employee_id: officeId,
      client_id: directory.client_id,
      employee_code: (directory.employee_code ?? "").trim() || null,
      last_name: directory.last_name,
      first_name: directory.first_name,
      full_name: joinName(directory.last_name, directory.first_name),
    };
  }

  if (office) {
    const fromParts = joinName(office.last_name, office.first_name);
    return {
      directory_employee_id: directoryId,
      office_employee_id: officeId,
      client_id: null,
      employee_code: (office.employee_id ?? "").trim() || null,
      last_name: office.last_name ?? null,
      first_name: office.first_name ?? null,
      full_name: fromParts || (office.full_name ?? "").trim(),
    };
  }

  return {
    directory_employee_id: directoryId,
    office_employee_id: officeId,
    client_id: null,
    employee_code: null,
    last_name: null,
    first_name: null,
    full_name: "",
  };
}
