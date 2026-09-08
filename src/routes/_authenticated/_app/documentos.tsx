import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen } from "lucide-react";

import { FilterBar, PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/_app/documentos")({
  component: DocumentosPage,
});

const FOLDERS = ["Documentos pessoais", "Contratos", "Comprovantes", "Processos", "Recebidos"];

function DocumentosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos"
        badge="Estrutural"
        description="Arquivos do escritório e documentos enviados pelos clientes."
        actions={<Button disabled>Enviar arquivo</Button>}
      />

      <FilterBar>
        <SearchInput placeholder="Buscar documento" />
        <Select disabled>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FOLDERS.map((f) => (
          <div
            key={f}
            className="surface-panel flex items-center justify-between p-4 text-sm transition-colors hover:border-primary/30"
          >
            <span className="flex items-center gap-3">
              <FolderOpen className="h-4 w-4 text-primary" />
              {f}
            </span>
            <span className="text-xs text-muted-foreground">0 arquivos</span>
          </div>
        ))}
      </div>

      <EmptyState
        icon={<FolderOpen className="h-5 w-5" />}
        title="Nenhum documento armazenado."
        description="Os arquivos enviados pelo escritório e pelos clientes ficarão organizados por pastas nesta área."
      />
    </div>
  );
}
