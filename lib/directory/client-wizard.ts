export const CLIENT_WIZARD_STEPS = [
  {
    id: "identity",
    label: "Identity",
    sectionId: "identity" as const,
    description: "",
  },
  {
    id: "contact",
    label: "Contact",
    sectionId: "contact" as const,
    description: "",
  },
  {
    id: "calendar",
    label: "Pay calendar",
    sectionId: "pay" as const,
    description: "",
  },
  {
    id: "statutory",
    label: "Statutory",
    sectionId: "statutory" as const,
    description: "",
  },
  {
    id: "billing",
    label: "Billing",
    sectionId: "billing" as const,
    description: "",
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
