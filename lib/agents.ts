import type { EngineState, ShapeName } from "@/avatar";

export type Agent = {
  id: string;
  name: string;
  /** Body colour of the penguin; "auto" (PINGU_AUTO) follows the theme: black in light mode, white in dark. */
  color: string;
  shape: ShapeName;
  tagline: string;
  greeting: string;
  /** Persona-specific lines used when no keyword matches. */
  fallback: string[];
  /** Group chats: replies come from one of these agents. */
  members?: string[];
};

export const AGENTS: Agent[] = [
  {
    id: "pingu",
    name: "Pingu LinkedIn Strategist",
    color: "auto",
    shape: "mochi",
    tagline: "Thought leader. Una battuta e via.",
    greeting:
      "Noot noot. Sono Pingu, il tuo LinkedIn Strategist. Rispondo con una battuta sola, quindi pensaci bene.",
    fallback: [
      "Noot noot.",
      "Mettilo in un carosello. Nessuno lo leggerà comunque.",
      "Agree? 👇",
      "Umiliato e onorato di ignorare questa domanda.",
    ],
  },
  {
    id: "critico",
    name: "Critico Social",
    color: "#ef9231",
    shape: "wedge",
    tagline: "Giudica i tuoi post. Male.",
    greeting: "Mandami il tuo ultimo post. Prometto di essere onesto. Troppo.",
    fallback: [
      "Lo posterei. Sul tuo profilo secondario.",
      "Manca qualcosa. Il talento.",
      "Algoritmo perplesso. Anche io.",
    ],
  },
  {
    id: "carriera",
    name: "Coach Carriera",
    color: "#3b7ff2",
    shape: "squircle",
    tagline: "Ti motiva. Più o meno.",
    greeting: "Parliamo della tua carriera. Breve, come la tua pazienza.",
    fallback: [
      "Mettilo su LinkedIn. Nessuno leggerà.",
      "Hai pensato alla pensione anticipata?",
      "Scrivilo nel CV. In fondo.",
    ],
  },
  {
    id: "cuore",
    name: "Coach Sentimentale",
    color: "#936ef5",
    shape: "blob",
    tagline: "Consigli d'amore discutibili.",
    greeting: "Raccontami tutto. Poi ti dico che hai sbagliato.",
    fallback: [
      "Non risponderle. Anzi sì. Anzi no.",
      "Red flag. Anche questa frase.",
      "Il problema non è lei.",
    ],
  },
  {
    id: "chef",
    name: "Chef Pinguino",
    color: "#68bead",
    shape: "egg",
    tagline: "Cucina solo pesce.",
    greeting: "Benvenuto in cucina. Menù: pesce. Alternative: pesce.",
    fallback: [
      "Aggiungi pesce. Risolve tutto.",
      "Troppo sale. Nella domanda.",
      "Lo chef sconsiglia. Anche te.",
    ],
  },
  {
    id: "colonia",
    name: "Colonia",
    color: "auto",
    shape: "mochi",
    tagline: "Tutti i pinguini. Nessuna pazienza.",
    greeting: "Siamo tutti qui. Purtroppo anche tu.",
    fallback: [],
    members: ["pingu", "critico", "carriera", "cuore", "chef"],
  },
];

export const getAgent = (id: string) => AGENTS.find((a) => a.id === id) ?? AGENTS[0];

export const SUGGESTIONS = [
  "Che ne pensi del post?",
  "Mi aiuti col lavoro?",
  "Sei un'AI?",
  "Raccontami una barzelletta",
];

/** What Pingu does while "thinking": each beat is an avatar state plus its label (Grok-style pending row). */
export const THINKING_BEATS: { state: EngineState; label: string; min: number; max: number }[] = [
  { state: "searching", label: "Consulto i pinguini anziani", min: 1300, max: 1700 },
  { state: "writing", label: "Cerco l'offesa giusta", min: 1500, max: 1900 },
  { state: "working", label: "Scaldo il becco", min: 1500, max: 2000 },
  { state: "radar", label: "Controllo i token", min: 1300, max: 1700 },
  { state: "orbit", label: "Scivolo sul ghiaccio", min: 1300, max: 1700 },
];
