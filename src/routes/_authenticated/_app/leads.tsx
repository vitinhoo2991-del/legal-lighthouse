import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/_app/leads")({
  component: LeadsPage,
});

const COLUMNS = [
  "Nome",
  "Telefone",
  "Origem",
  "Área jurídica",
  "Status",
  "Lead score",
  "Responsável",
  "Último contato",
  "Criado em",
];

function LeadsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        badge="Estrutural"
        description="Todos os contatos captados pelo escritório, organizados em um só lugar."
      />

      <FilterBar>
        <SearchInput placeholder="Buscar por nome ou telefone" />
        <Select disabled>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select disabled>
          <SelectTrigger className="sm:w-[180px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recentes">Mais recentes</SelectItem>
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
          icon={<Users className="h-5 w-5" />}
          title="Você ainda não possui leads."
          description="Assim que um novo contato chegar, ele aparecerá automaticamente nesta área."
        />
      </div>
    </div>
  );
}
