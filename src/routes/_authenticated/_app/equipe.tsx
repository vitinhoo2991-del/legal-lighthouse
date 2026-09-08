import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { TeamTable } from "@/components/settings/TeamTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/_app/equipe")({
  component: EquipePage,
});

function EquipePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe"
        description="Membros com acesso ao painel do seu escritório."
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Adicionar membro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convidar membro</DialogTitle>
                <DialogDescription>
                  O envio de convites por e-mail será liberado na próxima etapa do JurisIA. Por
                  enquanto, cada pessoa da equipe entra pela criação de conta do escritório.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        }
      />
      <TeamTable />
    </div>
  );
}
