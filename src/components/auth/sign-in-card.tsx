import { CircleAlert } from "lucide-react";
import { SignInButton } from "@/components/auth/sign-in-button";
import { AppMark } from "@/components/ui/app-mark";

interface SignInCardProps {
  callbackPath: string;
  continueMessage: string | null;
  hasError: boolean;
}

export function SignInCard({
  callbackPath,
  continueMessage,
  hasError,
}: SignInCardProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-surface p-4 text-center md:p-6">
      <AppMark size="lg" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to SprintProof
        </h1>
        <p className="text-sm text-text-muted">
          Standups, retros and GitHub activity for your team, in one place.
        </p>
      </div>
      {continueMessage && <p className="text-sm">{continueMessage}</p>}
      {hasError && (
        <p role="alert" className="flex items-center gap-2 text-sm text-missed">
          <CircleAlert size={16} aria-hidden="true" />
          Sign-in didn&apos;t finish. Try again.
        </p>
      )}
      <SignInButton callbackPath={callbackPath} />
      <p className="text-xs text-text-muted">
        No new password. SprintProof uses your GitHub id, login, name and avatar
        so your commits, PRs and reviews show up under your name.
      </p>
    </div>
  );
}
