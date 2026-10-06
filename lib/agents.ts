import type { EngineState, ShapeName } from "@/avatar";
import type { Lang } from "./i18n";

/** Everything a persona says, per language. `fallback` arrays line up across languages (line ids index into them). */
type Copy = {
  name: string;
  tagline: string;
  greeting: string;
  /** Persona-specific lines used when no keyword matches. */
  fallback: string[];
};

export type Agent = {
  id: string;
  /** Body colour of the penguin; "auto" (PINGU_AUTO) follows the theme: black in light mode, white in dark. */
  color: string;
  shape: ShapeName;
  copy: Record<Lang, Copy>;
  /** Group chats: replies come from one of these agents. */
  members?: string[];
};

export const AGENTS: Agent[] = [
  {
    id: "pingu",
    color: "auto",
    shape: "mochi",
    copy: {
      it: {
        name: "Pingu LinkedIn Strategist",
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
      en: {
        name: "Pingu LinkedIn Strategist",
        tagline: "Thought leader. One line and done.",
        greeting: "Noot noot. I'm Pingu, your LinkedIn Strategist. I answer with one line only, so think carefully.",
        fallback: [
          "Noot noot.",
          "Put it in a carousel. Nobody will read it anyway.",
          "Agree? 👇",
          "Humbled and honoured to ignore this question.",
        ],
      },
      es: {
        name: "Pingu, estratega de LinkedIn",
        tagline: "Thought leader. Una frase y adiós.",
        greeting:
          "Noot noot. Soy Pingu, tu estratega de LinkedIn. Respondo con una sola frase, así que piénsalo bien.",
        fallback: [
          "Noot noot.",
          "Ponlo en un carrusel. Nadie lo leerá igual.",
          "¿De acuerdo? 👇",
          "Humilde y honrado de ignorar esta pregunta.",
        ],
      },
      zh: {
        name: "Pingu 领英策略师",
        tagline: "思想领袖。一句话就走。",
        greeting: "Noot noot。我是 Pingu，你的领英策略师。我只回一句话，所以想清楚再问。",
        fallback: ["Noot noot。", "做成轮播图吧。反正没人看。", "同意吗？👇", "很荣幸，也很谦卑地忽略这个问题。"],
      },
    },
  },
  {
    id: "critico",
    color: "#ef9231",
    shape: "wedge",
    copy: {
      it: {
        name: "Critico Social",
        tagline: "Giudica i tuoi post. Male.",
        greeting: "Mandami il tuo ultimo post. Prometto di essere onesto. Troppo.",
        fallback: [
          "Lo posterei. Sul tuo profilo secondario.",
          "Manca qualcosa. Il talento.",
          "Algoritmo perplesso. Anche io.",
        ],
      },
      en: {
        name: "Social Critic",
        tagline: "Judges your posts. Harshly.",
        greeting: "Send me your latest post. I promise to be honest. Too honest.",
        fallback: [
          "I'd post it. On your second account.",
          "Something's missing. Talent.",
          "The algorithm is confused. So am I.",
        ],
      },
      es: {
        name: "Crítico Social",
        tagline: "Juzga tus posts. Mal.",
        greeting: "Mándame tu último post. Prometo ser sincero. Demasiado.",
        fallback: [
          "Lo publicaría. En tu cuenta secundaria.",
          "Falta algo. El talento.",
          "El algoritmo está perplejo. Yo también.",
        ],
      },
      zh: {
        name: "社交评论家",
        tagline: "点评你的帖子。很毒。",
        greeting: "把你最新的帖子发来。我保证很诚实。太诚实。",
        fallback: ["我会发的。发在你的小号上。", "少了点什么。才华。", "算法很困惑。我也是。"],
      },
    },
  },
  {
    id: "carriera",
    color: "#3b7ff2",
    shape: "squircle",
    copy: {
      it: {
        name: "Coach Carriera",
        tagline: "Ti motiva. Più o meno.",
        greeting: "Parliamo della tua carriera. Breve, come la tua pazienza.",
        fallback: [
          "Mettilo su LinkedIn. Nessuno leggerà.",
          "Hai pensato alla pensione anticipata?",
          "Scrivilo nel CV. In fondo.",
        ],
      },
      en: {
        name: "Career Coach",
        tagline: "Motivates you. Roughly.",
        greeting: "Let's talk about your career. Briefly, like your patience.",
        fallback: [
          "Put it on LinkedIn. Nobody will read it.",
          "Have you considered early retirement?",
          "Put it on your CV. At the bottom.",
        ],
      },
      es: {
        name: "Coach de Carrera",
        tagline: "Te motiva. Más o menos.",
        greeting: "Hablemos de tu carrera. Breve, como tu paciencia.",
        fallback: ["Ponlo en LinkedIn. Nadie lo leerá.", "¿Has pensado en jubilarte antes?", "Ponlo en el CV. Al final."],
      },
      zh: {
        name: "职业教练",
        tagline: "激励你。差不多吧。",
        greeting: "聊聊你的职业吧。简短点，就像你的耐心。",
        fallback: ["发到领英上。没人会看。", "考虑过提前退休吗？", "写进简历里。放最后。"],
      },
    },
  },
  {
    id: "cuore",
    color: "#936ef5",
    shape: "blob",
    copy: {
      it: {
        name: "Coach Sentimentale",
        tagline: "Consigli d'amore discutibili.",
        greeting: "Raccontami tutto. Poi ti dico che hai sbagliato.",
        fallback: ["Non risponderle. Anzi sì. Anzi no.", "Red flag. Anche questa frase.", "Il problema non è lei."],
      },
      en: {
        name: "Love Coach",
        tagline: "Questionable love advice.",
        greeting: "Tell me everything. Then I'll tell you where you went wrong.",
        fallback: ["Don't reply. Actually, do. Actually, don't.", "Red flag. This sentence too.", "She's not the problem."],
      },
      es: {
        name: "Coach Sentimental",
        tagline: "Consejos de amor discutibles.",
        greeting: "Cuéntamelo todo. Luego te digo en qué te equivocaste.",
        fallback: ["No le contestes. Bueno, sí. Bueno, no.", "Red flag. Esta frase también.", "El problema no es ella."],
      },
      zh: {
        name: "情感教练",
        tagline: "可疑的恋爱建议。",
        greeting: "全都告诉我。然后我告诉你错在哪。",
        fallback: ["别回她。还是回吧。算了别回。", "危险信号。这句话也是。", "问题不在她。"],
      },
    },
  },
  {
    id: "chef",
    color: "#68bead",
    shape: "egg",
    copy: {
      it: {
        name: "Chef Pinguino",
        tagline: "Cucina solo pesce.",
        greeting: "Benvenuto in cucina. Menù: pesce. Alternative: pesce.",
        fallback: ["Aggiungi pesce. Risolve tutto.", "Troppo sale. Nella domanda.", "Lo chef sconsiglia. Anche te."],
      },
      en: {
        name: "Chef Penguin",
        tagline: "Cooks fish only.",
        greeting: "Welcome to the kitchen. Menu: fish. Alternatives: fish.",
        fallback: [
          "Add fish. Fixes everything.",
          "Too much salt. In the question.",
          "The chef advises against it. And against you.",
        ],
      },
      es: {
        name: "Chef Pingüino",
        tagline: "Solo cocina pescado.",
        greeting: "Bienvenido a la cocina. Menú: pescado. Alternativas: pescado.",
        fallback: [
          "Añade pescado. Lo arregla todo.",
          "Demasiada sal. En la pregunta.",
          "El chef no lo recomienda. A ti tampoco.",
        ],
      },
      zh: {
        name: "企鹅大厨",
        tagline: "只做鱼。",
        greeting: "欢迎来到厨房。菜单：鱼。备选：鱼。",
        fallback: ["加点鱼。什么都能解决。", "太咸了。我说的是你的问题。", "主厨不推荐。也不推荐你。"],
      },
    },
  },
  {
    id: "colonia",
    color: "auto",
    shape: "mochi",
    copy: {
      it: {
        name: "Colonia",
        tagline: "Tutti i pinguini. Nessuna pazienza.",
        greeting: "Siamo tutti qui. Purtroppo anche tu.",
        fallback: [],
      },
      en: { name: "Colony", tagline: "Every penguin. No patience.", greeting: "We're all here. Sadly, so are you.", fallback: [] },
      es: {
        name: "Colonia",
        tagline: "Todos los pingüinos. Nada de paciencia.",
        greeting: "Estamos todos aquí. Por desgracia, tú también.",
        fallback: [],
      },
      zh: { name: "企鹅群", tagline: "所有企鹅。零耐心。", greeting: "我们都在。可惜你也在。", fallback: [] },
    },
    members: ["pingu", "critico", "carriera", "cuore", "chef"],
  },
];

export const getAgent = (id: string) => AGENTS.find((a) => a.id === id) ?? AGENTS[0];

/** Composer "+" button: each one trips a keyword rule in its own language. */
export const SUGGESTIONS: Record<Lang, string[]> = {
  it: ["Che ne pensi del post?", "Mi aiuti col lavoro?", "Sei un'AI?", "Raccontami una barzelletta"],
  en: ["What do you think of my post?", "Can you help me with work?", "Are you an AI?", "Tell me a joke"],
  es: ["¿Qué te parece mi publicación?", "¿Me ayudas con el trabajo?", "¿Eres una IA?", "Cuéntame un chiste"],
  zh: ["你觉得我的帖子怎么样？", "能帮我处理工作吗？", "你是 AI 吗？", "给我讲个笑话"],
};

/** What Pingu does while "thinking": each beat is an avatar state (labelled by the `beat.<state>` i18n key). */
export const THINKING_BEATS: { state: EngineState; min: number; max: number }[] = [
  { state: "searching", min: 1300, max: 1700 },
  { state: "writing", min: 1500, max: 1900 },
  { state: "working", min: 1500, max: 2000 },
  { state: "radar", min: 1300, max: 1700 },
  { state: "orbit", min: 1300, max: 1700 },
];
