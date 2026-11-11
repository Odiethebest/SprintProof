"use client";

import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { countStandupCharacters } from "@/lib/standups/character-count";
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
  createStandupFormState,
  hasNewerStandupDay,
  isStandupFormStale,
  updateStandupFormState,
  type StandupFieldName,
  type StandupFormEvent,
  type StandupFormState,
} from "@/lib/standups/standup-form-state";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { useAnnounce } from "@/components/ui/page-announcer";

type FieldErrors = Partial<Record<StandupFieldName, string[]>>;

// Focus goes to the first invalid field in the order they appear.
const FIELD_ORDER: StandupFieldName[] = ["yesterday", "today", "blockers"];

// The API's 409 STANDUP_DAY_CHANGED message. A live refresh that brings a new
// day shows it too, before anything is sent.
const DAY_CHANGED_MESSAGE =
  "The day has changed. Load today's form before saving.";

// DESIGN.md §7 Forms: the border turns `missed` on error.
const TEXTAREA_CLASSES = {
  valid:
    "w-full resize-y rounded-md border border-form-control-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  invalid:
    "w-full resize-y rounded-md border border-missed bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

export interface SavedStandupView {
  yesterday: string;
  today: string;
  blockers: string | null;
  postedAtLabel: string;
}

// One server render of the form, with the labels it shows for that day.
interface StandupFormDayView {
  formDate: string;
  dateLabel: string;
  sprintName: string | null;
  saved: SavedStandupView | null;
}

type FormState = StandupFormState<StandupFormDayView>;

function reduceStandupForm(
  state: FormState,
  event: StandupFormEvent<StandupFormDayView>
): FormState {
  return updateStandupFormState({ state, event });
}

function StandupField({
  name,
  label,
  placeholder,
  value,
  error,
  onChange,
}: {
  name: StandupFieldName;
  label: ReactNode;
  placeholder: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const characterCount = countStandupCharacters({ value });
  const isOverLimit = characterCount > MAX_STANDUP_FIELD_LENGTH;
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
          {characterCount} / {MAX_STANDUP_FIELD_LENGTH}
        </p>
      </div>
    </div>
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
  const router = useRouter();
  // The Standups page's single live region, shared with teammates' updates.
  const announce = useAnnounce();
  const [state, dispatch] = useReducer(
    reduceStandupForm,
    { formDate, dateLabel, sprintName, saved },
    (day) => createStandupFormState({ day })
  );
  const [isRefreshing, startRefresh] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const loadButtonRef = useRef<HTMLButtonElement>(null);
  // Effects run again when Back shows a page that Cache Components kept
  // hidden, so remember which load already moved focus.
  const focusedLoadCount = useRef(state.loadCount);
  const noticeId = useId();

  // #91: every refresh (after posting, or a live one from TeamLiveProvider)
  // goes through the form's state, which keeps unsent text when a new day
  // arrives instead of starting over.
  const latest = state.latestDay;
  if (
    formDate !== latest.formDate ||
    dateLabel !== latest.dateLabel ||
    sprintName !== latest.sprintName ||
    saved !== latest.saved
  ) {
    dispatch({
      type: "SERVER_RENDERED",
      day: { formDate, dateLabel, sprintName, saved },
    });
  } else if (state.isLoadingToday && !isRefreshing) {
    dispatch({ type: "REFRESH_FINISHED" });
  }

  const day = state.shownDay;
  const isStale = isStandupFormStale({ state });

  // After loading today's form: the button that asked for it is gone, so
  // focus goes to the first field and the new date is announced.
  useEffect(() => {
    if (state.loadCount === focusedLoadCount.current) {
      return;
    }
    focusedLoadCount.current = state.loadCount;
    const field = formRef.current?.elements.namedItem("yesterday");
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
    } else {
      headingRef.current?.focus();
    }
    announce(`Loaded today's form for ${day.dateLabel}.`);
  }, [state.loadCount, day.dateLabel, announce]);

  function setField(name: StandupFieldName, value: string) {
    dispatch({ type: "FIELD_CHANGED", name, value });
  }

  function loadToday() {
    if (state.isLoadingToday) {
      return;
    }
    setFormError(null);
    const hasNewerDay = hasNewerStandupDay({ state });
    dispatch({ type: "LOAD_TODAY_REQUESTED" });
    // Only the server knows today's date and sprint, so ask it again.
    if (!hasNewerDay) {
      startRefresh(() => router.refresh());
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Rule R2 (#73, #91): text typed on an earlier day is never filed under
    // a new day the form hasn't shown.
    if (isStale) {
      return;
    }
    const form = event.currentTarget;
    const values = state.values;
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
        body: JSON.stringify({ ...parsed.data, formDate: day.formDate }),
      });
      if (response.ok) {
        dispatch({ type: "STANDUP_SAVED", values });
        announce(
          response.status === 201 ? "Standup posted." : "Standup updated."
        );
        router.refresh();
      } else {
        const error = await readApiError(response);
        if (error.code === "STANDUP_DAY_CHANGED") {
          flushSync(() => dispatch({ type: "DAY_CHANGE_REPORTED" }));
          // The submit button is disabled now; the next step is loading today's form.
          loadButtonRef.current?.focus();
        } else {
          setFormError(error.message);
        }
      }
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    }
    setIsSubmitting(false);
  }

  return (
    <section
      id="todays-standup"
      aria-labelledby="todays-standup-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          id="todays-standup-title"
          tabIndex={-1}
          className="rounded-sm text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Today&apos;s standup
        </h2>
        <p className="text-xs text-text-muted">
          {day.sprintName === null
            ? day.dateLabel
            : `${day.dateLabel}, filed under ${day.sprintName}`}
        </p>
      </div>
      {day.sprintName === null ? (
        <p className="text-sm text-text-muted">
          {day.dateLabel} isn&apos;t in any sprint, so there&apos;s nothing to
          file a standup under. A lead can add one in{" "}
          <Link
            href={`/teams/${teamId}/settings`}
            className="rounded-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Settings
          </Link>
          .
        </p>
      ) : (
        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {day.saved && (
            <p className="flex items-center gap-2 text-sm">
              <CircleCheck size={16} aria-hidden="true" className="text-met" />
              Posted at {day.saved.postedAtLabel}. Saving again updates it.
            </p>
          )}
          <StandupField
            name="yesterday"
            label="Yesterday"
            placeholder="What you worked on"
            value={state.values.yesterday}
            error={fieldErrors.yesterday?.[0]}
            onChange={(value) => setField("yesterday", value)}
          />
          <StandupField
            name="today"
            label="Today"
            placeholder="What you plan to work on"
            value={state.values.today}
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
            value={state.values.blockers}
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
          {isStale && (
            <>
              <p
                id={noticeId}
                role="alert"
                className="flex items-center gap-2 text-sm text-missed"
              >
                <CircleAlert size={16} aria-hidden="true" />
                {DAY_CHANGED_MESSAGE}
              </p>
              <button
                ref={loadButtonRef}
                type="button"
                aria-describedby={noticeId}
                className={BUTTON_CLASSES.secondary}
                onClick={loadToday}
              >
                Load today&apos;s form
              </button>
            </>
          )}
          <div>
            <button
              type="submit"
              disabled={isSubmitting || isStale}
              className={BUTTON_CLASSES.primary}
            >
              {day.saved ? "Update today's standup" : "Post standup"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
