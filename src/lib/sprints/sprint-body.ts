import { MAX_TEAM_NAME_LENGTH } from "@/lib/teams/create-team";
import { noNul } from "@/lib/validation/text";
import { z } from "zod";

export const DEFAULT_STANDUPS_PER_PERSON = 3;
export const DEFAULT_REVIEWS_PER_PERSON = 5;

// Shape and types only. Value rules (blank name, calendar dates, 1–20, overlap)
// stay in validateSprint, which the form also runs, so both show one message.
function textField({
  requiredMessage,
  typeMessage,
}: {
  requiredMessage: string;
  typeMessage: string;
}) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined ? requiredMessage : typeMessage,
    })
    .check(noNul);
}

const nameField = textField({
  requiredMessage: "Sprint name is required.",
  typeMessage: "Sprint name must be text.",
})
  .trim()
  .max(
    MAX_TEAM_NAME_LENGTH,
    `Use ${MAX_TEAM_NAME_LENGTH} characters or fewer.`
  );
const startDateField = textField({
  requiredMessage: "Start date is required.",
  typeMessage: "Start date must be a valid calendar date in YYYY-MM-DD format.",
});
const endDateField = textField({
  requiredMessage: "End date is required.",
  typeMessage: "End date must be a valid calendar date in YYYY-MM-DD format.",
});
const standupsField = z.number({
  error: "Standups per person must be an integer.",
});
const reviewsField = z.number({
  error: "Reviews per person must be an integer.",
});

const OBJECT_MESSAGE = "Send the sprint as a JSON object.";

export const createSprintSchema = z.object(
  {
    name: nameField,
    startDate: startDateField,
    endDate: endDateField,
    standupsPerPerson: standupsField.default(DEFAULT_STANDUPS_PER_PERSON),
    reviewsPerPerson: reviewsField.default(DEFAULT_REVIEWS_PER_PERSON),
  },
  { error: OBJECT_MESSAGE }
);

// No defaults: an edit that leaves a field out keeps the stored value.
export const updateSprintSchema = z.object(
  {
    name: nameField.optional(),
    startDate: startDateField.optional(),
    endDate: endDateField.optional(),
    standupsPerPerson: standupsField.optional(),
    reviewsPerPerson: reviewsField.optional(),
  },
  { error: OBJECT_MESSAGE }
);
