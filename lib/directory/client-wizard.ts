export const CLIENT_WIZARD_STEPS = [
  {
    id: "identity",
    label: "Identity",
    sectionId: "identity" as const,
    description: "Name, TIN, status, and pay frequency.",
  },
  {
    id: "contact",
    label: "Contact",
    sectionId: "contact" as const,
    description: "Who we call at this client.",
  },
  {
    id: "calendar",
    label: "Pay calendar",
    sectionId: "pay" as const,
    description: "Cutoff day windows.",
  },
  {
    id: "statutory",
    label: "Statutory",
    sectionId: "statutory" as const,
    description: "Which cutoff carries SSS, PhilHealth, Pag-IBIG, WTAX.",
  },
  {
    id: "billing",
    label: "Billing",
    sectionId: "billing" as const,
    description: "Admin fee, VAT, EWT, and SOA pack.",
  },
] as const;

export type ClientWizardStepId = (typeof CLIENT_WIZARD_STEPS)[number]["id"];

export function clientWizardSteps(includeBilling: boolean) {
  if (includeBilling) return [...CLIENT_WIZARD_STEPS];
  return CLIENT_WIZARD_STEPS.filter((step) => step.id !== "billing");
}

export function isOrganicOrganizationName(name: string | null | undefined) {
  return (name ?? "").toLowerCase().includes("organic");
}
