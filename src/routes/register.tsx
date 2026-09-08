import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Criar escritório — JurisIA" },
      {
        name: "description",
        content: "Crie a conta do seu escritório e comece a usar o JurisIA.",
      },
      { property: "og:title", content: "Criar escritório — JurisIA" },
      {
        property: "og:description",
        content: "Crie a conta do seu escritório e comece a usar o JurisIA.",
      },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    officeName: z.string().trim().min(2, "Informe o nome do escritório").max(120),
    name: z.string().trim().min(2, "Informe o nome do responsável").max(120),
    email: z.string().trim().email("E-mail inválido").max(255),
    phone: z.string().trim().min(8, "Informe um telefone válido").max(30),
    password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    officeName: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Verifique os dados informados.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: parsed.data.name },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(friendlyAuthError(signUpError.message));
      return;
    }

    if (!data.session) {
      setLoading(false);
      toast.success("Conta criada. Confirme seu e-mail para continuar.");
      navigate({ to: "/login" });
      return;
    }

    const { data: office, error: officeError } = await supabase
      .from("offices")
      .insert({
        name: parsed.data.officeName,
        email: parsed.data.email,
        phone: parsed.data.phone,
      })
      .select()
      .single();

    if (officeError || !office) {
      setLoading(false);
      setError("Conta criada, mas não foi possível criar o escritório. Tente entrar novamente.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      auth_user_id: data.user!.id,
      office_id: office.id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: "owner",
    });

    setLoading(false);

    if (profileError) {
      setError("Não foi possível finalizar seu cadastro. Tente novamente.");
      return;
    }

    toast.success("Escritório criado com sucesso.");
    navigate({ to: "/onboarding", replace: true });
  }

  return (
    <AuthLayout
      title="Crie seu escritório"
      description="Leva menos de um minuto para começar."
      footer={
        <>
          Já possui uma conta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="officeName">Nome do escritório</Label>
          <Input id="officeName" required value={values.officeName} onChange={set("officeName")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nome do responsável</Label>
          <Input id="name" required value={values.name} onChange={set("name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={values.email} onChange={set("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              required
              value={values.phone}
              onChange={set("phone")}
              placeholder="(11) 99999-0000"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              required
              value={values.password}
              onChange={set("password")}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmar senha</Label>
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            required
            value={values.confirm}
            onChange={set("confirm")}
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Criar escritório
        </Button>
      </form>
    </AuthLayout>
  );
}
