// Compatibilidade: toda a lógica agora vive na camada modular src/lib/whatsapp/*.
// Nenhum módulo novo deve importar detalhes de provedor — use o WhatsAppService.
export { WhatsAppService, getOfficeChannel } from "./whatsapp/service.server";
export { processInboundEvents, sendOutboundText } from "./whatsapp/inbox.server";
export { WhatsAppError } from "./whatsapp/types";
export type {
  WhatsAppProvider,
  WhatsAppProviderId,
  WhatsAppChannelInfo,
  WhatsAppWebhookEvents,
} from "./whatsapp/types";
