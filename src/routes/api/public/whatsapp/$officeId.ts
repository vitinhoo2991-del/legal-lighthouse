import { createFileRoute } from "@tanstack/react-router";

// Webhook de entrada, uma URL por escritório. O id no caminho apenas seleciona
// as credenciais do escritório; toda autenticação e normalização acontece no
// WhatsAppService, que hoje usa a API oficial e amanhã pode usar outro transporte.
export const Route = createFileRoute("/api/public/whatsapp/$officeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const { WhatsAppService } = await import("@/lib/whatsapp/service.server");
        const challenge = await WhatsAppService.verifyWebhookChallenge(
          params.officeId,
          url.searchParams,
        );
        if (challenge === null) return new Response("forbidden", { status: 403 });
        return new Response(challenge, { status: 200 });
      },

      POST: async ({ request, params }) => {
        const raw = await request.text();
        const url = new URL(request.url);
        const { WhatsAppService } = await import("@/lib/whatsapp/service.server");

        const received = await WhatsAppService.receiveWebhook(params.officeId, {
          rawBody: raw,
          headers: request.headers,
          query: url.searchParams,
        });

        if (!received.configured) return new Response("not configured", { status: 404 });
        if (!received.authenticated) return new Response("invalid signature", { status: 401 });

        try {
          await WhatsAppService.ingestEvents(params.officeId, received.events);
        } catch (error) {
          console.error("[whatsapp-webhook]", error instanceof Error ? error.message : "erro");
        }
        // Sempre 200 para a Meta não reenviar em loop; falhas ficam por evento.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
