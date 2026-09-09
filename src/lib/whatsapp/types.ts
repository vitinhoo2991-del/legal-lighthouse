// Provider-agnostic WhatsApp contracts.
// Nenhum detalhe da Meta pode vazar deste arquivo: telas, conversas, IA, leads, CRM e documentos
// só conhecem estes tipos.

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
  /** Metadados opcionais de mídia; o provider específico decide como baixá-la. */
  mediaId?: string | null;
  mediaFilename?: string | null;
  mediaMimeType?: string | null;
  mediaSha256?: string | null;
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
 * sem exigir mudança em telas, conversas, IA, leads, CRM ou documentos.
 */
export interface WhatsAppProvider {
  readonly id: WhatsAppProviderId;
  sendText(message: WhatsAppOutboundText): Promise<WhatsAppSendResult>;
  getChannelInfo(): Promise<WhatsAppChannelInfo>;
  verifyWebhookChallenge(query: URLSearchParams): string | null;
  verifyWebhookRequest(request: WhatsAppWebhookRequest): boolean;
  parseWebhookPayload(payload: unknown): WhatsAppWebhookEvents;
}

export class WhatsAppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}