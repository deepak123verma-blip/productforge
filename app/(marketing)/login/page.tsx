import Link from "next/link";
import { LoginForm } from "../../../components/store/LoginForm";

/** Magic-link sign-in. No passwords, ever. Send is stubbed (registry: "auth"). */
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-loose p-tight min-[640px]:p-loose">
      <header className="flex flex-col gap-tight">
        <Link href="/" className="font-display text-display-s font-bold tracking-[-0.02em] text-ink">
          ProductForge
        </Link>
        <h1 className="font-display text-display-m font-bold tracking-[-0.02em] text-ink">Sign in</h1>
        <p className="text-body text-ink-2">No password. We email you a link that signs you in.</p>
      </header>
      <LoginForm />
    </main>
  );
}
