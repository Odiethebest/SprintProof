"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck } from "lucide-react";
import { z } from "zod";
import {
  MAX_STANDUP_FIELD_LENGTH,
  createStandupSchema,
} from "@/lib/standups/standup-input";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { TOAST_DURATION_MS, Toast } from "@/components/ui/toast";

type FieldName = "yesterday" | "today" | "blockers";
type FieldValues = Record<FieldName, string>;
type FieldErrors = Partial<Record<FieldName, string[]>>;

// Focus goes to the first invalid field in the order they appear.
const FIELD_ORDER: FieldName[] = ["yesterday", "today", "blockers"];

// DESIGN.md §7 Forms: the border turns `missed` on error.
const TEXTAREA_CLASSES = {
  valid:
    "w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  invalid:
    "w-full resize-y rounded-md border border-missed bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

export interface SavedStandupView {
  yesterday: string;
  today: string;
  blockers: string | null;
  postedAtLabel: string;
}

function StandupField({
  name,
  label,
  placeholder,
  value,
  error,
  onChange,
}: {
  name: FieldName;
  label: ReactNode;
  placeholder: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const isOverLimit = value.length > MAX_STANDUP_FIELD_LENGTH;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${counterId}` : counterId}
        className={error ? TEXTAREA_CLASSES.invalid : TEXTAREA_CLASSES.valid}
      />
      <div className="flex items-start justify-between gap-2">
        {error ? (
          <p
            id={errorId}
            className="flex items-center gap-1 text-xs text-missed"
          >
            <CircleAlert size={12} aria-hidden="true" />
            {error}
          </p>
        ) : (
          <span />
        )}
        <p
          id={counterId}
          className={
            isOverLimit
              ? "shrink-0 font-mono text-xs tabular-nums text-missed"
              : "shrink-0 font-mono text-xs tabular-nums text-text-muted"
          }
        >
          {value.length} / {MAX_STANDUP_FIELD_LENGTH}
        </p>
      </div>
    </div>
  );
}

function StandupFields({
  formDate,
  teamId,
  saved,
}: {
  formDate: string;
  teamId: string;
  saved: SavedStandupView | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FieldValues>({
    yesterday: saved?.yesterday ?? "",
    today: saved?.today ?? "",
    blockers: saved?.blockers ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hasDayChanged, setHasDayChanged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function setField(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // The same schema as the API, so the form shows its errors before sending.
    const parsed = createStandupSchema.safeParse(values);
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      // Render the errors first, so a screen reader hears them when the field gets focus.
      flushSync(() => setFieldErrors(errors));
      const firstInvalid = FIELD_ORDER.find((name) => errors[name]);
      const field = firstInvalid ? form.elements.namedItem(firstInvalid) : null;
      if (field instanceof HTMLTextAreaElement) {
        field.focus();
      }
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/standups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...parsed.data, formDate }),
      });
      if (response.ok) {
        setToast(
          response.status === 201 ? "Standup posted." : "Standup updated."
        );
        router.refresh();
      } else {
        const error = await readApiError(response);
        setFormError(error.message);
        setHasDayChanged(error.code === "STANDUP_DAY_CHANGED");
      }
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  }

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {saved && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheck size={16} aria-hidden="true" className="text-met" />
            Posted at {saved.postedAtLabel}. Saving again updates it.
          </p>
        )}
        <StandupField
          name="yesterday"
          label="Yesterday"
          placeholder="What you worked on"
          value={values.yesterday}
          error={fieldErrors.yesterday?.[0]}
          onChange={(value) => setField("yesterday", value)}
        />
        <StandupField
          name="today"
          label="Today"
          placeholder="What you plan to work on"
          value={values.today}
          error={fieldErrors.today?.[0]}
          onChange={(value) => setField("today", value)}
        />
        <StandupField
          name="blockers"
          label={
            <>
              Blockers <span className="text-text-muted">(optional)</span>
            </>
          }
          placeholder="Anything slowing you down"
          value={values.blockers}
          error={fieldErrors.blockers?.[0]}
          onChange={(value) => setField("blockers", value)}
        />
        {formError && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-missed"
          >
            <CircleAlert size={16} aria-hidden="true" />
            {formError}
          </p>
        )}
        {hasDayChanged && (
          <button
            type="button"
            className={BUTTON_CLASSES.secondary}
            onClick={() => window.location.reload()}
          >
            Load today&apos;s form
          </button>
        )}
        <div>
          <button
            type="submit"
            disabled={isSubmitting || hasDayChanged}
            className={BUTTON_CLASSES.primary}
          >
            {saved ? "Update today's standup" : "Post standup"}
          </button>
        </div>
      </form>
      <Toast message={toast} />
    </>
  );
}

// AGENTS.md §2 StandupForm. It always files under the current sprint; with no
// current sprint it explains why in place of the fields.
export function StandupForm({
  formDate,
  teamId,
  dateLabel,
  sprintName,
  saved,
}: {
  formDate: string;
  teamId: string;
  dateLabel: string;
  sprintName: string | null;
  saved: SavedStandupView | null;
}) {
  return (
    <section
      id="todays-standup"
      aria-labelledby="todays-standup-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="todays-standup-title" className="text-lg font-semibold">
          Today&apos;s standup
        </h2>
        <p className="text-xs text-text-muted">
          {sprintName === null
            ? dateLabel
            : `${dateLabel}, filed under ${sprintName}`}
        </p>
      </div>
      {sprintName === null ? (
        <p className="text-sm text-text-muted">
          {dateLabel} isn&apos;t in any sprint, so there&apos;s nothing to file
          a standup under. A lead can add one in{" "}
          <Link
            href={`/teams/${teamId}/settings`}
            className="rounded-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Settings
          </Link>
          .
        </p>
      ) : (
        <StandupFields
          key={formDate}
          formDate={formDate}
          teamId={teamId}
          saved={saved}
        />
      )}
    </section>
  );
}
