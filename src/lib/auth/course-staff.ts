// Course staff create and revoke instructor invite links on any team (decision
// 006, #116). They are listed by GitHub login in COURSE_STAFF_GITHUB_LOGINS,
// comma-separated; empty or unset lists nobody.

// Lowercased, because GitHub logins ignore case.
export function parseCourseStaffLogins({
  value,
}: {
  value: string | undefined;
}): string[] {
  if (value === undefined) {
    return [];
  }
  return value
    .split(",")
    .map((login) => login.trim().toLowerCase())
    .filter((login) => login !== "");
}

// courseStaffLogins comes from parseCourseStaffLogins().
export function isCourseStaffLogin({
  githubLogin,
  courseStaffLogins,
}: {
  githubLogin: string | null;
  courseStaffLogins: readonly string[];
}): boolean {
  if (githubLogin === null) {
    return false;
  }
  return courseStaffLogins.includes(githubLogin.toLowerCase());
}
