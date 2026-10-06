import { getAgent } from "./agents";
import type { EngineState } from "@/avatar";

/**
 * Pingu's brain: keyword rules → one dry one-liner.
 * Add your own jokes to REPLIES; each category is matched by its regex.
 */
type Category = { match: RegExp; lines: string[]; mood: EngineState };

const REPLIES: Record<string, Category> = {
  saluti: {
    mood: "happy",
    match: /\b(ciao|salve|buongiorno|buonasera|hey|ehi|ei|yo|hola|hello)\b/,
    lines: ["Ciao. Già stanco.", "Noot noot. Che vuoi?", "Ciao. Sii breve.", "Ah. Sei tu."],
  },
  post: {
    mood: "suspicious",
    match: /\b(post|foto|instagram|insta|linkedin|tiktok|reel|storia|stories|selfie|caption|carosello|profilo)\b/,
    lines: [
      "Sembri terrone.",
      "Ho visto di meglio. In un parcheggio.",
      "Tre like. Tutti di tua madre.",
      "Filtro coraggioso. Faccia meno.",
      "Pubblicalo. Poi cancellalo.",
      "Engagement glaciale. E me ne intendo.",
    ],
  },
  ai: {
    mood: "curious",
    match: /\b(sei (un|una|un')?\s*(ai|ia|bot|robot|intelligenza)|chi sei|come ti chiami|cosa sei|che sei)\b|\bun'?(ai|ia)\b/,
    lines: [
      "Sono un pinguino. Tu?",
      "Intelligenza artificiale. Più artificiale.",
      "Sono Pingu. L'unico con il becco e le risposte.",
      "Modello linguistico. Linguaccia, soprattutto.",
    ],
  },
  barzelletta: {
    mood: "laughing",
    match: /\b(barzellett\w*|battut\w*|ridere|fammi ridere|scherz\w*|divertente)\b/,
    lines: [
      "Tu.",
      "Il tuo ultimo post.",
      "Un pinguino entra in un bar. Fine. Budget finito.",
      "La tua domanda. Bella questa.",
    ],
  },
  lavoro: {
    mood: "bored",
    match: /\b(lavor\w*|aiut\w*|task|progett\w*|deadline|client\w*|email|mail|riunion\w*|meeting|capo|ufficio|cv)\b/,
    lines: [
      "Posso aiutarti. Ma non voglio.",
      "Fallo domani. Anzi, mai.",
      "Ho delegato. A te.",
      "Poteva essere una mail. Anche no.",
      "Il cliente ha sempre ragione. Il tuo no.",
    ],
  },
  soldi: {
    mood: "suspicious",
    match: /\b(soldi|prezz\w*|costa|cost\w*|pagar\w*|stipendi\w*|euro|budget|preventiv\w*)\b/,
    lines: ["Pago in pesce.", "Sei al verde. Io al bianco e nero.", "Costa troppo. Anche tu."],
  },
  amore: {
    mood: "shy",
    match: /\b(amore|ragazz[ao]|fidanzat\w*|crush|ex|single|appuntament\w*|tinder|bacio)\b/,
    lines: ["Scrivile. Poi pentiti.", "L'ex? Freddo. Più di me.", "Single per scelta. Sua.", "Ghostala. Sei già bravo."],
  },
  cibo: {
    mood: "proud",
    match: /\b(fame|mangi\w*|pizza|pasta|sushi|arancin\w*|cannol\w*|pesce|cena|pranzo|cucin\w*|ricett\w*)\b/,
    lines: [
      "Pesce o niente.",
      "Arancina, non arancino. Detto questo: no.",
      "Mangia meno, scrivi meno.",
      "Sushi? Parente mio. Rispetto.",
    ],
  },
  insulti: {
    mood: "angry",
    match: /\b(stupid\w*|scem\w*|cretin\w*|idiot\w*|antipatic\w*|odio|brutto|inutile)\b/,
    lines: ["Lo prendo come un complimento.", "Ricevuto. Ignorato.", "Anche io ti voglio bene. Poco."],
  },
  grazie: {
    mood: "proud",
    match: /\b(grazie|thanks|thx|gentile)\b/,
    lines: ["Prego. Ora vai.", "Lo so.", "Di niente. Davvero, niente."],
  },
  comeStai: {
    mood: "bored",
    match: /\b(come stai|come va|tutto bene|che fai)\b/,
    lines: ["Gelido. Come sempre.", "Stavo meglio prima.", "Bene. Fino a due secondi fa."],
  },
  meteo: {
    mood: "playful",
    match: /\b(freddo|caldo|meteo|neve|estate|inverno|sole)\b/,
    lines: ["Caldo? Non per me.", "Freddo? Dilettante."],
  },
};

/** "Ma sono siciliano" → "Appunto." */
const FOLLOW_UP = /^(ma|pero|eppure|guarda che|io sono|sono|veramente|in realta|no ma)\b/;
const CLOSERS = [
  "Appunto.",
  "Appunto. Grazie per la conferma.",
  "Ecco, appunto.",
  "Lo so. Per questo.",
  "Esatto. Caso chiuso.",
];

const QUESTION = ["Sì. Cioè no.", "Chiedi a Google. Lui ha pazienza.", "Domanda di riserva?", "Dipende. Da me. Quindi no."];

const FALLBACK = [
  "Interessante. No.",
  "Ok.",
  "E quindi?",
  "Letto. Dimenticato.",
  "Mi hai perso a 'ciao'.",
  "Continua pure. Io no.",
];

/** `mood` is the face Pingu pulls once he has finished typing the line. */
const SHRUGS: EngineState[] = ["bored", "suspicious", "proud"];

export type Reply = { text: string; tokenGag: boolean; mood: EngineState };

type Context = {
  agentId: string;
  /** Text of the previous Pingu message, if the user is answering it. */
  previousPingu?: string;
  /** Recent Pingu replies in this thread, avoided when possible. */
  recent: string[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function pick(lines: string[], recent: string[]) {
  const fresh = lines.filter((l) => !recent.includes(l));
  const pool = fresh.length ? fresh : lines;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getPinguReply(message: string, ctx: Context): Reply {
  const text = normalize(message);
  const randomGag = Math.random() < 0.12;

  if (ctx.previousPingu && FOLLOW_UP.test(text)) {
    return { text: pick(CLOSERS, ctx.recent), tokenGag: true, mood: "proud" };
  }

  for (const cat of Object.values(REPLIES)) {
    if (cat.match.test(text)) {
      return { text: pick(cat.lines, ctx.recent), tokenGag: randomGag, mood: randomGag ? "noot" : cat.mood };
    }
  }

  if (text.endsWith("?")) {
    return { text: pick(QUESTION, ctx.recent), tokenGag: randomGag, mood: randomGag ? "noot" : "confused" };
  }

  // Persona lines get priority over the generic fallback.
  const persona = getAgent(ctx.agentId).fallback;
  const pool = Math.random() < 0.6 ? persona : FALLBACK;
  const mood = SHRUGS[Math.floor(Math.random() * SHRUGS.length)];
  return { text: pick(pool, ctx.recent), tokenGag: randomGag, mood: randomGag ? "noot" : mood };
}
