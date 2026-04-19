"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Command,
  Gauge,
  LockKeyhole,
  Radar,
  Target,
  type LucideIcon,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

const authCopy: Record<
  AuthMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    buttonLabel: string;
    switchText: string;
    switchHref: string;
    switchLabel: string;
  }
> = {
  login: {
    eyebrow: "Secure workspace",
    title: "Sign in to CounterOS",
    description: "Enter the workspace connected to your competitor intelligence system.",
    buttonLabel: "Sign in",
    switchText: "New to CounterOS?",
    switchHref: "/signup",
    switchLabel: "Create an account"
  },
  signup: {
    eyebrow: "Create workspace",
    title: "Start your CounterOS account",
    description: "Create a private founder workspace with an email and password.",
    buttonLabel: "Create account",
    switchText: "Already have an account?",
    switchHref: "/login",
    switchLabel: "Sign in"
  }
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const copy = authCopy[mode];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = name.trim();

      if (isSignup) {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            email: normalizedEmail,
            password,
            ...(trimmedName ? { name: trimmedName } : {})
          })
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setError(payload?.error ?? "Could not create account.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#c5ccd3] p-8 text-foreground max-[760px]:p-0">
      <section className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-[1500px] grid-cols-[minmax(0,1fr)_minmax(360px,440px)] items-center gap-10 rounded-[30px] bg-background px-10 py-10 shadow-[0_28px_80px_rgba(42,48,56,0.18)] max-[920px]:grid-cols-1 max-[760px]:min-h-screen max-[760px]:rounded-none max-[560px]:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_25px_rgba(105,88,232,0.25)]">
              <Command className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="m-0 text-lg font-semibold leading-tight">CounterOS</p>
              <p className="m-0 mt-1 text-sm text-muted-foreground">
                Competitive intelligence workspace
              </p>
            </div>
          </div>

          <div className="mt-12 max-w-[660px] max-[920px]:mt-8">
            <Badge variant="outline" className="mb-5 gap-1.5 bg-card">
              <Radar className="size-3.5" aria-hidden="true" />
              Founder command center
            </Badge>
            <h1 className="m-0 max-w-[660px] text-[clamp(2.35rem,5.5vw,4.75rem)] font-semibold leading-[0.98] tracking-tight max-[560px]:text-[34px] max-[560px]:leading-tight">
              Know which competitor move matters next.
            </h1>
            <p className="m-0 mt-5 max-w-[560px] text-base leading-7 text-muted-foreground">
              Approve competitors, collect evidence, score important shifts, and turn them into crisp response options from one workspace.
            </p>
          </div>

          <div className="mt-8 max-w-[720px] overflow-hidden rounded-[28px] bg-primary text-primary-foreground shadow-[0_24px_45px_rgba(105,88,232,0.22)]">
            <div className="flex items-center justify-between gap-3 border-b border-white/15 px-6 py-5 max-[560px]:items-start">
              <div>
                <p className="m-0 text-xs font-medium uppercase tracking-[0.32em] text-white/75">
                  Signal review
                </p>
                <h2 className="m-0 mt-1 text-base font-semibold">This week</h2>
              </div>
              <Badge className="border-white/20 bg-white/14 text-white" variant="outline">Act now</Badge>
            </div>

            <div className="grid gap-4 p-6">
              <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] bg-white/12 p-4 max-[520px]:grid-cols-[44px_minmax(0,1fr)]">
                <div className="grid size-11 place-items-center rounded-2xl bg-white/16 text-white">
                  <Zap className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold">
                    Pricing page changed
                  </p>
                  <p className="m-0 mt-1 truncate text-sm text-white/70">
                    New enterprise package and updated proof points detected.
                  </p>
                </div>
                <Button className="max-[520px]:col-span-full rounded-full border-0 bg-white text-[#16151b] hover:bg-white/90" size="sm" variant="outline" type="button">
                  Review
                  <ArrowRight />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-1">
                <PreviewMetric icon={Target} value="14" label="Tracked" />
                <PreviewMetric icon={Radar} value="6" label="Signals" />
                <PreviewMetric icon={Gauge} value="3" label="Drafts" />
              </div>
            </div>
          </div>
        </div>

        <Card className="rounded-[28px] border-0 shadow-sm">
          <CardHeader className="p-6 pb-4">
            <Badge variant="outline" className="mb-3 w-fit bg-background">
              <LockKeyhole className="size-3.5" aria-hidden="true" />
              {copy.eyebrow}
            </Badge>
            <CardTitle className="text-[30px] leading-tight tracking-tight max-[560px]:text-2xl">
              {copy.title}
            </CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-0">
            <form className="grid gap-4" autoComplete="off" onSubmit={handleSubmit}>
              {isSignup && (
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Name</span>
                  <Input
                    type="text"
                    name="counteros-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </label>
              )}

              <label className="grid gap-2">
                <span className="text-sm font-medium">Email</span>
                <Input
                  type="email"
                  name="counteros-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  autoComplete="off"
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Password</span>
                <Input
                  type="password"
                  name="counteros-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
                  autoComplete={isSignup ? "new-password" : "off"}
                  disabled={isSubmitting}
                  minLength={isSignup ? 8 : undefined}
                  required
                />
              </label>

              {error && (
                <p
                  className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <Button className="mt-1 h-11" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Working..." : copy.buttonLabel}
                <ArrowRight />
              </Button>
            </form>

            <Separator className="my-6" />

            <p className="m-0 text-center text-sm text-muted-foreground">
              {copy.switchText}{" "}
              <Link className="font-medium text-primary underline-offset-4 hover:underline" href={copy.switchHref}>
                {copy.switchLabel}
              </Link>
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" />
              Private workspace, server-side credentials
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function PreviewMetric({
  icon: Icon,
  value,
  label
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-[20px] bg-white/12 p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-3xl font-semibold leading-none">{value}</p>
        <Icon className="size-4 text-white/70" aria-hidden="true" />
      </div>
      <p className="m-0 mt-3 text-xs font-medium uppercase tracking-wide text-white/70">
        {label}
      </p>
    </div>
  );
}
