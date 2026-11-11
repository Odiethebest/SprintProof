import { describe, expect, it } from "vitest";
import {
  createStandupFormState,
  hasNewerStandupDay,
  hasUnsentStandupText,
  isStandupFormStale,
  updateStandupFormState,
  type StandupFieldValues,
  type StandupFormDay,
  type StandupFormEvent,
  type StandupFormState,
} from "@/lib/standups/standup-form-state";
import {
  createSavedStandupAnswers,
  createStandupFieldValues,
  createStandupFormDay,
} from "../../factories/standup-form";

const NOV_3 = "2026-11-03";
const NOV_4 = "2026-11-04";
const EMPTY_FIELDS: StandupFieldValues = {
  yesterday: "",
  today: "",
  blockers: "",
};

type Day = StandupFormDay;

function apply(
  state: StandupFormState<Day>,
  events: StandupFormEvent<Day>[]
): StandupFormState<Day> {
  return events.reduce(
    (current, event) => updateStandupFormState({ state: current, event }),
    state
  );
}

function typing(values: StandupFieldValues): StandupFormEvent<Day>[] {
  return [
    { type: "FIELD_CHANGED", name: "yesterday", value: values.yesterday },
    { type: "FIELD_CHANGED", name: "today", value: values.today },
    { type: "FIELD_CHANGED", name: "blockers", value: values.blockers },
  ];
}

function rendered(day: Day): StandupFormEvent<Day> {
  return { type: "SERVER_RENDERED", day };
}

describe("createStandupFormState", () => {
  it("starts on the rendered day with empty fields when nothing is saved", () => {
    // Arrange
    const nov3 = createStandupFormDay({ formDate: NOV_3 });

    // Act
    const state = createStandupFormState({ day: nov3 });

    // Assert
    expect(state.shownDay).toBe(nov3);
    expect(state.values).toEqual(EMPTY_FIELDS);
  });

  it("starts with the saved answers, and an empty blockers field when none were saved", () => {
    // Arrange
    const saved = createSavedStandupAnswers({ blockers: null });
    const nov3 = createStandupFormDay({ formDate: NOV_3, saved });

    // Act
    const state = createStandupFormState({ day: nov3 });

    // Assert
    expect(state.values).toEqual({
      yesterday: saved.yesterday,
      today: saved.today,
      blockers: "",
    });
  });

  it("starts up to date, with no unsent text", () => {
    // Act
    const state = createStandupFormState({ day: createStandupFormDay() });

    // Assert
    expect(isStandupFormStale({ state })).toBe(false);
    expect(hasNewerStandupDay({ state })).toBe(false);
    expect(hasUnsentStandupText({ state })).toBe(false);
    expect(state.isLoadingToday).toBe(false);
    expect(state.loadCount).toBe(0);
  });
});

describe("updateStandupFormState", () => {
  describe("typing", () => {
    it("changes only the field that was edited", () => {
      // Arrange
      const state = createStandupFormState({ day: createStandupFormDay() });

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "FIELD_CHANGED", name: "today", value: "Review #9." },
      });

      // Assert
      expect(next.values).toEqual({ ...EMPTY_FIELDS, today: "Review #9." });
    });

    it("counts text that differs from the saved standup as unsent", () => {
      // Arrange
      const saved = createSavedStandupAnswers();
      const state = createStandupFormState({
        day: createStandupFormDay({ saved }),
      });

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "FIELD_CHANGED", name: "today", value: "Changed plan." },
      });

      // Assert
      expect(hasUnsentStandupText({ state: next })).toBe(true);
    });

    it("ignores spaces around the answers, which the API trims", () => {
      // Arrange
      const saved = createSavedStandupAnswers({ blockers: null });
      const state = createStandupFormState({
        day: createStandupFormDay({ saved }),
      });

      // Act
      const next = apply(
        state,
        typing({
          yesterday: `  ${saved.yesterday}\n`,
          today: `${saved.today} `,
          blockers: "   ",
        })
      );

      // Assert
      expect(hasUnsentStandupText({ state: next })).toBe(false);
    });

    it("doesn't count text as unsent once this form has sent it", () => {
      // Arrange
      const values = createStandupFieldValues();
      const typed = apply(
        createStandupFormState({ day: createStandupFormDay() }),
        typing(values)
      );

      // Act
      const sent = updateStandupFormState({
        state: typed,
        event: { type: "STANDUP_SAVED", values },
      });

      // Assert
      expect(hasUnsentStandupText({ state: sent })).toBe(false);
    });

    it("counts text typed after sending as unsent", () => {
      // Arrange
      const values = createStandupFieldValues();
      const sent = apply(
        createStandupFormState({ day: createStandupFormDay() }),
        [...typing(values), { type: "STANDUP_SAVED", values }]
      );

      // Act
      const next = updateStandupFormState({
        state: sent,
        event: { type: "FIELD_CHANGED", name: "blockers", value: "Waiting." },
      });

      // Assert
      expect(hasUnsentStandupText({ state: next })).toBe(true);
    });
  });

  describe("a render for the same day", () => {
    it("shows the standup saved since and keeps what's in the fields", () => {
      // Arrange
      const values = createStandupFieldValues({ blockers: "" });
      const nov3 = createStandupFormDay({ formDate: NOV_3 });
      const state = apply(createStandupFormState({ day: nov3 }), [
        ...typing(values),
        { type: "STANDUP_SAVED", values },
      ]);
      const nov3Saved = createStandupFormDay({
        formDate: NOV_3,
        saved: createSavedStandupAnswers({
          yesterday: values.yesterday,
          today: values.today,
          blockers: null,
        }),
      });

      // Act
      const next = updateStandupFormState({
        state,
        event: rendered(nov3Saved),
      });

      // Assert
      expect(next.shownDay).toBe(nov3Saved);
      expect(next.values).toEqual(values);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });
  });

  describe("a render for a new day", () => {
    it("moves an empty form to the new day", () => {
      // Arrange
      const nov4 = createStandupFormDay({ formDate: NOV_4 });
      const state = createStandupFormState({
        day: createStandupFormDay({ formDate: NOV_3 }),
      });

      // Act
      const next = updateStandupFormState({ state, event: rendered(nov4) });

      // Assert
      expect(next.shownDay).toBe(nov4);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });

    it("moves a form holding only the saved standup to the new day, with that day's empty fields", () => {
      // Arrange
      const nov3 = createStandupFormDay({
        formDate: NOV_3,
        saved: createSavedStandupAnswers(),
      });
      const nov4 = createStandupFormDay({ formDate: NOV_4 });
      const state = createStandupFormState({ day: nov3 });

      // Act
      const next = updateStandupFormState({ state, event: rendered(nov4) });

      // Assert
      expect(next.shownDay).toBe(nov4);
      expect(next.values).toEqual(EMPTY_FIELDS);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });

    it("moves to the new day when the fields hold only what this form sent before midnight", () => {
      // Arrange: the refresh after posting comes back after midnight
      const values = createStandupFieldValues();
      const nov4 = createStandupFormDay({ formDate: NOV_4 });
      const state = apply(
        createStandupFormState({
          day: createStandupFormDay({ formDate: NOV_3 }),
        }),
        [...typing(values), { type: "STANDUP_SAVED", values }]
      );

      // Act
      const next = updateStandupFormState({ state, event: rendered(nov4) });

      // Assert
      expect(next.shownDay).toBe(nov4);
      expect(next.values).toEqual(EMPTY_FIELDS);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });

    it("keeps the old day and the unsent text, and asks for today's form", () => {
      // Arrange
      const values = createStandupFieldValues();
      const nov3 = createStandupFormDay({ formDate: NOV_3 });
      const nov4 = createStandupFormDay({ formDate: NOV_4 });
      const state = apply(
        createStandupFormState({ day: nov3 }),
        typing(values)
      );

      // Act
      const next = updateStandupFormState({ state, event: rendered(nov4) });

      // Assert
      expect(next.shownDay).toBe(nov3);
      expect(next.latestDay).toBe(nov4);
      expect(next.values).toEqual(values);
      expect(hasNewerStandupDay({ state: next })).toBe(true);
      expect(isStandupFormStale({ state: next })).toBe(true);
    });

    it("keeps filing unsent text under the old day until today's form is loaded", () => {
      // Arrange
      const state = apply(
        createStandupFormState({
          day: createStandupFormDay({ formDate: NOV_3 }),
        }),
        [
          ...typing(createStandupFieldValues()),
          rendered(createStandupFormDay({ formDate: NOV_4 })),
        ]
      );

      // Act: more typing while the form asks for today's form
      const next = updateStandupFormState({
        state,
        event: { type: "FIELD_CHANGED", name: "today", value: "Still typing." },
      });

      // Assert
      expect(next.shownDay.formDate).toBe(NOV_3);
      expect(isStandupFormStale({ state: next })).toBe(true);
    });

    it("keeps the old day after a day-changed answer, even when the text was saved", () => {
      // Arrange: posting the saved standup again after midnight got a 409
      const saved = createSavedStandupAnswers();
      const nov3 = createStandupFormDay({ formDate: NOV_3, saved });
      const state = apply(createStandupFormState({ day: nov3 }), [
        { type: "DAY_CHANGE_REPORTED" },
      ]);

      // Act
      const next = updateStandupFormState({
        state,
        event: rendered(createStandupFormDay({ formDate: NOV_4 })),
      });

      // Assert
      expect(next.shownDay).toBe(nov3);
      expect(next.values.today).toBe(saved.today);
      expect(isStandupFormStale({ state: next })).toBe(true);
    });
  });

  describe("a day-changed answer from the API", () => {
    it("asks for today's form before a new day has been rendered", () => {
      // Arrange
      const nov3 = createStandupFormDay({ formDate: NOV_3 });
      const state = apply(
        createStandupFormState({ day: nov3 }),
        typing(createStandupFieldValues())
      );

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "DAY_CHANGE_REPORTED" },
      });

      // Assert
      expect(next.shownDay).toBe(nov3);
      expect(hasNewerStandupDay({ state: next })).toBe(false);
      expect(isStandupFormStale({ state: next })).toBe(true);
    });
  });

  describe("loading today's form", () => {
    it("shows a newer day right away and keeps the unsent text", () => {
      // Arrange
      const values = createStandupFieldValues();
      const nov4 = createStandupFormDay({ formDate: NOV_4 });
      const state = apply(
        createStandupFormState({
          day: createStandupFormDay({ formDate: NOV_3 }),
        }),
        [...typing(values), rendered(nov4)]
      );

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "LOAD_TODAY_REQUESTED" },
      });

      // Assert
      expect(next.shownDay).toBe(nov4);
      expect(next.values).toEqual(values);
      expect(next.isLoadingToday).toBe(false);
      expect(next.loadCount).toBe(1);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });

    it("waits for the refresh when no newer day has been rendered yet", () => {
      // Arrange
      const nov3 = createStandupFormDay({ formDate: NOV_3 });
      const state = apply(createStandupFormState({ day: nov3 }), [
        ...typing(createStandupFieldValues()),
        { type: "DAY_CHANGE_REPORTED" },
      ]);

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "LOAD_TODAY_REQUESTED" },
      });

      // Assert
      expect(next.isLoadingToday).toBe(true);
      expect(next.shownDay).toBe(nov3);
      expect(next.loadCount).toBe(0);
      expect(isStandupFormStale({ state: next })).toBe(true);
    });

    it("shows the new day the refresh brings, with the unsent text", () => {
      // Arrange
      const values = createStandupFieldValues();
      const nov4 = createStandupFormDay({ formDate: NOV_4 });
      const state = apply(
        createStandupFormState({
          day: createStandupFormDay({ formDate: NOV_3 }),
        }),
        [
          ...typing(values),
          { type: "DAY_CHANGE_REPORTED" },
          { type: "LOAD_TODAY_REQUESTED" },
        ]
      );

      // Act
      const next = updateStandupFormState({ state, event: rendered(nov4) });

      // Assert
      expect(next.shownDay).toBe(nov4);
      expect(next.values).toEqual(values);
      expect(next.isLoadingToday).toBe(false);
      expect(next.loadCount).toBe(1);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });

    it("clears the day-changed notice when the refresh brings the same day back", () => {
      // Arrange
      const values = createStandupFieldValues();
      const state = apply(
        createStandupFormState({
          day: createStandupFormDay({ formDate: NOV_3 }),
        }),
        [
          ...typing(values),
          { type: "DAY_CHANGE_REPORTED" },
          { type: "LOAD_TODAY_REQUESTED" },
          rendered(createStandupFormDay({ formDate: NOV_3 })),
        ]
      );

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "REFRESH_FINISHED" },
      });

      // Assert
      expect(next.shownDay.formDate).toBe(NOV_3);
      expect(next.values).toEqual(values);
      expect(next.isLoadingToday).toBe(false);
      expect(next.loadCount).toBe(1);
      expect(isStandupFormStale({ state: next })).toBe(false);
    });

    it("does nothing while the form is up to date", () => {
      // Arrange
      const state = createStandupFormState({ day: createStandupFormDay() });

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "LOAD_TODAY_REQUESTED" },
      });

      // Assert
      expect(next).toBe(state);
    });

    it("ignores a finished refresh it didn't ask for", () => {
      // Arrange
      const state = createStandupFormState({ day: createStandupFormDay() });

      // Act
      const next = updateStandupFormState({
        state,
        event: { type: "REFRESH_FINISHED" },
      });

      // Assert
      expect(next).toBe(state);
    });
  });
});
