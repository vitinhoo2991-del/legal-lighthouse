import { createFileRoute } from "@tanstack/react-router";

// Meta Cloud API webhook, one URL per office. The office id in the path only
// selects which credentials to validate against — every event is authenticated
// by the office's own verify token / app secret before anything is stored.
export const Route = createFileRoute("/api/public/whatsapp/$officeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const { getOfficeCredentials } = await import("@/lib/whatsapp.server");
        const credentials = await getOfficeCredentials(params.officeId);

        if (mode === "subscribe" && credentials?.verify_token && token === credentials.verify_token) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },

      POST: async ({ request, params }) => {
        const raw = await request.text();
        const { getOfficeCredentials, verifyMetaSignature, processWebhookPayload } = await import(
          "@/lib/whatsapp.server"
        );

        const credentials = await getOfficeCredentials(params.officeId);
        if (!credentials) return new Response("not configured", { status: 404 });

        if (credentials.app_secret) {
          const ok = verifyMetaSignature(
            credentials.app_secret,
            raw,
            request.headers.get("x-hub-signature-256"),
          );
          if (!ok) return new Response("invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("invalid payload", { status: 400 });
        }

        try {
          await processWebhookPayload(params.officeId, payload);
        } catch (error) {
          console.error("[whatsapp-webhook]", error instanceof Error ? error.message : "erro");
        }
        // Always 200 so Meta does not retry endlessly; failures are stored per event.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
