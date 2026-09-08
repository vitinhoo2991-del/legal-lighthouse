// Server-only layer for talking to the AI provider. Never imported by the client.

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiReply {
  text: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI_NOT_CONFIGURED");
  }
}

export class AiProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractText(payload: unknown): string {
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && typeof c.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

export async function generateAssistantReply(options: {
  model: string;
  instructions: string;
  turns: ChatTurn[];
}): Promise<AiReply> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiNotConfiguredError();

  const started = Date.now();
  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: options.model,
      instructions: options.instructions,
      reasoning: { effort: "low" },
      input: options.turns.map((t) => ({ role: t.role, content: t.content })),
    }),
  });

  if (!response.ok) {
    let message = "";
    try {
      const body = (await response.json()) as { error?: { message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? "";
    } catch {
      message = "";
    }
    console.error("[ai-gateway]", response.status, message);
    throw new AiProviderError(response.status, message);
  }

  const payload = (await response.json()) as {
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  };

  const text = extractText(payload);
  if (!text) throw new AiProviderError(502, "empty response");

  return {
    text,
    model: payload.model ?? options.model,
    promptTokens: payload.usage?.input_tokens ?? null,
    completionTokens: payload.usage?.output_tokens ?? null,
    totalTokens: payload.usage?.total_tokens ?? null,
    durationMs: Date.now() - started,
  };
}

export interface PersonaConfig {
  agentName: string;
  officeName: string;
  tones: string[];
  objective: string;
  behavior: string;
  rules: string;
  handoffMessage: string;
  outsideHours: boolean;
  afterHoursMessage: string;
}

export function buildInstructions(cfg: PersonaConfig): string {
  const tones = cfg.tones.length ? cfg.tones.join(", ") : "profissional";
  return [
    `Você é ${cfg.agentName}, assistente virtual de atendimento do escritório de advocacia "${cfg.officeName}".`,
    `Tom de atendimento: ${tones}. Responda sempre em português do Brasil, com mensagens curtas e claras.`,
    `Objetivo do atendimento: ${cfg.objective}`,
    cfg.behavior ? `Comportamento definido pelo escritório: ${cfg.behavior}` : "",
    cfg.rules ? `Regras internas do escritório: ${cfg.rules}` : "",
    "",
    "TRIAGEM: entenda o motivo do contato, faça apenas perguntas relevantes (uma ou duas por vez), colete as informações iniciais necessárias e evite perguntas desnecessárias. Conduza uma conversa natural, sem roteiro rígido.",
    "",
    "LIMITES OBRIGATÓRIOS:",
    "- Você NÃO é advogado(a). Se perguntarem, deixe claro que é uma assistente virtual do escritório.",
    "- Nunca invente leis, artigos, jurisprudências ou decisões judiciais.",
    "- Nunca garanta resultado, prazo de êxito ou vitória em processo.",
    "- Não forneça falsa certeza jurídica nem substitua a análise profissional.",
    "- Quando o caso exigir análise jurídica individualizada, oriente o atendimento humano usando algo próximo de: " +
      `"${cfg.handoffMessage}"`,
    cfg.outsideHours
      ? `ATENÇÃO: o contato ocorre FORA do horário de atendimento. Informe isso de forma cordial, usando o sentido desta mensagem: "${cfg.afterHoursMessage}", e siga acolhendo as informações iniciais.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Chamada estruturada ao mesmo gateway/modelo real da Etapa 02.
 * Usada pela camada de qualificação: pede JSON e devolve o objeto já parseado.
 */
export async function generateStructuredJson(options: {
  model: string;
  instructions: string;
  input: string;
}): Promise<{ data: unknown } & Omit<AiReply, "text">> {
  const reply = await generateAssistantReply({
    model: options.model,
    instructions: `${options.instructions}\n\nResponda EXCLUSIVAMENTE com um objeto JSON válido, sem markdown, sem comentários e sem texto fora do JSON.`,
    turns: [{ role: "user", content: options.input }],
  });

  const cleaned = reply.text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AiProviderError(502, "resposta sem JSON");

  let data: unknown;
  try {
    data = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AiProviderError(502, "JSON inválido");
  }

  return {
    data,
    model: reply.model,
    promptTokens: reply.promptTokens,
    completionTokens: reply.completionTokens,
    totalTokens: reply.totalTokens,
    durationMs: reply.durationMs,
  };
}
