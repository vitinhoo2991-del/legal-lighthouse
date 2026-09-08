import {
  LayoutDashboard,
  MessagesSquare,
  Phone,
  Users,
  UserRound,
  KanbanSquare,
  CalendarDays,
  FolderOpen,
  Scale,
  Wallet,
  BarChart3,
  Sparkles,
  Bot,
  BookOpen,
  Gavel,
  UsersRound,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Visão geral",
    items: [{ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Atendimento",
    items: [
      { label: "Conversas", to: "/atendimento", icon: MessagesSquare },
      { label: "WhatsApp", to: "/whatsapp", icon: Phone },
    ],
  },
  {
    title: "Gestão",
    items: [
      { label: "Leads", to: "/leads", icon: Users },
      { label: "Clientes", to: "/clientes", icon: UserRound },
      { label: "CRM", to: "/crm", icon: KanbanSquare },
      { label: "Agenda", to: "/agenda", icon: CalendarDays },
      { label: "Documentos", to: "/documentos", icon: FolderOpen },
      { label: "Processos", to: "/processos", icon: Scale },
      { label: "Financeiro", to: "/financeiro", icon: Wallet },
      { label: "Relatórios", to: "/relatorios", icon: BarChart3 },
    ],
  },
  {
    title: "Inteligência",
    items: [
      { label: "IA", to: "/ia", icon: Sparkles },
      { label: "Agentes IA", to: "/agentes-ia", icon: Bot },
      { label: "Base de conhecimento", to: "/base-conhecimento", icon: BookOpen },
      { label: "Copiloto", to: "/copiloto", icon: Gavel },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Equipe", to: "/equipe", icon: UsersRound },
      { label: "Configurações", to: "/configuracoes", icon: Settings },
    ],
  },
];
