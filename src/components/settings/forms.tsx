import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, type Profile } from "@/lib/auth";
import { LoadingState, ErrorState } from "@/components/common/states";

export function ProfileForm() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const [values, setValues] = useState({ name: "", phone: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setValues({
      name: profile.name ?? "",
      phone: profile.phone ?? "",
      avatar_url: profile.avatar_url ?? "",
    });
  }, [profile]);

  if (isLoading) return <LoadingState rows={3} />;
  if (isError || !profile) return <ErrorState onRetry={() => refetch()} />;

  async function save(current: Profile) {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        avatar_url: values.avatar_url.trim() || null,
      })
      .eq("id", current.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar seu perfil.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Perfil atualizado.");
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-2">
        <Label htmlFor="p-name">Nome</Label>
        <Input
          id="p-name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-email">E-mail</Label>
        <Input id="p-email" value={profile.email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-phone">Telefone</Label>
        <Input
          id="p-phone"
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="p-avatar">Foto (endereço da imagem)</Label>
        <Input
          id="p-avatar"
          value={values.avatar_url}
          onChange={(e) => setValues({ ...values, avatar_url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <Button disabled={saving} onClick={() => save(profile)}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar alterações
      </Button>
    </div>
  );
}

export function OfficeForm() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const [values, setValues] = useState({
    name: "",
    phone: "",
    city: "",
    state: "",
    website: "",
    logo_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const office = profile?.office;
    if (!office) return;
    setValues({
      name: office.name ?? "",
      phone: office.phone ?? "",
      city: office.city ?? "",
      state: office.state ?? "",
      website: office.website ?? "",
      logo_url: office.logo_url ?? "",
    });
  }, [profile]);

  if (isLoading) return <LoadingState rows={3} />;
  if (isError || !profile?.office) return <ErrorState onRetry={() => refetch()} />;

  const canEdit = profile.role === "owner" || profile.role === "admin";

  async function save(officeId: string) {
    setSaving(true);
    const { error } = await supabase
      .from("offices")
      .update({
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        city: values.city.trim() || null,
        state: values.state.trim() || null,
        website: values.website.trim() || null,
        logo_url: values.logo_url.trim() || null,
      })
      .eq("id", officeId);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar os dados do escritório.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Escritório atualizado.");
  }

  return (
    <div className="max-w-2xl space-y-4">
      {!canEdit ? (
        <p className="rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-muted-foreground">
          Apenas proprietários e administradores podem editar os dados do escritório.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-name">Nome do escritório</Label>
          <Input
            id="o-name"
            disabled={!canEdit}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-phone">Telefone</Label>
          <Input
            id="o-phone"
            disabled={!canEdit}
            value={values.phone}
            onChange={(e) => setValues({ ...values, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-city">Cidade</Label>
          <Input
            id="o-city"
            disabled={!canEdit}
            value={values.city}
            onChange={(e) => setValues({ ...values, city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-state">Estado</Label>
          <Input
            id="o-state"
            disabled={!canEdit}
            value={values.state}
            onChange={(e) => setValues({ ...values, state: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o-site">Site</Label>
          <Input
            id="o-site"
            disabled={!canEdit}
            value={values.website}
            onChange={(e) => setValues({ ...values, website: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="o-logo">Logo (endereço da imagem)</Label>
          <Input
            id="o-logo"
            disabled={!canEdit}
            value={values.logo_url}
            onChange={(e) => setValues({ ...values, logo_url: e.target.value })}
          />
        </div>
      </div>
      <Button disabled={!canEdit || saving} onClick={() => save(profile.office!.id)}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Salvar alterações
      </Button>
    </div>
  );
}
