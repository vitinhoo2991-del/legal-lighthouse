import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { LoadingState } from "@/components/common/states";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const AREAS = [
  "Trabalhista",
  "Previdenciário",
  "Família",
  "Civil",
  "Consumidor",
  "Empresarial",
  "Tributário",
  "Penal",
  "Imobiliário",
  "Outro",
];

const GOALS = [
  "Captar mais clientes",
  "Automatizar atendimento",
  "Organizar leads",
  "Gerenciar equipe",
  "Agendar consultas",
  "Centralizar atendimento",
];

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        selected
          ? "border-primary/40 bg-primary-soft text-primary"
          : "border-border bg-surface/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, refetch } = useProfile();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    officeName: "",
    responsible: "",
    phone: "",
    city: "",
    state: "",
    website: "",
    logoUrl: "",
  });
  const [areas, setAreas] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      officeName: profile.office?.name ?? f.officeName,
      responsible: profile.name ?? f.responsible,
      phone: profile.office?.phone ?? profile.phone ?? f.phone,
      city: profile.office?.city ?? f.city,
      state: profile.office?.state ?? f.state,
      website: profile.office?.website ?? f.website,
      logoUrl: profile.office?.logo_url ?? f.logoUrl,
    }));
    setAreas(profile.office?.practice_areas ?? []);
    setGoals(profile.office?.goals ?? []);
  }, [profile]);

  useEffect(() => {
    if (!isLoading && profile?.office?.onboarding_completed) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isLoading, profile, navigate]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function ensureOfficeAndProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) throw new Error("no-session");

    if (profile?.office_id) return profile.office_id;

    const { data: office, error: officeError } = await supabase
      .from("offices")
      .insert({ name: form.officeName || "Meu escritório", email: user.email ?? null })
      .select()
      .single();
    if (officeError || !office) throw officeError ?? new Error("office");

    if (profile) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ office_id: office.id })
        .eq("id", profile.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from("profiles").insert({
        auth_user_id: user.id,
        office_id: office.id,
        name: form.responsible || (user.email ?? "Responsável"),
        email: user.email ?? "",
        role: "owner",
      });
      if (insErr) throw insErr;
    }
    await refetch();
    return office.id;
  }

  async function saveAndAdvance(next: number, finish = false) {
    setError(null);
    setSaving(true);
    try {
      const officeId = await ensureOfficeAndProfile();

      const { error: officeError } = await supabase
        .from("offices")
        .update({
          name: form.officeName || "Meu escritório",
          phone: form.phone || null,
          city: form.city || null,
          state: form.state || null,
          website: form.website || null,
          logo_url: form.logoUrl || null,
          practice_areas: areas,
          goals: goals,
          ...(finish ? { onboarding_completed: true } : {}),
        })
        .eq("id", officeId);
      if (officeError) throw officeError;

      if (form.responsible && profile && form.responsible !== profile.name) {
        await supabase.from("profiles").update({ name: form.responsible }).eq("id", profile.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] });

      if (finish) {
        toast.success("Escritório configurado.");
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setStep(next);
    } catch {
      setError("Não foi possível salvar agora. Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <LoadingState rows={4} />
      </div>
    );
  }

  return (
    <div className="min-h-screen glow-aura px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Logo className="mb-8 justify-center" />
        <Progress value={(step / 4) * 100} className="mb-8 h-1.5" />

        <div className="surface-panel p-6 shadow-elevated md:p-8">
          {step === 1 ? (
            <>
              <h1 className="font-display text-xl font-semibold">
                Conte um pouco sobre seu escritório
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Essas informações personalizam sua experiência.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="officeName">Nome do escritório</Label>
                  <Input
                    id="officeName"
                    value={form.officeName}
                    onChange={(e) => setForm({ ...form, officeName: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="responsible">Nome do responsável</Label>
                  <Input
                    id="responsible"
                    value={form.responsible}
                    onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="logoUrl">Logo (endereço da imagem)</Label>
                  <Input
                    id="logoUrl"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 className="font-display text-xl font-semibold">
                Quais áreas seu escritório atende?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Selecione quantas quiser.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {AREAS.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected={areas.includes(a)}
                    onClick={() => toggle(areas, setAreas, a)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1 className="font-display text-xl font-semibold">
                Como você pretende usar o JurisIA?
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">Selecione seus objetivos.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <Chip
                    key={g}
                    label={g}
                    selected={goals.includes(g)}
                    onClick={() => toggle(goals, setGoals, g)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-4 font-display text-xl font-semibold">
                Seu escritório está pronto.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                A partir de agora você pode organizar atendimento, leads e equipe em um só lugar.
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              disabled={step === 1 || saving}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Voltar
            </Button>
            <Button
              disabled={saving}
              onClick={() => (step === 4 ? saveAndAdvance(4, true) : saveAndAdvance(step + 1))}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {step === 4 ? "Entrar no JurisIA" : "Continuar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
