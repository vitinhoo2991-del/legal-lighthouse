import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "lawyer" | "assistant";

export interface Office {
  id: string;
  name: string;
  legal_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  timezone: string;
  status: string;
  practice_areas: string[];
  goals: string[];
  onboarding_completed: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  auth_user_id: string;
  office_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: AppRole;
  status: string;
  last_seen_at: string | null;
  created_at: string;
  office?: Office | null;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  lawyer: "Advogado",
  assistant: "Assistente",
};

export async function fetchProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*, office:offices(*)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 30_000,
  });
}

export function useTeam(officeId: string | null | undefined) {
  return useQuery({
    queryKey: ["team", officeId],
    enabled: Boolean(officeId),
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("office_id", officeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as Profile[]) ?? [];
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  };
}

export function friendlyAuthError(message?: string) {
  if (!message) return "Não foi possível concluir. Tente novamente.";
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Já existe uma conta com este e-mail.";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked"))
    return "Esta senha já apareceu em vazamentos públicos. Escolha outra.";
  if (m.includes("weak")) return "Escolha uma senha mais forte, com letras, números e símbolos.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns instantes.";
  return "Não foi possível concluir. Verifique os dados e tente novamente.";
}
