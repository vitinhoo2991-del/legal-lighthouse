// Implementação oficial (Meta Cloud API via token). Server-only.
// Todo detalhe específico da Meta vive aqui e em nenhum outro lugar.
import { createHmac, timingSafeEqual } from "crypto";
import {
  WhatsAppError,
  type WhatsAppChannelInfo,
  type WhatsAppInboundMessage,
  type WhatsAppOutboundText,
  type WhatsAppProvider,
  type WhatsAppSendResult,
  type WhatsAppStatusUpdate,
  type WhatsAppWebhookEvents,
  type WhatsAppWebhookRequest,
} from "../types";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaProviderConfig {
  accessToken: string;
  phoneNumberId: string;
  appSecret: string | null;
  verifyToken: string | null;
}

async function graph<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
  };
  if (!response.ok) {
    // Nunca registrar tokens — apenas a mensagem do provedor.
    const message = body.error?.message ?? `HTTP ${response.status}`;
    console.error("[whatsapp:meta]", response.status, message);
    throw new WhatsAppError(response.status, message);
  }
  return body as T;
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly id = "meta_cloud" as const;
  private config: MetaProviderConfig;

  constructor(config: MetaProviderConfig) {
    this.config = config;
  }

  async sendText(message: WhatsAppOutboundText): Promise<WhatsAppSendResult> {
    const payload = await graph<{ messages?: Array<{ id: string }> }>(
      `/${encodeURIComponent(this.config.phoneNumberId)}/messages`,
      this.config.accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.to,
          type: "text",
          text: { preview_url: false, body: message.text },
        }),
      },
    );
    const id = payload.messages?.[0]?.id;
    if (!id) throw new WhatsAppError(502, "resposta sem identificador de mensagem");
    return { externalId: id };
  }

  async getChannelInfo(): Promise<WhatsAppChannelInfo> {
    const info = await graph<{
      id: string;
      display_phone_number?: string;
      verified_name?: string;
    }>(
      `/${encodeURIComponent(this.config.phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`,
      this.config.accessToken,
    );
    return {
      phoneNumber: info.display_phone_number ?? null,
      displayName: info.verified_name ?? null,
      externalAccountId: null,
    };
  }

  verifyWebhookChallenge(query: URLSearchParams): string | null {
    const mode = query.get("hub.mode");
    const token = query.get("hub.verify_token");
    if (mode !== "subscribe") return null;
    if (!this.config.verifyToken || token !== this.config.verifyToken) return null;
    return query.get("hub.challenge") ?? "";
  }

  verifyWebhookRequest(request: WhatsAppWebhookRequest): boolean {
    // Sem app secret configurado não há assinatura a validar.
    if (!this.config.appSecret) return true;
    const header = request.headers.get("x-hub-signature-256");
    if (!header?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", this.config.appSecret)
      .update(request.rawBody, "utf8")
      .digest("hex");
    const a = Buffer.from(header.slice("sha256=".length), "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  parseWebhookPayload(payload: unknown): WhatsAppWebhookEvents {
    const inbound: WhatsAppInboundMessage[] = [];
    const statuses: WhatsAppStatusUpdate[] = [];
    const body = payload as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
            messages?: Array<Record<string, any>>;
            statuses?: Array<Record<string, any>>;
          };
        }>;
      }>;
    };
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const profileName = value.contacts?.[0]?.profile?.name ?? null;
        for (const m of value.messages ?? []) {
          const type = String(m["type"] ?? "unknown");
          const text =
            type === "text"
              ? String(m["text"]?.body ?? "")
              : type === "button"
                ? String(m["button"]?.text ?? "")
                : type === "interactive"
                  ? String(
                      m["interactive"]?.button_reply?.title ??
                        m["interactive"]?.list_reply?.title ??
                        "",
                    )
                  : "";
          inbound.push({
            externalId: String(m["id"]),
            from: String(m["from"] ?? ""),
            profileName,
            type,
            text,
            timestamp: new Date(Number(m["timestamp"] ?? Date.now() / 1000) * 1000).toISOString(),
          });
        }
        for (const s of value.statuses ?? []) {
          statuses.push({
            externalId: String(s["id"]),
            status: String(s["status"] ?? ""),
            timestamp: new Date(Number(s["timestamp"] ?? Date.now() / 1000) * 1000).toISOString(),
            errorMessage: s["errors"]?.[0]?.title ? String(s["errors"][0].title) : null,
          });
        }
      }
    }
    return { inbound, statuses };
  }
}
