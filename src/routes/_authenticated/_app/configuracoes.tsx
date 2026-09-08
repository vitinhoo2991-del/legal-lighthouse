import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/common/PageHeader";
import { OfficeForm, ProfileForm } from "@/components/settings/forms";
import { TeamTable } from "@/components/settings/TeamTable";
import { EmptyState } from "@/components/common/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/configuracoes")({
  component: ConfiguracoesPage,
});

const NOTIFICATIONS = [
  "Novo lead",
  "Lead qualificado",
  "Consulta agendada",
  "Novo documento",
  "Prazo próximo",
  "Mensagem aguardando resposta",
  "Transferência para advogado",
];

const INTEGRATIONS = [
  "WhatsApp Cloud API",
  "Google Calendar",
  "Microsoft Outlook",
  "Login com Google",
  "Monitoramento processual",
  "Pagamentos",
];

function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Ajuste sua conta, escritório e preferências." />

      <Tabs defaultValue="perfil">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="perfil">Meu perfil</TabsTrigger>
          <TabsTrigger value="escritorio">Escritório</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="pt-6">
          <ProfileForm />
        </TabsContent>

        <TabsContent value="escritorio" className="pt-6">
          <OfficeForm />
        </TabsContent>

        <TabsContent value="equipe" className="pt-6">
          <TeamTable />
        </TabsContent>

        <TabsContent value="notificacoes" className="pt-6">
          <div className="max-w-xl space-y-3">
            {NOTIFICATIONS.map((n) => (
              <div
                key={n}
                className="flex items-center justify-between rounded-lg border border-border bg-surface/60 px-4 py-3"
              >
                <Label className="text-sm font-normal">{n}</Label>
                <Switch disabled />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              As notificações serão ativadas quando o atendimento estiver conectado.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="seguranca" className="pt-6">
          <div className="max-w-xl space-y-4">
            <div className="rounded-lg border border-border bg-surface/60 p-4">
              <p className="text-sm font-medium">Senha</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode redefinir sua senha pelo e-mail cadastrado.
              </p>
              <Button variant="outline" className="mt-3" asChild>
                <a href="/forgot-password">Redefinir senha</a>
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-surface/60 p-4">
              <p className="text-sm font-medium">Isolamento de dados</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Todos os dados são separados por escritório no banco de dados. Nenhum usuário
                acessa informações de outro escritório.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integracoes" className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {INTEGRATIONS.map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border bg-surface/60 px-4 py-3 text-sm"
              >
                <span>{i}</span>
                <span className="text-xs text-muted-foreground">Não conectado</span>
              </div>
            ))}
          </div>
          <EmptyState
            className="mt-6"
            title="Integrações ainda não disponíveis."
            description="As conexões externas serão liberadas nas próximas etapas da plataforma."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
