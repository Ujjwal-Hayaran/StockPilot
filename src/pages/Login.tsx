import { FormEvent, useState } from "react";
import { Building2, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signin" | "signup";

const Login = () => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) toast.error(error.message);
      else toast.success("Welcome back.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      toast.success("Account created. Check your email to confirm your account.");
    } else {
      toast.success("Account created and signed in.");
    }

    setLoading(false);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.14),_transparent_38%),radial-gradient(circle_at_bottom_right,_hsl(var(--accent)/0.12),_transparent_36%),linear-gradient(120deg,_hsl(var(--background))_0%,_hsl(var(--panel)/0.85)_48%,_hsl(var(--background))_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-14 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 -z-10 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[32px] border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/10 backdrop-blur-xl lg:p-10">
          <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/60 px-4 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium">StockPilot by Reorder Genius</p>
          </div>
          <h1 className="mt-6 text-3xl font-semibold leading-tight sm:text-4xl">One dashboard. Many shopkeepers.</h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Sign in to manage your own store inventory, movement history, and reorder suggestions without mixing data across different businesses.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <InfoPill title="Store scoped" description="Each account keeps operations separate." />
            <InfoPill title="Live alerts" description="Track low and critical stock quickly." />
            <InfoPill title="Fast workflow" description="Log stock in/out and reorder in minutes." />
          </div>
        </section>

        <Card className="rounded-[28px] border-border/60 bg-card/85 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Sign in" : "Create account"}</CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Use your shopkeeper credentials to access the dashboard."
                : "Create a secure account for your store."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-9"
                    placeholder="shop@example.com"
                  />
                </div>
              </Field>

              <Field label="Password">
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pl-9"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </Field>

              <Button className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="mt-5 rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
              {mode === "signin" ? "No account yet?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="ml-2 font-medium text-primary underline-offset-4 hover:underline"
              >
                {mode === "signin" ? "Create one" : "Sign in instead"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    {children}
  </div>
);

const InfoPill = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-2xl border border-border/60 bg-background/65 p-4">
    <p className="text-sm font-semibold">{title}</p>
    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
  </div>
);

export default Login;
