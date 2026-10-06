export type PayslipPerson = {
  lineId: string;
  name: string;
  email: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function planPayslipSend(people: PayslipPerson[]): {
  toSend: PayslipPerson[];
  skipped: PayslipPerson[];
} {
  const toSend: PayslipPerson[] = [];
  const skipped: PayslipPerson[] = [];
  for (const person of people) {
    const email = person.email?.trim() ?? "";
    if (!EMAIL.test(email)) {
      skipped.push({ ...person, email: email || null });
    } else {
      toSend.push({ ...person, email });
    }
  }
  return { toSend, skipped };
}

export function payslipSendBatch(input: {
  planned: ReturnType<typeof planPayslipSend>;
  alreadySentLineIds: string[];
}): {
  toSend: PayslipPerson[];
  skipped: PayslipPerson[];
  alreadySent: number;
} {
  const sent = new Set(input.alreadySentLineIds);
  const toSend = input.planned.toSend.filter((row) => !sent.has(row.lineId));
  return {
    toSend,
    skipped: input.planned.skipped,
    alreadySent: input.planned.toSend.length - toSend.length,
  };
}
