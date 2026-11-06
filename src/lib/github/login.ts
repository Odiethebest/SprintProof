// GitHub logins: 1–39 characters, letters, digits and single hyphens, no
// leading or trailing hyphen. Organization names follow the same rule.
export const GITHUB_LOGIN_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
