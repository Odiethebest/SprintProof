"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { z } from "zod";
import {
  DEFAULT_TEAM_TIMEZONE,
  createTeamSchema,
} from "@/lib/teams/create-team";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

type FieldName = "name" | "repoFullName" | "timezone";
type FieldErrors = Partial<Record<FieldName, string[]>>;

// The fields in the order they're shown, so focus lands on the first invalid one.
const FIELD_ORDER: FieldName[] = ["name", "repoFullName", "timezone"];

const createdTeamSchema = z.object({ id: z.string() });

// DESIGN.md §7 Forms: the border turns `missed` on error. Repos use the mono font.
const INPUT_CLASSES = {
  sans: {
    valid:
      "h-9 w-full rounded-md border border-form-control-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    invalid:
      "h-9 w-full rounded-md border border-missed bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  },
  mono: {
    valid:
      "h-9 w-full rounded-md border border-form-control-border bg-surface px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    invalid:
      "h-9 w-full rounded-md border border-missed bg-surface px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  },
} as const;

function Field({
  label,
  hint,
  error,
  font,
  children,
}: {
  label: ReactNode;
  hint: string | null;
  error: string | undefined;
  font: keyof typeof INPUT_CLASSES;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    className: string;
  }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
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
        className: error
          ? INPUT_CLASSES[font].invalid
          : INPUT_CLASSES[font].valid,
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

export function CreateTeamForm({ timezones }: { timezones: string[] }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Render the errors first, so a screen reader hears them when the field gets
  // focus (#77). StandupForm does the same.
  function showFieldErrors(formElement: HTMLFormElement, errors: FieldErrors) {
    flushSync(() => setFieldErrors(errors));
    const firstInvalid = FIELD_ORDER.find((name) => errors[name]);
    const field = firstInvalid
      ? formElement.elements.namedItem(firstInvalid)
      : null;
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      field.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    // The same schema as the API, so the form shows its errors before sending.
    const parsed = createTeamSchema.safeParse({
      name: form.get("name"),
      repoFullName: form.get("repoFullName"),
      timezone: form.get("timezone"),
    });
    if (!parsed.success) {
      showFieldErrors(formElement, z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        const team = createdTeamSchema.parse(await response.json());
        router.push(`/teams/${team.id}/settings`);
        return;
      }
      const error = await readApiError(response);
      if (error.code === "REPO_ALREADY_CONNECTED") {
        showFieldErrors(formElement, { repoFullName: [error.message] });
      } else {
        setFormError(error.message);
      }
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        label="Team name"
        hint={null}
        error={fieldErrors.name?.[0]}
        font="sans"
      >
        {({ id, describedBy, className }) => (
          <input
            id={id}
            name="name"
            type="text"
            autoComplete="off"
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
        )}
      </Field>
      <Field
        label="GitHub repo"
        hint="The repo your team works in, as owner/name."
        error={fieldErrors.repoFullName?.[0]}
        font="mono"
      >
        {({ id, describedBy, className }) => (
          <input
            id={id}
            name="repoFullName"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="owner/name"
            aria-invalid={fieldErrors.repoFullName ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          />
        )}
      </Field>
      <Field
        label="Team timezone"
        hint="Sprint days and standup dates use this timezone."
        error={fieldErrors.timezone?.[0]}
        font="sans"
      >
        {({ id, describedBy, className }) => (
          <select
            id={id}
            name="timezone"
            defaultValue={DEFAULT_TEAM_TIMEZONE}
            aria-invalid={fieldErrors.timezone ? true : undefined}
            aria-describedby={describedBy}
            className={className}
          >
            {timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        )}
      </Field>
      {formError && (
        <p role="alert" className="flex items-center gap-2 text-sm text-missed">
          <CircleAlert size={16} aria-hidden="true" />
          {formError}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={BUTTON_CLASSES.primary}
        >
          Create team
        </button>
      </div>
    </form>
  );
}
