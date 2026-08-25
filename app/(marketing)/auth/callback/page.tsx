import { Button } from "../../../../components/primitives/Button";
import { NotYetWired } from "../../../../components/primitives/NotYetWired";

/**
 * The magic-link landing. Live: verifies the token and establishes the
 * session before redirecting. Offline: shows the success state and links
 * through to the fixture session's dashboard.
 */
export default function AuthCallbackPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-gap p-tight min-[640px]:p-loose">
      <div className="flex flex-col items-start gap-tight rounded-card bg-mint p-loose">
        <h1 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">You're in</h1>
        <p className="text-body text-ink-2">Signed in as the preview creator. This screen verifies your link once live services connect.</p>
        <Button href="/home">Go to your dashboard</Button>
        <NotYetWired stubId="auth" />
      </div>
    </main>
  );
}
