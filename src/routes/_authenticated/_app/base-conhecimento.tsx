import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

import { PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/base-conhecimento")({
  component: BaseConhecimentoPage,
});

function BaseConhecimentoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de conhecimento"
        badge="Em preparação"
        description="Conteúdos do escritório que orientam as respostas da inteligência artificial."
        actions={<SearchInput placeholder="Buscar conteúdo" />}
      />
      <EmptyState
        icon={<BookOpen className="h-5 w-5" />}
        title="Nenhum conteúdo cadastrado."
        description="Documentos, perguntas frequentes e orientações internas serão usados como fonte das respostas."
        action={<Button disabled>Adicionar conteúdo</Button>}
      />
    </div>
  );
}
