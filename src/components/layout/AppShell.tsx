import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronLeft, LogOut, Menu, Search, Settings, User } from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/Logo";
import { navGroups } from "@/lib/navigation";
import { ROLE_LABEL, useProfile, useSignOut, type Profile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  if (!name) return "JI";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.title}>
          {!collapsed ? (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group.title}
            </p>
          ) : (
            <div className="mx-3 mb-2 h-px bg-sidebar-border" />
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const link = (
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              );

              return (
                <li key={item.to}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ profile }: { profile: Profile | null | undefined }) {
  const signOut = useSignOut();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-soft text-xs text-primary">
              {initials(profile?.name)}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{profile?.name ?? "Usuário"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {profile ? ROLE_LABEL[profile.role] : ""}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{profile?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/perfil" })}>
          <User className="mr-2 h-4 w-4" /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
          <Settings className="mr-2 h-4 w-4" /> Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: profile, isLoading } = useProfile();

  useEffect(() => {
    const stored = window.localStorage.getItem("jurisia:sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem("jurisia:sidebar-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
            collapsed ? "w-[76px]" : "w-[264px]",
          )}
        >
          <div
            className={cn(
              "flex h-16 items-center border-b border-sidebar-border px-4",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <LogoMark />
            ) : (
              <Link to="/dashboard">
                <Logo />
              </Link>
            )}
          </div>
          <NavList collapsed={collapsed} />
          <div className="border-t border-sidebar-border p-3">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : collapsed ? (
              <div className="flex justify-center">
                <UserMenu profile={profile} />
              </div>
            ) : (
              <UserMenu profile={profile} />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              className="mt-2 w-full justify-center text-muted-foreground"
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
              {!collapsed ? <span className="ml-2 text-xs">Recolher</span> : null}
            </Button>
          </div>
        </aside>

        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                  <Logo />
                </div>
                <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
                <div className="border-t border-sidebar-border p-3">
                  <UserMenu profile={profile} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-muted-foreground sm:flex sm:max-w-md">
              <Search className="h-4 w-4" />
              <span className="truncate">Buscar no JurisIA</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Notificações">
                    <Bell className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <p className="text-sm font-medium">Notificações</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Você não tem notificações. Novos leads, agendamentos e prazos aparecerão aqui.
                  </p>
                </PopoverContent>
              </Popover>
              <div className="hidden text-right sm:block">
                <p className="max-w-[180px] truncate text-sm font-medium">
                  {profile?.office?.name ?? "Seu escritório"}
                </p>
                <p className="text-xs text-muted-foreground">Plano em avaliação</p>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
