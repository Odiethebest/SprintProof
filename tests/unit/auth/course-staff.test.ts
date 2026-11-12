import { describe, expect, it } from "vitest";
import {
  isCourseStaffLogin,
  parseCourseStaffLogins,
} from "@/lib/auth/course-staff";

describe("parseCourseStaffLogins", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["only spaces and commas", "  , ,  "],
  ])("lists nobody when the variable is %s", (_label, value) => {
    // Act
    const logins = parseCourseStaffLogins({ value });

    // Assert
    expect(logins).toEqual([]);
  });

  it("splits on commas and trims the spaces around each login", () => {
    // Act
    const logins = parseCourseStaffLogins({
      value: " ta-alice ,prof-bob,  grader-carol  ",
    });

    // Assert
    expect(logins).toEqual(["ta-alice", "prof-bob", "grader-carol"]);
  });

  it("lowercases logins, because GitHub logins ignore case", () => {
    // Act
    const logins = parseCourseStaffLogins({ value: "TA-Alice,Prof-Bob" });

    // Assert
    expect(logins).toEqual(["ta-alice", "prof-bob"]);
  });

  it("skips empty entries between commas", () => {
    // Act
    const logins = parseCourseStaffLogins({ value: "ta-alice,,prof-bob," });

    // Assert
    expect(logins).toEqual(["ta-alice", "prof-bob"]);
  });
});

describe("isCourseStaffLogin", () => {
  it("is true for a listed login", () => {
    // Act
    const isStaff = isCourseStaffLogin({
      githubLogin: "ta-alice",
      courseStaffLogins: ["prof-bob", "ta-alice"],
    });

    // Assert
    expect(isStaff).toBe(true);
  });

  it("matches a login without regard to case", () => {
    // Arrange
    const courseStaffLogins = parseCourseStaffLogins({ value: "ta-alice" });

    // Act
    const isStaff = isCourseStaffLogin({
      githubLogin: "TA-Alice",
      courseStaffLogins,
    });

    // Assert
    expect(isStaff).toBe(true);
  });

  it("is false for a login that isn't listed", () => {
    // Act
    const isStaff = isCourseStaffLogin({
      githubLogin: "ziqi",
      courseStaffLogins: ["ta-alice"],
    });

    // Assert
    expect(isStaff).toBe(false);
  });

  it("is false for a login that only contains a listed one", () => {
    // Act
    const isStaff = isCourseStaffLogin({
      githubLogin: "ta-alice-2",
      courseStaffLogins: ["ta-alice"],
    });

    // Assert
    expect(isStaff).toBe(false);
  });

  it("is false for everyone when nobody is listed", () => {
    // Act
    const isStaff = isCourseStaffLogin({
      githubLogin: "ta-alice",
      courseStaffLogins: [],
    });

    // Assert
    expect(isStaff).toBe(false);
  });

  it("is false for a user without a GitHub login", () => {
    // Act
    const isStaff = isCourseStaffLogin({
      githubLogin: null,
      courseStaffLogins: ["ta-alice"],
    });

    // Assert
    expect(isStaff).toBe(false);
  });
});
