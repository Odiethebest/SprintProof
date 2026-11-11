// The StandupForm's answers as typed, one string per field.
export interface StandupFieldValues {
  yesterday: string;
  today: string;
  blockers: string;
}

export type StandupFieldName = keyof StandupFieldValues;

// A standup saved for the form's day. The API stores empty blockers as null.
export interface SavedStandupAnswers {
  yesterday: string;
  today: string;
  blockers: string | null;
}

// One server render of the form: the team's calendar day it files under
// ('YYYY-MM-DD') and the standup already saved for that day.
export interface StandupFormDay {
  formDate: string;
  saved: SavedStandupAnswers | null;
}

export interface StandupFormState<Day extends StandupFormDay> {
  // The day the form shows and sends as its formDate.
  shownDay: Day;
  // The newest day the server rendered.
  latestDay: Day;
  values: StandupFieldValues;
  // What this form last saved for the shown day, until a render brings it back.
  sentValues: StandupFieldValues | null;
  // The API answered 409 STANDUP_DAY_CHANGED for the shown day.
  isDayChangeReported: boolean;
  // The user asked for today's form and the page is refreshing to get it.
  isLoadingToday: boolean;
  // How many times today's form was loaded, so the form moves focus once per load.
  loadCount: number;
}

export type StandupFormEvent<Day extends StandupFormDay> =
  | { type: "SERVER_RENDERED"; day: Day }
  | { type: "FIELD_CHANGED"; name: StandupFieldName; value: string }
  | { type: "STANDUP_SAVED"; values: StandupFieldValues }
  | { type: "DAY_CHANGE_REPORTED" }
  | { type: "LOAD_TODAY_REQUESTED" }
  | { type: "REFRESH_FINISHED" };

function toFieldValues(saved: SavedStandupAnswers | null): StandupFieldValues {
  return {
    yesterday: saved?.yesterday ?? "",
    today: saved?.today ?? "",
    blockers: saved?.blockers ?? "",
  };
}

// The API trims each answer before saving it (lib/standups/standup-input.ts).
function hasSameAnswers(a: StandupFieldValues, b: StandupFieldValues): boolean {
  return (
    a.yesterday.trim() === b.yesterday.trim() &&
    a.today.trim() === b.today.trim() &&
    a.blockers.trim() === b.blockers.trim()
  );
}

export function createStandupFormState<Day extends StandupFormDay>({
  day,
}: {
  day: Day;
}): StandupFormState<Day> {
  return {
    shownDay: day,
    latestDay: day,
    values: toFieldValues(day.saved),
    sentValues: null,
    isDayChangeReported: false,
    isLoadingToday: false,
    loadCount: 0,
  };
}

// Text in the fields that the shown day's standup doesn't hold yet.
export function hasUnsentStandupText<Day extends StandupFormDay>({
  state,
}: {
  state: StandupFormState<Day>;
}): boolean {
  if (hasSameAnswers(state.values, toFieldValues(state.shownDay.saved))) {
    return false;
  }
  return (
    state.sentValues === null || !hasSameAnswers(state.values, state.sentValues)
  );
}

// A render brought a later day than the one the form shows.
export function hasNewerStandupDay<Day extends StandupFormDay>({
  state,
}: {
  state: StandupFormState<Day>;
}): boolean {
  return state.latestDay.formDate !== state.shownDay.formDate;
}

// The shown day is over: saving waits until the user loads today's form.
export function isStandupFormStale<Day extends StandupFormDay>({
  state,
}: {
  state: StandupFormState<Day>;
}): boolean {
  return hasNewerStandupDay({ state }) || state.isDayChangeReported;
}

// The form moves to `day` and keeps whatever is in the fields.
function loadDay<Day extends StandupFormDay>(
  state: StandupFormState<Day>,
  day: Day
): StandupFormState<Day> {
  return {
    ...state,
    shownDay: day,
    latestDay: day,
    sentValues: null,
    isDayChangeReported: false,
    isLoadingToday: false,
    loadCount: state.loadCount + 1,
  };
}

function receiveDay<Day extends StandupFormDay>(
  state: StandupFormState<Day>,
  day: Day
): StandupFormState<Day> {
  if (day.formDate === state.shownDay.formDate) {
    return { ...state, shownDay: day, latestDay: day };
  }
  if (state.isLoadingToday) {
    return loadDay(state, day);
  }
  // #91: a new day never clears unsent text or files it under that day
  // unseen. The form keeps the old day until the user loads today's form.
  if (hasUnsentStandupText({ state }) || state.isDayChangeReported) {
    return { ...state, latestDay: day };
  }
  return {
    ...state,
    shownDay: day,
    latestDay: day,
    values: toFieldValues(day.saved),
    sentValues: null,
  };
}

function requestToday<Day extends StandupFormDay>(
  state: StandupFormState<Day>
): StandupFormState<Day> {
  if (hasNewerStandupDay({ state })) {
    return loadDay(state, state.latestDay);
  }
  if (!state.isDayChangeReported || state.isLoadingToday) {
    return state;
  }
  return { ...state, isLoadingToday: true };
}

// The refresh brought no newer day: the day the form shows is still today.
function finishRefresh<Day extends StandupFormDay>(
  state: StandupFormState<Day>
): StandupFormState<Day> {
  if (!state.isLoadingToday) {
    return state;
  }
  return loadDay(state, state.shownDay);
}

export function updateStandupFormState<Day extends StandupFormDay>({
  state,
  event,
}: {
  state: StandupFormState<Day>;
  event: StandupFormEvent<Day>;
}): StandupFormState<Day> {
  switch (event.type) {
    case "SERVER_RENDERED":
      return receiveDay(state, event.day);
    case "FIELD_CHANGED":
      return {
        ...state,
        values: { ...state.values, [event.name]: event.value },
      };
    case "STANDUP_SAVED":
      return { ...state, sentValues: event.values };
    case "DAY_CHANGE_REPORTED":
      return { ...state, isDayChangeReported: true };
    case "LOAD_TODAY_REQUESTED":
      return requestToday(state);
    case "REFRESH_FINISHED":
      return finishRefresh(state);
  }
}
