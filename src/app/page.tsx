// TODO(#6): redirect to /signin, or to the user's team dashboard, once sign-in exists.
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-2 px-4 py-12 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">SprintProof</h1>
      <p className="text-sm text-text-muted">
        Standups, retros and GitHub activity for your team, in one place.
      </p>
    </main>
  );
}
