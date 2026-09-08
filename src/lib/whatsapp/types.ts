// Provider-agnostic WhatsApp contracts.
// Nenhum detalhe da Meta pode vazar deste arquivo: telas, IA, CRM e demais
// módulos do JurisIA só conhecem estes tipos.

export type WhatsAppProviderId = "meta_cloud" | "qrcode";

export interface WhatsAppChannelInfo {
  phoneNumber: string | null;
  displayName: string | null;
  externalAccountId: string | null;
}

export interface WhatsAppOutboundText {
  to: string;
  text: string;
}

export interface WhatsAppSendResult {
  externalId: string;
}

export interface WhatsAppInboundMessage {
  externalId: string;
  from: string;
  profileName: string | null;
  type: string;
  text: string;
  timestamp: string;
}

export interface WhatsAppStatusUpdate {
  externalId: string;
  status: string;
  timestamp: string;
  errorMessage: string | null;
}

export interface WhatsAppWebhookEvents {
  inbound: WhatsAppInboundMessage[];
  statuses: WhatsAppStatusUpdate[];
}

export interface WhatsAppWebhookRequest {
  rawBody: string;
  headers: Headers;
  query: URLSearchParams;
}

/**
 * Contrato que qualquer transporte de WhatsApp precisa cumprir.
 * Hoje existe apenas a implementação oficial via token (Meta Cloud API).
 * Uma futura implementação por QR Code deve implementar esta mesma interface,
 * sem exigir mudança em telas, conversas, IA, leads ou CRM.
 */
export interface WhatsAppProvider {
  readonly id: WhatsAppProviderId;
  /** Envia texto para um contato. */
  sendText(message: WhatsAppOutboundText): Promise<WhatsAppSendResult>;
  /** Consulta o canal (número/nome) — usado no teste de conexão. */
  getChannelInfo(): Promise<WhatsAppChannelInfo>;
  /** Handshake de verificação do webhook, quando o transporte usa webhook. */
  verifyWebhookChallenge(query: URLSearchParams): string | null;
  /** Autentica o payload recebido. */
  verifyWebhookRequest(request: WhatsAppWebhookRequest): boolean;
  /** Normaliza o payload do transporte para o formato interno. */
  parseWebhookPayload(payload: unknown): WhatsAppWebhookEvents;
}

export class WhatsAppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
