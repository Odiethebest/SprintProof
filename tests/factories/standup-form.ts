import type {
  SavedStandupAnswers,
  StandupFieldValues,
  StandupFormDay,
} from "@/lib/standups/standup-form-state";

// One server render of the StandupForm: the team's calendar day it files under.
export function createStandupFormDay(
  overrides: Partial<StandupFormDay> = {}
): StandupFormDay {
  return {
    formDate: "2026-11-03",
    saved: null,
    ...overrides,
  };
}

// A standup already saved for the form's day, as the API stores it.
export function createSavedStandupAnswers(
  overrides: Partial<SavedStandupAnswers> = {}
): SavedStandupAnswers {
  return {
    yesterday: "Sprint planning with requirements (#8).",
    today: "Standup form and history (#9).",
    blockers: null,
    ...overrides,
  };
}

// What someone typed into the form's three fields.
export function createStandupFieldValues(
  overrides: Partial<StandupFieldValues> = {}
): StandupFieldValues {
  return {
    yesterday: "Typed before midnight.",
    today: "Not sent yet.",
    blockers: "",
    ...overrides,
  };
}
