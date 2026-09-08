"use client";

import { useState, useTransition, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/app/actions";

type Mode = "login" | "register";

export default function AuthClient({
  googleReady,
}: {
  googleReady: boolean;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Email o contraseña incorrectos");
      } else {
        router.refresh();
      }
    });
  }

  function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await registerUser(fd);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  async function handleGoogle() {
    await signIn("google");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="glass choreo-auth w-full max-w-sm p-8">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-foreground">
          OpenFinances
        </h1>
        <p className="mb-8 text-center text-sm text-muted">
          Controlá tus finanzas personales
        </p>

        {googleReady && (
          <form onSubmit={(e) => { e.preventDefault(); handleGoogle(); }}>
            <button
              type="submit"
              disabled={isPending}
              className="pressable flex min-h-[44px] w-full items-center justify-center gap-3 rounded-xl border border-card-border bg-card/60 px-4 py-3 text-sm font-medium text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-card/80 disabled:opacity-40"
            >
              <GoogleIcon />
              Continuar con Google
            </button>
          </form>
        )}

        {!googleReady && (
          <p className="rounded-xl border border-card-border bg-card/40 p-4 text-center text-xs text-muted">
            Google OAuth no configurado.
          </p>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-card-border" />
          <span className="text-xs text-muted-subtle">o</span>
          <div className="h-px flex-1 bg-card-border" />
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <InputField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
            />
            <InputField
              label="Contraseña"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
            />
            {error && (
              <p className="rounded-xl border border-expense/20 bg-expense/10 px-3 py-2 text-xs text-expense">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="pressable min-h-[44px] w-full rounded-xl bg-secondary text-sm font-semibold text-foreground transition-opacity duration-[var(--duration-fast)] hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? "Entrando…" : "Entrar"}
            </button>
            <p className="text-center text-xs text-muted">
              ¿No tenés cuenta?{" "}
              <button
                type="button"
                onClick={() => { setMode("register"); setError(null); }}
                className="pressable font-semibold text-secondary transition-opacity duration-[var(--duration-fast)] hover:opacity-80"
              >
                Crear cuenta
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <InputField
              label="Nombre"
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={60}
              disabled={isPending}
            />
            <InputField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
            />
            <div>
              <InputField
                label="Contraseña"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={isPending}
              />
              <p className="mt-1 text-xs text-muted-subtle">
                Mínimo 8 caracteres
              </p>
            </div>
            {error && (
              <p className="rounded-xl border border-expense/20 bg-expense/10 px-3 py-2 text-xs text-expense">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="pressable min-h-[44px] w-full rounded-xl bg-secondary text-sm font-semibold text-foreground transition-opacity duration-[var(--duration-fast)] hover:opacity-90 disabled:opacity-40"
            >
              {isPending ? "Creando cuenta…" : "Crear cuenta"}
            </button>
            <p className="text-center text-xs text-muted">
              ¿Ya tenés cuenta?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                className="pressable font-semibold text-secondary transition-opacity duration-[var(--duration-fast)] hover:opacity-80"
              >
                Entrar
              </button>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InputField({
  label,
  name,
  type,
  autoComplete,
  required,
  minLength,
  maxLength,
  disabled,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-xs font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        disabled={disabled}
        className="h-[44px] w-full rounded-xl border border-card-border bg-background px-3 text-base text-foreground placeholder:text-muted-subtle focus:border-secondary focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
