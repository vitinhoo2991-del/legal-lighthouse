// Fuso horário da agenda: armazenamos sempre em UTC (timestamptz) e convertemos
// apenas na apresentação, usando o fuso configurado no escritório.

export const DEFAULT_TZ = "America/Sao_Paulo";

function parts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== "literal") out[p.type] = p.value;
  return out;
}

/** Offset (ms) do fuso informado em relação ao UTC para o instante dado. */
function tzOffset(date: Date, timeZone: string) {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(
    Number(p["year"]),
    Number(p["month"]) - 1,
    Number(p["day"]),
    Number(p["hour"] === "24" ? "0" : p["hour"]),
    Number(p["minute"]),
    Number(p["second"]),
  );
  return asUtc - date.getTime();
}

/** Converte "2026-09-12" + "15:00" no fuso do escritório para ISO UTC. */
export function zonedToIso(dateStr: string, timeStr: string, timeZone: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  const naive = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  // duas passadas resolvem mudanças de horário de verão
  let guess = new Date(naive - tzOffset(new Date(naive), timeZone));
  guess = new Date(naive - tzOffset(guess, timeZone));
  return guess.toISOString();
}

/** Campos de formulário (data e hora) para um instante ISO, no fuso do escritório. */
export function isoToZonedFields(iso: string, timeZone: string) {
  const p = parts(new Date(iso), timeZone);
  return {
    date: `${p["year"]}-${p["month"]}-${p["day"]}`,
    time: `${p["hour"] === "24" ? "00" : p["hour"]}:${p["minute"]}`,
  };
}

export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateLong(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(iso));
}

/** Chave YYYY-MM-DD do dia, no fuso do escritório (usada para agrupar eventos). */
export function dayKey(iso: string, timeZone: string) {
  const p = parts(new Date(iso), timeZone);
  return `${p["year"]}-${p["month"]}-${p["day"]}`;
}

export function todayKey(timeZone: string) {
  return dayKey(new Date().toISOString(), timeZone);
}

export function durationLabel(startIso: string, endIso: string) {
  const mins = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function addDays(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function addMonths(dateKey: string, months: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d ?? 1, last));
  return dt.toISOString().slice(0, 10);
}

/** Segunda-feira da semana da data informada. */
export function startOfWeek(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

export function startOfMonth(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

export function endOfMonth(dateKey: string) {
  const [y, m] = dateKey.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${dateKey.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Intervalo ISO (UTC) que cobre os dias informados no fuso do escritório. */
export function rangeIso(startDayKey: string, endDayKey: string, timeZone: string) {
  return {
    from: zonedToIso(startDayKey, "00:00", timeZone),
    to: zonedToIso(addDays(endDayKey, 1), "00:00", timeZone),
  };
}
