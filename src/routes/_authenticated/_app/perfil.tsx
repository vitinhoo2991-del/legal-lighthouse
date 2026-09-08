import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/common/PageHeader";
import { ProfileForm } from "@/components/settings/forms";

export const Route = createFileRoute("/_authenticated/_app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description="Seus dados de acesso e contato." />
      <ProfileForm />
    </div>
  );
}
