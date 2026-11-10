import { MAX_TEAM_NAME_LENGTH } from "@/lib/teams/create-team";
import { databaseTextSchema } from "@/lib/validation/text";

export type SprintErrorField =
  "name" | "startDate" | "endDate" | "standupsPerPerson" | "reviewsPerPerson";

export interface SprintValidationError {
  field: SprintErrorField;
  code: string;
  message: string;
}

export interface SprintInput {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
}

export interface ExistingSprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface ValidateSprintOptions {
  sprint: SprintInput;
  existingSprints: ExistingSprint[];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDaysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

function isValidCalendarDate(dateStr: unknown): boolean {
  if (typeof dateStr !== "string") {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return false;
  }
  const maxDays = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDays;
}

export function validateSprint(
  options: ValidateSprintOptions
): SprintValidationError[] {
  const { sprint, existingSprints } = options;
  const errors: SprintValidationError[] = [];

  if (!sprint.name || sprint.name.trim().length === 0) {
    errors.push({
      field: "name",
      code: "REQUIRED",
      message: "Sprint name is required.",
    });
  }

  if (
    sprint.name &&
    (!databaseTextSchema.safeParse(sprint.name).success ||
      [...sprint.name.trim()].length > MAX_TEAM_NAME_LENGTH)
  ) {
    errors.push({
      field: "name",
      code: "INVALID_NAME",
      message: `Use ${MAX_TEAM_NAME_LENGTH} characters or fewer, without NUL characters.`,
    });
  }

  const isStartValid = isValidCalendarDate(sprint.startDate);
  if (!isStartValid) {
    errors.push({
      field: "startDate",
      code: "INVALID_DATE_FORMAT",
      message: "Start date must be a valid calendar date in YYYY-MM-DD format.",
    });
  }

  const isEndValid = isValidCalendarDate(sprint.endDate);
  if (!isEndValid) {
    errors.push({
      field: "endDate",
      code: "INVALID_DATE_FORMAT",
      message: "End date must be a valid calendar date in YYYY-MM-DD format.",
    });
  }

  if (isStartValid && isEndValid) {
    if (sprint.endDate < sprint.startDate) {
      errors.push({
        field: "endDate",
        code: "END_DATE_BEFORE_START",
        message: "End date cannot be before start date.",
      });
    } else {
      for (const existing of existingSprints) {
        if (sprint.id && sprint.id === existing.id) {
          continue;
        }
        if (
          sprint.startDate <= existing.endDate &&
          sprint.endDate >= existing.startDate
        ) {
          errors.push({
            field: "startDate",
            code: "OVERLAPPING_SPRINT",
            message: `Dates overlap with existing sprint "${existing.name}".`,
          });
        }
      }
    }
  }

  if (
    typeof sprint.standupsPerPerson !== "number" ||
    Number.isNaN(sprint.standupsPerPerson) ||
    !Number.isInteger(sprint.standupsPerPerson)
  ) {
    errors.push({
      field: "standupsPerPerson",
      code: "INVALID_INTEGER",
      message: "Standups per person must be an integer.",
    });
  } else if (sprint.standupsPerPerson < 1 || sprint.standupsPerPerson > 20) {
    errors.push({
      field: "standupsPerPerson",
      code: "OUT_OF_RANGE",
      message: "Standups per person must be between 1 and 20.",
    });
  }

  if (
    typeof sprint.reviewsPerPerson !== "number" ||
    Number.isNaN(sprint.reviewsPerPerson) ||
    !Number.isInteger(sprint.reviewsPerPerson)
  ) {
    errors.push({
      field: "reviewsPerPerson",
      code: "INVALID_INTEGER",
      message: "Reviews per person must be an integer.",
    });
  } else if (sprint.reviewsPerPerson < 1 || sprint.reviewsPerPerson > 20) {
    errors.push({
      field: "reviewsPerPerson",
      code: "OUT_OF_RANGE",
      message: "Reviews per person must be between 1 and 20.",
    });
  }

  return errors;
}
