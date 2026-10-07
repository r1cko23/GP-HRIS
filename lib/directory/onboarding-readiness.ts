export type OnboardingTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "waived"
  | "rejected";

export type CredentialStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "revoked";

export type CredentialEvaluationStatus =
  | "optional"
  | "missing"
  | "pending"
  | "valid"
  | "expired"
  | "rejected"
  | "revoked";

export type OnboardingReadinessInput = {
  tasks: Array<{
    id: string;
    title: string;
    required: boolean;
    status: OnboardingTaskStatus;
  }>;
  requirements: Array<{
    definition_id: string;
    code: string;
    name: string;
    required: boolean;
    blocking: boolean;
  }>;
  credentials: Array<{
    id: string;
    definition_id: string;
    status: CredentialStatus;
    issued_on: string | null;
    expires_on: string | null;
  }>;
  asOf?: string;
};

export type OnboardingReadiness = {
  ready: boolean;
  blocker_count: number;
  required_task_count: number;
  completed_required_task_count: number;
  required_credential_count: number;
  valid_required_credential_count: number;
  tasks: Array<OnboardingReadinessInput["tasks"][number] & { blocking: boolean }>;
  credentials: Array<
    OnboardingReadinessInput["requirements"][number] & {
      employee_credential_id: string | null;
      status: CredentialEvaluationStatus;
      issued_on: string | null;
      expires_on: string | null;
      blocking: boolean;
    }
  >;
  next_action: {
    kind: "task" | "credential";
    id: string;
    label: string;
    status: string;
  } | null;
};

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

export function computeOnboardingReadiness(
  input: OnboardingReadinessInput
): OnboardingReadiness {
  const asOf = dateOnly(input.asOf ?? new Date().toISOString());
  const tasks = input.tasks.map((task) => ({
    ...task,
    blocking:
      task.required &&
      task.status !== "completed" &&
      task.status !== "waived",
  }));

  const credentials = input.requirements.map((requirement) => {
    const credential = input.credentials.find(
      (row) => row.definition_id === requirement.definition_id
    );
    let status: CredentialEvaluationStatus;
    if (!requirement.required) {
      status = "optional";
    } else if (!credential) {
      status = "missing";
    } else if (
      credential.status === "verified" &&
      credential.expires_on &&
      dateOnly(credential.expires_on) < asOf
    ) {
      status = "expired";
    } else if (credential.status === "verified") {
      status = "valid";
    } else {
      status = credential.status;
    }

    return {
      ...requirement,
      employee_credential_id: credential?.id ?? null,
      status,
      issued_on: credential?.issued_on ?? null,
      expires_on: credential?.expires_on ?? null,
      blocking:
        requirement.required &&
        requirement.blocking &&
        status !== "valid",
    };
  });

  const taskBlockers = tasks.filter((task) => task.blocking);
  const credentialBlockers = credentials.filter((row) => row.blocking);
  const firstTask = taskBlockers[0];
  const firstCredential = credentialBlockers[0];

  return {
    ready: taskBlockers.length === 0 && credentialBlockers.length === 0,
    blocker_count: taskBlockers.length + credentialBlockers.length,
    required_task_count: tasks.filter((task) => task.required).length,
    completed_required_task_count: tasks.filter(
      (task) =>
        task.required &&
        (task.status === "completed" || task.status === "waived")
    ).length,
    required_credential_count: credentials.filter((row) => row.required).length,
    valid_required_credential_count: credentials.filter(
      (row) => row.required && row.status === "valid"
    ).length,
    tasks,
    credentials,
    next_action: firstTask
      ? {
          kind: "task",
          id: firstTask.id,
          label: firstTask.title,
          status: firstTask.status,
        }
      : firstCredential
        ? {
            kind: "credential",
            id: firstCredential.definition_id,
            label: firstCredential.name,
            status: firstCredential.status,
          }
        : null,
  };
}
