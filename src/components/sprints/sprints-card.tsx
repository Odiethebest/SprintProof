"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Pencil, Plus } from "lucide-react";
import {
  validateSprint,
  type SprintErrorField,
  type SprintState,
} from "@/lib/sprints";
import type { TeamRole } from "@/lib/auth/team-access";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

export interface SprintView {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
  state: SprintState;
  datesLabel: string;
}

const STATE_LABELS: Record<SprintState, string> = {
  ENDED: "Ended",
  CURRENT: "Current",
  UPCOMING: "Upcoming",
};

const INPUT_CLASSES = {
  valid:
    "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  invalid:
    "h-9 w-full rounded-md border border-missed bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  error: string | undefined;
  hint?: string | null;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    className: string;
    "aria-invalid": boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        describedBy,
        className: error ? INPUT_CLASSES.invalid : INPUT_CLASSES.valid,
        "aria-invalid": Boolean(error),
      })}
      {hint && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1 text-xs text-missed">
          <CircleAlert size={12} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function SprintsCard({
  teamId,
  role,
  sprints,
}: {
  teamId: string;
  role: TeamRole;
  sprints: SprintView[];
}) {
  const router = useRouter();
  const isLead = role === "LEAD";

  const [isAdding, setIsAdding] = useState(false);
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);

  // Add form state
  const [addErrors, setAddErrors] = useState<
    Partial<Record<SprintErrorField, string>>
  >({});
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit form state
  const [editErrors, setEditErrors] = useState<
    Partial<Record<SprintErrorField, string>>
  >({});
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const existingSprints = sprints.map((s) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate,
    endDate: s.endDate,
  }));

  async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sprintInput = {
      name: String(form.get("name") ?? "").trim(),
      startDate: String(form.get("startDate") ?? "").trim(),
      endDate: String(form.get("endDate") ?? "").trim(),
      standupsPerPerson: Number(form.get("standupsPerPerson") ?? 3),
      reviewsPerPerson: Number(form.get("reviewsPerPerson") ?? 5),
    };

    const validationErrors = validateSprint({
      sprint: sprintInput,
      existingSprints,
    });

    if (validationErrors.length > 0) {
      const errorMap: Partial<Record<SprintErrorField, string>> = {};
      for (const err of validationErrors) {
        if (!errorMap[err.field]) {
          errorMap[err.field] = err.message;
        }
      }
      setAddErrors(errorMap);
      return;
    }

    setAddErrors({});
    setAddFormError(null);
    setIsSubmittingAdd(true);

    try {
      const response = await fetch(`/api/v1/teams/${teamId}/sprints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sprintInput),
      });

      if (response.ok) {
        setIsAdding(false);
        router.refresh();
      } else {
        const error = await readApiError(response);
        setAddFormError(error.message);
      }
    } catch {
      setAddFormError(NETWORK_ERROR_MESSAGE);
    } finally {
      setIsSubmittingAdd(false);
    }
  }

  async function handleEditSubmit(
    sprintId: string,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sprintInput = {
      id: sprintId,
      name: String(form.get("name") ?? "").trim(),
      startDate: String(form.get("startDate") ?? "").trim(),
      endDate: String(form.get("endDate") ?? "").trim(),
      standupsPerPerson: Number(form.get("standupsPerPerson") ?? 3),
      reviewsPerPerson: Number(form.get("reviewsPerPerson") ?? 5),
    };

    const validationErrors = validateSprint({
      sprint: sprintInput,
      existingSprints,
    });

    if (validationErrors.length > 0) {
      const errorMap: Partial<Record<SprintErrorField, string>> = {};
      for (const err of validationErrors) {
        if (!errorMap[err.field]) {
          errorMap[err.field] = err.message;
        }
      }
      setEditErrors(errorMap);
      return;
    }

    setEditErrors({});
    setEditFormError(null);
    setIsSubmittingEdit(true);

    try {
      const response = await fetch(
        `/api/v1/teams/${teamId}/sprints/${sprintId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sprintInput),
        }
      );

      if (response.ok) {
        setEditingSprintId(null);
        router.refresh();
      } else {
        const error = await readApiError(response);
        setEditFormError(error.message);
      }
    } catch {
      setEditFormError(NETWORK_ERROR_MESSAGE);
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  return (
    <section
      aria-labelledby="sprints-title"
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="sprints-title" className="text-lg font-semibold">
            Sprints and requirements
          </h2>
          <p className="text-xs text-text-muted">
            The current sprint is the one that contains today
          </p>
        </div>
        {isLead && !isAdding && (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              setEditingSprintId(null);
            }}
            className={BUTTON_CLASSES.secondary}
          >
            <Plus size={16} aria-hidden="true" />
            Add sprint
          </button>
        )}
      </div>

      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
        >
          <h3 className="text-sm font-semibold">New sprint</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="Sprint name"
              error={addErrors.name}
              hint="For example, Sprint 1"
            >
              {(props) => (
                <input
                  type="text"
                  name="name"
                  id={props.id}
                  aria-describedby={props.describedBy}
                  aria-invalid={props["aria-invalid"]}
                  className={props.className}
                  placeholder="Sprint 1"
                  required
                />
              )}
            </FormField>

            <FormField
              label="Start date"
              error={addErrors.startDate}
              hint="YYYY-MM-DD"
            >
              {(props) => (
                <input
                  type="text"
                  name="startDate"
                  id={props.id}
                  aria-describedby={props.describedBy}
                  aria-invalid={props["aria-invalid"]}
                  className={props.className}
                  placeholder="2026-10-29"
                  required
                />
              )}
            </FormField>

            <FormField
              label="End date"
              error={addErrors.endDate}
              hint="YYYY-MM-DD"
            >
              {(props) => (
                <input
                  type="text"
                  name="endDate"
                  id={props.id}
                  aria-describedby={props.describedBy}
                  aria-invalid={props["aria-invalid"]}
                  className={props.className}
                  placeholder="2026-11-04"
                  required
                />
              )}
            </FormField>

            <FormField
              label="Standups per person"
              error={addErrors.standupsPerPerson}
              hint="Default: 3"
            >
              {(props) => (
                <input
                  type="number"
                  name="standupsPerPerson"
                  id={props.id}
                  aria-describedby={props.describedBy}
                  aria-invalid={props["aria-invalid"]}
                  className={props.className}
                  defaultValue={3}
                  min={1}
                  max={20}
                  required
                />
              )}
            </FormField>

            <FormField
              label="PR reviews per person"
              error={addErrors.reviewsPerPerson}
              hint="Default: 5"
            >
              {(props) => (
                <input
                  type="number"
                  name="reviewsPerPerson"
                  id={props.id}
                  aria-describedby={props.describedBy}
                  aria-invalid={props["aria-invalid"]}
                  className={props.className}
                  defaultValue={5}
                  min={1}
                  max={20}
                  required
                />
              )}
            </FormField>
          </div>

          {addFormError && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-missed"
            >
              <CircleAlert size={16} aria-hidden="true" />
              {addFormError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmittingAdd}
              className={BUTTON_CLASSES.primary}
            >
              {isSubmittingAdd ? "Saving…" : "Save sprint"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setAddErrors({});
                setAddFormError(null);
              }}
              className={BUTTON_CLASSES.secondary}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sprints.length === 0 ? (
        <p className="py-4 text-sm text-text-muted">No sprints added yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">List of team sprints</caption>
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th scope="col" className="pb-2 font-medium">
                  Sprint
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Dates
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Standups per person
                </th>
                <th scope="col" className="pb-2 font-medium">
                  PR reviews per person
                </th>
                <th scope="col" className="pb-2 font-medium">
                  State
                </th>
                {isLead && (
                  <th scope="col" className="pb-2 font-medium text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sprints.map((sprint) => {
                const isCurrent = sprint.state === "CURRENT";
                const isEditing = editingSprintId === sprint.id;

                if (isEditing) {
                  return (
                    <tr key={sprint.id} className="bg-surface-elevated/50">
                      <td colSpan={isLead ? 6 : 5} className="py-4">
                        <form
                          onSubmit={(e) => handleEditSubmit(sprint.id, e)}
                          noValidate
                          className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
                        >
                          <h3 className="text-sm font-semibold">
                            Edit {sprint.name}
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <FormField
                              label="Sprint name"
                              error={editErrors.name}
                            >
                              {(props) => (
                                <input
                                  type="text"
                                  name="name"
                                  id={props.id}
                                  aria-describedby={props.describedBy}
                                  aria-invalid={props["aria-invalid"]}
                                  className={props.className}
                                  defaultValue={sprint.name}
                                  required
                                />
                              )}
                            </FormField>

                            <FormField
                              label="Start date"
                              error={editErrors.startDate}
                              hint="YYYY-MM-DD"
                            >
                              {(props) => (
                                <input
                                  type="text"
                                  name="startDate"
                                  id={props.id}
                                  aria-describedby={props.describedBy}
                                  aria-invalid={props["aria-invalid"]}
                                  className={props.className}
                                  defaultValue={sprint.startDate}
                                  required
                                />
                              )}
                            </FormField>

                            <FormField
                              label="End date"
                              error={editErrors.endDate}
                              hint="YYYY-MM-DD"
                            >
                              {(props) => (
                                <input
                                  type="text"
                                  name="endDate"
                                  id={props.id}
                                  aria-describedby={props.describedBy}
                                  aria-invalid={props["aria-invalid"]}
                                  className={props.className}
                                  defaultValue={sprint.endDate}
                                  required
                                />
                              )}
                            </FormField>

                            <FormField
                              label="Standups per person"
                              error={editErrors.standupsPerPerson}
                            >
                              {(props) => (
                                <input
                                  type="number"
                                  name="standupsPerPerson"
                                  id={props.id}
                                  aria-describedby={props.describedBy}
                                  aria-invalid={props["aria-invalid"]}
                                  className={props.className}
                                  defaultValue={sprint.standupsPerPerson}
                                  min={1}
                                  max={20}
                                  required
                                />
                              )}
                            </FormField>

                            <FormField
                              label="PR reviews per person"
                              error={editErrors.reviewsPerPerson}
                            >
                              {(props) => (
                                <input
                                  type="number"
                                  name="reviewsPerPerson"
                                  id={props.id}
                                  aria-describedby={props.describedBy}
                                  aria-invalid={props["aria-invalid"]}
                                  className={props.className}
                                  defaultValue={sprint.reviewsPerPerson}
                                  min={1}
                                  max={20}
                                  required
                                />
                              )}
                            </FormField>
                          </div>

                          {editFormError && (
                            <p
                              role="alert"
                              className="flex items-center gap-2 text-sm text-missed"
                            >
                              <CircleAlert size={16} aria-hidden="true" />
                              {editFormError}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={isSubmittingEdit}
                              className={BUTTON_CLASSES.primary}
                            >
                              {isSubmittingEdit ? "Saving…" : "Save changes"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSprintId(null);
                                setEditErrors({});
                                setEditFormError(null);
                              }}
                              className={BUTTON_CLASSES.secondary}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={sprint.id}
                    data-current={isCurrent ? "true" : undefined}
                    className={`transition-colors duration-150 ${
                      isCurrent
                        ? "bg-surface-elevated/70 font-medium"
                        : "hover:bg-text/5"
                    }`}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span
                            className="h-2 w-2 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        )}
                        <span>{sprint.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-text-muted font-mono text-xs">
                      {sprint.datesLabel}
                    </td>
                    <td className="py-3 font-mono tabular-nums">
                      {sprint.standupsPerPerson}
                    </td>
                    <td className="py-3 font-mono tabular-nums">
                      {sprint.reviewsPerPerson}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                          isCurrent
                            ? "bg-primary/10 font-semibold text-primary"
                            : "text-text-muted"
                        }`}
                      >
                        {STATE_LABELS[sprint.state]}
                      </span>
                    </td>
                    {isLead && (
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSprintId(sprint.id);
                            setIsAdding(false);
                            setEditErrors({});
                            setEditFormError(null);
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
