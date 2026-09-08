import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/common/states";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();

  useEffect(() => {
    if (isLoading) return;
    if (!profile || !profile.office_id || !profile.office?.onboarding_completed) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [isLoading, profile, navigate]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <LoadingState rows={5} />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
