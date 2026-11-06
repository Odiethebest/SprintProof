import { getSession } from "@/server/auth-session";

// The signed-in user as pages show them, or null when signed out.
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  const { id, name, githubLogin } = session.user;
  return {
    id,
    githubLogin,
    displayName: name ?? githubLogin ?? "Your account",
  };
}
