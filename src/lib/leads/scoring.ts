// Cálculo do Lead Score — determinístico e explicável.
// Não há aleatoriedade: o mesmo conjunto de informações gera sempre o mesmo score.

export type LeadUrgency = "desconhecida" | "baixa" | "media" | "alta" | "critica";
export type LeadIntent = "desconhecida" | "informacao" | "avaliando" | "contratar";
export type LeadTemperature = "frio" | "morno" | "quente";
export type LeadStatus =
  | "novo"
  | "em_qualificacao"
  | "qualificado"
  | "incompleto"
  | "desqualificado"
  | "atendimento_humano";

export const INTENT_SIGNALS = [
  "honorarios",
  "contratacao",
  "consulta",
  "documentos",
  "falar_com_advogado",
  "agendamento",
  "urgencia",
  "enviou_documentos",
] as const;
export type IntentSignal = (typeof INTENT_SIGNALS)[number];

const SIGNAL_LABEL: Record<IntentSignal, string> = {
  honorarios: "perguntou sobre honorários",
  contratacao: "perguntou sobre contratação",
  consulta: "perguntou sobre consulta",
  documentos: "perguntou quais documentos são necessários",
  falar_com_advogado: "pediu para falar com um advogado",
  agendamento: "pediu agendamento",
  urgencia: "demonstrou urgência",
  enviou_documentos: "enviou documentos ou informações relevantes",
};

export interface ScoreInput {
  name: string | null;
  phone: string | null;
  email: string | null;
  practiceArea: string | null;
  practiceAreaMatch: boolean | null;
  caseType: string | null;
  caseSummary: string | null;
  urgency: LeadUrgency;
  intent: LeadIntent;
  hasDeadline: boolean | null;
  deadline: string | null;
  signals: IntentSignal[];
}

export interface ScoreResult {
  score: number;
  temperature: LeadTemperature;
  reason: string;
  breakdown: Record<string, number>;
}

const INTENT_POINTS: Record<LeadIntent, number> = {
  contratar: 35,
  avaliando: 20,
  informacao: 8,
  desconhecida: 0,
};

const URGENCY_POINTS: Record<LeadUrgency, number> = {
  critica: 20,
  alta: 16,
  media: 9,
  baixa: 3,
  desconhecida: 0,
};

const INTENT_TEXT: Record<LeadIntent, string> = {
  contratar: "intenção clara de contratar",
  avaliando: "interesse moderado, ainda avaliando",
  informacao: "busca apenas informações gerais",
  desconhecida: "intenção ainda não identificada",
};

const URGENCY_TEXT: Record<LeadUrgency, string> = {
  critica: "situação crítica",
  alta: "caso urgente",
  media: "urgência moderada",
  baixa: "sem urgência declarada",
  desconhecida: "urgência ainda não identificada",
};

export function temperatureFor(score: number): LeadTemperature {
  if (score >= 70) return "quente";
  if (score >= 40) return "morno";
  return "frio";
}

export function computeLeadScore(input: ScoreInput): ScoreResult {
  const intentPoints = INTENT_POINTS[input.intent] ?? 0;
  const urgencyPoints = URGENCY_POINTS[input.urgency] ?? 0;

  let areaPoints = 0;
  if (input.practiceAreaMatch === true) areaPoints = 20;
  else if (input.practiceAreaMatch === false) areaPoints = -15;

  const completenessChecks = [
    Boolean(input.name),
    Boolean(input.phone || input.email),
    Boolean(input.practiceArea),
    Boolean(input.caseType || input.caseSummary),
    input.urgency !== "desconhecida",
    input.hasDeadline === false || Boolean(input.deadline),
    input.intent !== "desconhecida",
  ];
  const confirmed = completenessChecks.filter(Boolean).length;
  const completenessPoints = Math.round((confirmed / completenessChecks.length) * 15);

  const uniqueSignals = Array.from(new Set(input.signals)).filter((s) =>
    (INTENT_SIGNALS as readonly string[]).includes(s),
  ) as IntentSignal[];
  const signalPoints = Math.min(10, uniqueSignals.length * 2.5);

  const raw = intentPoints + urgencyPoints + areaPoints + completenessPoints + signalPoints;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const temperature = temperatureFor(score);

  const pieces: string[] = [INTENT_TEXT[input.intent]];
  if (input.urgency !== "desconhecida") pieces.push(URGENCY_TEXT[input.urgency]);
  if (input.practiceAreaMatch === true)
    pieces.push(`caso dentro das áreas atendidas${input.practiceArea ? ` (${input.practiceArea})` : ""}`);
  if (input.practiceAreaMatch === false)
    pieces.push(
      `assunto fora das áreas de atuação do escritório${input.practiceArea ? ` (${input.practiceArea})` : ""}`,
    );
  pieces.push(`${confirmed} de ${completenessChecks.length} informações essenciais confirmadas`);
  if (uniqueSignals.length)
    pieces.push(`sinais identificados: ${uniqueSignals.map((s) => SIGNAL_LABEL[s]).join(", ")}`);

  const label = temperature === "quente" ? "Lead quente" : temperature === "morno" ? "Lead morno" : "Lead frio";
  const reason = `Score ${score} — ${label}. ${pieces.join("; ")}.`;

  return {
    score,
    temperature,
    reason,
    breakdown: {
      intencao: intentPoints,
      urgencia: urgencyPoints,
      aderencia: areaPoints,
      informacoes: completenessPoints,
      sinais: signalPoints,
    },
  };
}

export function deriveStatus(options: {
  input: ScoreInput;
  missingInformation: string[];
  messageCount: number;
  humanHandled: boolean;
  disqualified: boolean;
}): LeadStatus {
  if (options.humanHandled) return "atendimento_humano";
  if (options.disqualified) return "desqualificado";
  if (
    options.input.practiceAreaMatch === false &&
    options.input.intent !== "contratar" &&
    options.input.intent !== "avaliando"
  ) {
    return "desqualificado";
  }

  const essentials =
    Boolean(options.input.practiceArea) &&
    Boolean(options.input.caseSummary) &&
    options.input.intent !== "desconhecida" &&
    Boolean(options.input.name || options.input.phone);

  if (essentials && options.missingInformation.length === 0) return "qualificado";
  if (essentials) return "incompleto";
  if (options.messageCount >= 6) return "incompleto";
  return "em_qualificacao";
}
