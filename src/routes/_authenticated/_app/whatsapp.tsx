import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/whatsapp")({
  component: WhatsappPage,
});

function WhatsappPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp"
        badge="Em preparação"
        description="Canal oficial de atendimento do escritório."
      />
      <EmptyState
        icon={<Phone className="h-5 w-5" />}
        title="Nenhum número conectado"
        description="A conexão com o WhatsApp oficial será liberada na próxima etapa do JurisIA."
        action={<Button disabled>Conectar número</Button>}
      />
    </div>
  );
}
