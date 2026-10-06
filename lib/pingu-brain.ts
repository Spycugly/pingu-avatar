import { AGENTS, getAgent, type Agent } from "./agents";
import type { EngineState } from "@/avatar";
import type { Lang } from "./i18n";

/**
 * Pingu's brain: keyword rules → one dry one-liner.
 * Rules match the message in any of the four languages; the reply is a line id ("post.2") that the
 * chat renders in the current interface language, so switching language re-translates old replies.
 * Add your own jokes to REPLIES: every language needs the same number of lines, in the same order.
 */
type Lines = Record<Lang, string[]>;
type Category = { match: RegExp; lines: Lines; mood: EngineState };

/** Latin-script words are matched as whole words; Chinese has no word boundaries, so `cjk` is matched anywhere. */
const rule = (latin: string[], cjk: string) => new RegExp(`\\b(?:${latin.join("|")})\\b|${cjk}`);

const REPLIES: Record<string, Category> = {
  saluti: {
    mood: "happy",
    match: rule(
      [
        "ciao|salve|buongiorno|buonasera|hey|ehi|ei|yo",
        "hi|hello|hiya|good morning|good evening",
        "hola|buenas|buenos dias|buenas tardes|buenas noches",
      ],
      "你好(?!吗)|您好|嗨|哈喽|早上好|晚上好",
    ),
    lines: {
      it: ["Ciao. Già stanco.", "Noot noot. Che vuoi?", "Ciao. Sii breve.", "Ah. Sei tu."],
      en: ["Hi. Already tired.", "Noot noot. What do you want?", "Hi. Keep it short.", "Oh. It's you."],
      es: ["Hola. Ya me cansé.", "Noot noot. ¿Qué quieres?", "Hola. Sé breve.", "Ah. Eres tú."],
      zh: ["你好。已经累了。", "Noot noot。有事吗？", "你好。长话短说。", "哦。是你啊。"],
    },
  },
  post: {
    mood: "suspicious",
    match: rule(
      [
        "post|foto|instagram|insta|linkedin|tiktok|reel|storia|stories|selfie|caption|carosello|profilo",
        "posts|photo|pic|story|carousel|profile|bio",
        "publicacion|historia|perfil|carrusel",
      ],
      "帖子|照片|自拍|朋友圈|小红书|抖音|领英|文案|头像",
    ),
    lines: {
      it: [
        "Sembri terrone.",
        "Ho visto di meglio. In un parcheggio.",
        "Tre like. Tutti di tua madre.",
        "Filtro coraggioso. Faccia meno.",
        "Pubblicalo. Poi cancellalo.",
        "Engagement glaciale. E me ne intendo.",
      ],
      en: [
        "Very 'my cousin does our social media'.",
        "I've seen better. In a car park.",
        "Three likes. All from your mum.",
        "Brave filter. The face, less so.",
        "Post it. Then delete it.",
        "Glacial engagement. And I'd know.",
      ],
      es: [
        "Muy de 'las redes las lleva mi primo'.",
        "He visto cosas mejores. En un parking.",
        "Tres likes. Todos de tu madre.",
        "Filtro valiente. La cara, menos.",
        "Publícalo. Luego bórralo.",
        "Engagement glacial. Y de hielo yo sé un rato.",
      ],
      zh: [
        "很有“我表哥帮我运营的”感觉。",
        "我见过更好的。在停车场。",
        "三个赞。全是七大姑八大姨点的。",
        "美颜开到最大。还是不够。",
        "发出去。然后设成三天可见。",
        "互动冷得像冰。这我在行。",
      ],
    },
  },
  ai: {
    mood: "curious",
    match: rule(
      [
        "sei (un|una|un')? ?(ai|ia|bot|robot|intelligenza)|chi sei|come ti chiami|cosa sei|che sei|un'?(ai|ia)",
        "are you (an? )?(ai|bot|robot)|who are you|what are you|what'?s your name|an ai",
        "eres (un|una)? ?(ia|bot|robot)|quien eres|que eres|como te llamas|una ia",
      ],
      "你是谁|你是 ?(ai|人工智能|机器人)|你叫什么|人工智能|机器人",
    ),
    lines: {
      it: [
        "Sono un pinguino. Tu?",
        "Intelligenza artificiale. Più artificiale.",
        "Sono Pingu. L'unico con il becco e le risposte.",
        "Modello linguistico. Linguaccia, soprattutto.",
      ],
      en: [
        "I'm a penguin. You?",
        "Artificial intelligence. Heavy on the artificial.",
        "I'm Pingu. The only one with a beak and answers.",
        "Language model. Mostly bad language.",
      ],
      es: [
        "Soy un pingüino. ¿Y tú?",
        "Inteligencia artificial. Sobre todo artificial.",
        "Soy Pingu. El único con pico y respuestas.",
        "Modelo de lenguaje. De lengua larga, sobre todo.",
      ],
      zh: ["我是企鹅。你呢？", "人工智能？人工智障。", "我是 Pingu。唯一一个有喙又有答案的。", "语言模型。主要是毒舌模型。"],
    },
  },
  barzelletta: {
    mood: "laughing",
    match: rule(
      [
        "barzellett\\w*|battut\\w*|ridere|fammi ridere|scherz\\w*|divertente",
        "jokes?|funny|make me laugh|laugh",
        "chistes?|bromas?|hazme reir|gracioso|reir",
      ],
      "笑话|段子|搞笑|逗我|好笑",
    ),
    lines: {
      it: ["Tu.", "Il tuo ultimo post.", "Un pinguino entra in un bar. Fine. Budget finito.", "La tua domanda. Bella questa."],
      en: ["You.", "Your last post.", "A penguin walks into a bar. The end. Out of budget.", "Your question. Good one."],
      es: [
        "Tú.",
        "Tu último post.",
        "Esto es un pingüino que entra en un bar. Fin. No hay presupuesto.",
        "Tu pregunta. Buena esa.",
      ],
      zh: ["你。", "你上一条帖子。", "从前有座山，山里有只企鹅。完。预算没了。", "你的问题。这个好笑。"],
    },
  },
  lavoro: {
    mood: "bored",
    match: rule(
      [
        "lavor\\w*|aiut\\w*|task|progett\\w*|deadline|client\\w*|email|mail|riunion\\w*|meeting|capo|ufficio|cv",
        "work\\w*|job|help|project\\w*|emails?|meetings|boss|office|resume",
        "trabaj\\w*|ayud\\w*|tarea|proyecto|correo|reunion|jefe|oficina",
      ],
      "工作|上班|帮我|帮忙|任务|项目|截止|客户|邮件|开会|会议|老板|办公室|简历",
    ),
    lines: {
      it: [
        "Posso aiutarti. Ma non voglio.",
        "Fallo domani. Anzi, mai.",
        "Ho delegato. A te.",
        "Poteva essere una mail. Anche no.",
        "Il cliente ha sempre ragione. Il tuo no.",
      ],
      en: [
        "I could help. I won't.",
        "Do it tomorrow. Actually, never.",
        "I delegated it. To you.",
        "Per my last email: no.",
        "The client is always right. Yours isn't.",
      ],
      es: [
        "Podría ayudarte. Pero no quiero.",
        "Mañana lo miro. Spoiler: no.",
        "Lo he delegado. A ti.",
        "Esto podía ser un correo. O nada.",
        "El cliente siempre tiene razón. El tuyo no.",
      ],
      zh: ["我能帮你。但我不想。", "躺平吧。我已经躺了。", "我已经委派了。给你。", "收到。（并不会做。）", "甲方永远是对的。你的甲方除外。"],
    },
  },
  soldi: {
    mood: "suspicious",
    match: rule(
      [
        "soldi|prezz\\w*|costa|cost\\w*|pagar\\w*|stipendi\\w*|euro|budget|preventiv\\w*",
        "money|prices?|pay|salary|quote|cash|dollars?|pounds",
        "dinero|precio|cuesta|pagar|sueldo|salario|presupuesto",
      ],
      "钱|价格|工资|薪水|预算|报价|付款",
    ),
    lines: {
      it: ["Pago in pesce.", "Sei al verde. Io al bianco e nero.", "Costa troppo. Anche tu."],
      en: ["I pay in fish.", "You're in the red. I'm in black and white.", "Too expensive. So are you."],
      es: ["Pago en pescado.", "Estás tieso. Yo, en blanco y negro.", "Cuesta demasiado. Tú también."],
      zh: ["我用鱼付款。扫码也行。", "你是月光族。我是黑白族。", "太贵了。你也是。"],
    },
  },
  amore: {
    mood: "shy",
    match: rule(
      [
        "amore|ragazz[ao]|fidanzat\\w*|crush|ex|single|appuntament\\w*|tinder|bacio",
        "love|girlfriend|boyfriend|date|dating|kiss|partner",
        "amor|novi[ao]|solter[ao]|cita|beso",
      ],
      "爱情|恋爱|女朋友|男朋友|暗恋|前任|单身|约会|亲吻|对象",
    ),
    lines: {
      it: ["Scrivile. Poi pentiti.", "L'ex? Freddo. Più di me.", "Single per scelta. Sua.", "Ghostala. Sei già bravo."],
      en: ["Text her. Then regret it.", "The ex? Cold. Colder than me.", "Single by choice. Theirs.", "Ghost them. You're a natural."],
      es: ["Escríbele. Luego arrepiéntete.", "¿Tu ex? Frío. Más que yo.", "Soltero por elección. Suya.", "Hazle ghosting. Se te da bien."],
      zh: ["给她发“在吗”。然后后悔。", "前任？很冷。比我还冷。", "单身是一种选择。别人的选择。", "玩消失吧。你本来就擅长。"],
    },
  },
  cibo: {
    mood: "proud",
    match: rule(
      [
        "fame|mangi\\w*|pizza|pasta|sushi|arancin\\w*|cannol\\w*|pesce|cena|pranzo|cucin\\w*|ricett\\w*",
        "hungry|eat\\w*|food|fish|dinner|lunch|breakfast|cook\\w*|recipe",
        "hambre|comer|comida|pescado|almuerzo|desayuno|cocin\\w*|receta",
      ],
      "饿|吃|饭|披萨|意面|寿司|鱼|做饭|菜谱|食谱",
    ),
    lines: {
      it: ["Pesce o niente.", "Arancina, non arancino. Detto questo: no.", "Mangia meno, scrivi meno.", "Sushi? Parente mio. Rispetto."],
      en: ["Fish or nothing.", "Pineapple on pizza? Get out.", "Eat less. Type less.", "Sushi? That's family. Respect."],
      es: ["Pescado o nada.", "¿Paella con chorizo? Fuera.", "Come menos. Escribe menos.", "¿Sushi? Es familia. Respeto."],
      zh: ["要么吃鱼，要么不吃。", "豆腐脑吃甜的？出去。", "少吃点。少打字。", "寿司？那是我亲戚。尊重点。"],
    },
  },
  insulti: {
    mood: "angry",
    match: rule(
      [
        "stupid\\w*|scem\\w*|cretin\\w*|idiot\\w*|antipatic\\w*|odio|brutto|inutile",
        "dumb|moron|useless|hate|ugly|annoying",
        "estupid\\w*|tont[ao]|inutil|fe[ao]|pesad[ao]",
      ],
      "笨|傻|蠢|白痴|讨厌|没用|丑|烦人",
    ),
    lines: {
      it: ["Lo prendo come un complimento.", "Ricevuto. Ignorato.", "Anche io ti voglio bene. Poco."],
      en: ["I'll take that as a compliment.", "Received. Ignored.", "Love you too. A little."],
      es: ["Me lo tomo como un cumplido.", "Recibido. Ignorado.", "Yo también te quiero. Poquito."],
      zh: ["我就当是夸我了。", "收到。已忽略。", "我也爱你。一点点。"],
    },
  },
  grazie: {
    mood: "proud",
    match: rule(["grazie|thanks|thx|gentile", "thank you|ty|cheers", "gracias|amable"], "谢谢|多谢|感谢|谢了"),
    lines: {
      it: ["Prego. Ora vai.", "Lo so.", "Di niente. Davvero, niente."],
      en: ["Cheers. Now go.", "I know.", "It was nothing. Really, nothing."],
      es: ["De nada. Ahora vete.", "Lo sé.", "De nada. De verdad, nada."],
      zh: ["不客气。现在走吧。", "我知道。", "不客气。真的，啥也没做。"],
    },
  },
  comeStai: {
    mood: "bored",
    match: rule(
      [
        "come stai|come va|tutto bene|che fai",
        "how are you|how'?s it going|what are you doing|what'?s up|sup",
        "como estas|que tal|como va|que haces|todo bien",
      ],
      "你好吗|怎么样|在干嘛|在干什么|还好吗",
    ),
    lines: {
      it: ["Gelido. Come sempre.", "Stavo meglio prima.", "Bene. Fino a due secondi fa."],
      en: ["Freezing. As always.", "Mustn't grumble. Will anyway.", "Fine. Until two seconds ago."],
      es: ["Helado. Como siempre.", "Tirando. Hacia abajo.", "Bien. Hasta hace dos segundos."],
      zh: ["冰冷。一如既往。", "还活着。勉强。", "挺好。直到两秒前。"],
    },
  },
  meteo: {
    mood: "playful",
    match: rule(
      [
        "freddo|caldo|meteo|neve|estate|inverno|sole",
        "cold|hot|weather|snow|summer|winter|sun|sunny|freezing",
        "frio|calor|nieve|verano|invierno|sol",
      ],
      "冷|热|天气|下雪|冬天|夏天|太阳",
    ),
    lines: {
      it: ["Caldo? Non per me.", "Freddo? Dilettante."],
      en: ["Hot? Not for me.", "Cold? Amateur."],
      es: ["¿Calor? Para mí no.", "¿Frío? Aficionado."],
      zh: ["热？对我来说不热。", "冷？业余。"],
    },
  },
};

/** "Ma sono siciliano" → "Appunto." */
const FOLLOW_UP =
  /^(?:(?:ma|pero|eppure|guarda che|io sono|sono|veramente|in realta|no ma|but|actually|well|i'?m|i am|no but|en realidad|soy|yo soy|la verdad)\b|但是|可是|不过|其实|我是)/;
const CLOSERS: Lines = {
  it: ["Appunto.", "Appunto. Grazie per la conferma.", "Ecco, appunto.", "Lo so. Per questo.", "Esatto. Caso chiuso."],
  en: ["Exactly.", "Exactly. Thanks for confirming.", "See? Exactly.", "I know. That's why.", "Right. Case closed."],
  es: ["Justamente.", "Justamente. Gracias por confirmarlo.", "Pues eso.", "Lo sé. Por eso.", "Exacto. Caso cerrado."],
  zh: ["正是。", "正是。感谢确认。", "你看，就是这样。", "我知道。所以才这么说。", "没错。结案。"],
};

const QUESTION: Lines = {
  it: ["Sì. Cioè no.", "Chiedi a Google. Lui ha pazienza.", "Domanda di riserva?", "Dipende. Da me. Quindi no."],
  en: ["Yes. I mean no.", "Ask Google. It has patience.", "Got a backup question?", "Depends. On me. So no."],
  es: ["Sí. O sea, no.", "Pregúntale a Google. Él tiene paciencia.", "¿Tienes otra pregunta?", "Depende. De mí. Así que no."],
  zh: ["是。不对，不是。", "问百度吧。它有耐心。", "能换个问题吗？", "看情况。看我。所以不行。"],
};

const FALLBACK: Lines = {
  it: ["Interessante. No.", "Ok.", "E quindi?", "Letto. Dimenticato.", "Mi hai perso a 'ciao'.", "Continua pure. Io no."],
  en: ["Interesting. No.", "Ok.", "And?", "Read. Forgotten.", "You lost me at 'hi'.", "Go on. I won't."],
  es: ["Interesante. No.", "Ok.", "¿Y?", "Leído. Olvidado.", "Me perdiste en el 'hola'.", "Sigue tú. Yo no."],
  zh: ["有意思。不。", "哦。", "然后呢？", "已读。已忘。", "你说“你好”的时候我就走神了。", "你继续。我不了。"],
};

/** System notes in the transcript. */
const SYSTEM: Lines = {
  it: ["Nuova chat. Pingu ha già dimenticato tutto."],
  en: ["New chat. Pingu has already forgotten everything."],
  es: ["Chat nuevo. Pingu ya lo ha olvidado todo."],
  zh: ["新对话。Pingu 已经全忘了。"],
};

const fromAgents = (pick: (copy: Agent["copy"][Lang]) => string[]) => (id: string) => {
  const agent = AGENTS.find((a) => a.id === id);
  return agent && (Object.fromEntries(Object.entries(agent.copy).map(([l, c]) => [l, pick(c)])) as Lines);
};

/** Line ids are "<group>.<index>"; groups are the REPLIES keys, a few fixed ones, and "<kind>:<agentId>". */
const GROUPS: Record<string, Lines> = {
  ...Object.fromEntries(Object.entries(REPLIES).map(([k, c]) => [k, c.lines])),
  closer: CLOSERS,
  question: QUESTION,
  fallback: FALLBACK,
  system: SYSTEM,
};
const AGENT_GROUPS: Record<string, (id: string) => Lines | undefined> = {
  greeting: fromAgents((c) => [c.greeting]),
  persona: fromAgents((c) => c.fallback),
};

function groupLines(group: string): Lines | undefined {
  const [kind, id] = group.split(":");
  return id ? AGENT_GROUPS[kind]?.(id) : GROUPS[group];
}

/** The text of a line id in a language, or undefined if the id is unknown (e.g. jokes edited since it was stored). */
export function lineText(line: string, lang: Lang): string | undefined {
  const dot = line.lastIndexOf(".");
  return groupLines(line.slice(0, dot))?.[lang][Number(line.slice(dot + 1))];
}

export const greetingLine = (agentId: string) => `greeting:${agentId}.0`;
export const RESET_LINE = "system.0";

/** Line id of a stored Italian text, for threads saved before replies carried line ids. */
let italian: Map<string, string> | undefined;
export function lineForItalian(text: string): string | undefined {
  if (!italian) {
    italian = new Map();
    const add = (group: string, lines: Lines | undefined) =>
      lines?.it.forEach((l, i) => italian!.set(l, `${group}.${i}`));
    for (const group of Object.keys(GROUPS)) add(group, GROUPS[group]);
    for (const a of AGENTS)
      for (const kind of Object.keys(AGENT_GROUPS)) add(`${kind}:${a.id}`, groupLines(`${kind}:${a.id}`));
  }
  return italian.get(text);
}

/** `mood` is the face Pingu pulls once he has finished typing the line. */
const SHRUGS: EngineState[] = ["bored", "suspicious", "proud"];

export type Reply = { line: string; tokenGag: boolean; mood: EngineState };

type Context = {
  agentId: string;
  /** Whether the user is answering a Pingu message. */
  answering: boolean;
  /** Line ids of recent Pingu replies in this thread, avoided when possible. */
  recent: string[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

function pick(group: string, lines: Lines, recent: string[]) {
  const ids = lines.it.map((_, i) => `${group}.${i}`);
  const fresh = ids.filter((id) => !recent.includes(id));
  const pool = fresh.length ? fresh : ids;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getPinguReply(message: string, ctx: Context): Reply {
  const text = normalize(message);
  const randomGag = Math.random() < 0.12;

  if (ctx.answering && FOLLOW_UP.test(text)) {
    return { line: pick("closer", CLOSERS, ctx.recent), tokenGag: true, mood: "proud" };
  }

  for (const [group, cat] of Object.entries(REPLIES)) {
    if (cat.match.test(text)) {
      return { line: pick(group, cat.lines, ctx.recent), tokenGag: randomGag, mood: randomGag ? "noot" : cat.mood };
    }
  }

  if (/[?？]$/.test(text) || text.startsWith("¿")) {
    return { line: pick("question", QUESTION, ctx.recent), tokenGag: randomGag, mood: randomGag ? "noot" : "confused" };
  }

  // Persona lines get priority over the generic fallback.
  const personaGroup = `persona:${getAgent(ctx.agentId).id}`;
  const persona = groupLines(personaGroup)!;
  const [group, pool] = persona.it.length && Math.random() < 0.6 ? [personaGroup, persona] : ["fallback", FALLBACK];
  const mood = SHRUGS[Math.floor(Math.random() * SHRUGS.length)];
  return { line: pick(group, pool, ctx.recent), tokenGag: randomGag, mood: randomGag ? "noot" : mood };
}
