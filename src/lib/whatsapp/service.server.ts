// WhatsAppService — ponto ÚNICO de comunicação com o WhatsApp.
// Telas, IA, leads, CRM e qualquer módulo futuro devem passar por aqui.
// Trocar Meta API por QR Code no futuro = criar outro provider e mudar
// apenas `createProvider()`; o restante do sistema não muda.
import { MetaWhatsAppProvider } from "./providers/meta.server";
import type { WhatsAppProvider, WhatsAppProviderId, WhatsAppWebhookEvents } from "./types";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Provider ativo do produto hoje. Ponto de troca futuro (QR Code). */
export const ACTIVE_PROVIDER: WhatsAppProviderId = "meta_cloud";

export interface OfficeChannel {
  officeId: string;
  provider: WhatsAppProvider;
  phoneNumberId: string;
}

/**
 * Carrega a conexão e as credenciais do escritório (isolamento por office_id)
 * e devolve o provider já configurado. `null` = escritório sem canal pronto.
 */
export async function getOfficeChannel(officeId: string): Promise<OfficeChannel | null> {
  const db = await admin();
  const [{ data: connection }, { data: credentials }] = await Promise.all([
    db
      .from("whatsapp_connections")
      .select("external_phone_number_id, external_account_id, status")
      .eq("office_id", officeId)
      .maybeSingle(),
    db
      .from("whatsapp_credentials")
      .select("access_token, app_secret, verify_token")
      .eq("office_id", officeId)
      .maybeSingle(),
  ]);

  if (!connection?.external_phone_number_id || !credentials?.access_token) return null;

  const provider = createProvider({
    accessToken: credentials.access_token,
    phoneNumberId: connection.external_phone_number_id,
    appSecret: credentials.app_secret ?? null,
    verifyToken: credentials.verify_token ?? null,
  });

  return { officeId, provider, phoneNumberId: connection.external_phone_number_id };
}

function createProvider(config: {
  accessToken: string;
  phoneNumberId: string;
  appSecret: string | null;
  verifyToken: string | null;
}): WhatsAppProvider {
  switch (ACTIVE_PROVIDER) {
    case "meta_cloud":
    default:
      return new MetaWhatsAppProvider(config);
  }
}

export const WhatsAppService = {
  /** Envia texto pelo canal do escritório. Retorna o id externo da mensagem. */
  async sendText(officeId: string, to: string, text: string): Promise<string> {
    const channel = await getOfficeChannel(officeId);
    if (!channel) throw new Error("NOT_CONFIGURED");
    const result = await channel.provider.sendText({ to, text });
    return result.externalId;
  },

  /** Consulta o canal no provedor (usado no teste de conexão). */
  async getChannelInfo(officeId: string) {
    const channel = await getOfficeChannel(officeId);
    if (!channel) return null;
    return channel.provider.getChannelInfo();
  },

  /** Handshake de verificação do webhook. */
  async verifyWebhookChallenge(officeId: string, query: URLSearchParams): Promise<string | null> {
    const channel = await getOfficeChannel(officeId);
    if (!channel) return null;
    return channel.provider.verifyWebhookChallenge(query);
  },

  /**
   * Autentica e normaliza um payload de entrada.
   * `authenticated: false` => requisição rejeitada.
   */
  async receiveWebhook(
    officeId: string,
    request: { rawBody: string; headers: Headers; query: URLSearchParams },
  ): Promise<
    | { configured: false }
    | { configured: true; authenticated: false }
    | { configured: true; authenticated: true; events: WhatsAppWebhookEvents }
  > {
    const channel = await getOfficeChannel(officeId);
    if (!channel) return { configured: false };
    if (!channel.provider.verifyWebhookRequest(request)) {
      return { configured: true, authenticated: false };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(request.rawBody);
    } catch {
      return { configured: true, authenticated: true, events: { inbound: [], statuses: [] } };
    }
    return {
      configured: true,
      authenticated: true,
      events: channel.provider.parseWebhookPayload(payload),
    };
  },

  /** Persiste eventos normalizados (contatos, conversas, mensagens, IA). */
  async ingestEvents(officeId: string, events: WhatsAppWebhookEvents) {
    const { processInboundEvents } = await import("./inbox.server");
    return processInboundEvents(officeId, events);
  },
};
