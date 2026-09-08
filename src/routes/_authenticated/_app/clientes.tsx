import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";

import { FilterBar, PageHeader, SearchInput } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/clientes")({
  component: ClientesPage,
});

const COLUMNS = ["Nome", "Contato", "Área", "Responsável", "Status", "Cliente desde"];

function ClientesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        badge="Estrutural"
        description="Clientes ativos do escritório e seus responsáveis."
      />

      <FilterBar>
        <SearchInput placeholder="Buscar cliente" />
        <Select disabled>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead key={c} className="whitespace-nowrap">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <EmptyState
          className="rounded-none border-0 border-t"
          icon={<UserRound className="h-5 w-5" />}
          title="Nenhum cliente cadastrado."
          description="Leads contratados se tornam clientes e aparecerão automaticamente nesta lista."
        />
      </div>
    </div>
  );
}
