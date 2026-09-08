import { UsersRound } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABEL, useProfile, useTeam } from "@/lib/auth";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function TeamTable() {
  const { data: profile } = useProfile();
  const { data: team, isLoading, isError, refetch } = useTeam(profile?.office_id);

  if (isLoading) return <LoadingState rows={3} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!team || team.length === 0) {
    return (
      <EmptyState
        icon={<UsersRound className="h-5 w-5" />}
        title="Nenhum membro encontrado."
        description="Convites para novos membros serão liberados em uma próxima etapa."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Último acesso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {team.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{member.name}</TableCell>
              <TableCell className="text-muted-foreground">{member.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className="border-primary/30 bg-primary-soft text-primary">
                  {ROLE_LABEL[member.role]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {member.status === "active" ? "Ativo" : member.status}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(member.last_seen_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
