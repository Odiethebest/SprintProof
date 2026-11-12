import {
  isCourseStaffLogin,
  parseCourseStaffLogins,
} from "@/lib/auth/course-staff";
import { findUserById } from "@/server/repositories/users";

// Course staff are the GitHub logins in COURSE_STAFF_GITHUB_LOGINS (decision
// 006, #116). The login comes from the database, not the session token: when
// another account signs in with a login, the previous holder loses it there at
// once (upsertGithubUser), while their token would keep it until it expires.
export async function isCourseStaff({
  userId,
}: {
  userId: string;
}): Promise<boolean> {
  const courseStaffLogins = parseCourseStaffLogins({
    value: process.env.COURSE_STAFF_GITHUB_LOGINS,
  });
  if (courseStaffLogins.length === 0) {
    return false;
  }
  const user = await findUserById(userId);
  return isCourseStaffLogin({
    githubLogin: user?.githubLogin ?? null,
    courseStaffLogins,
  });
}
