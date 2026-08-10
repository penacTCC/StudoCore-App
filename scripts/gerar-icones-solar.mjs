/**
 * Gera `components/ui/icons/dados.ts` a partir do `@iconify-json/solar`.
 *
 * O app inteiro desenha ícones no estilo Solar (https://www.figma.com/community/file/1166831539721848736,
 * CC BY 4.0). Em vez de depender do Iconify em tempo de execução — que traria um
 * parser de SVG só pra montar dez formas —, este script lê o pacote de dados uma
 * vez e cospe as formas já prontas como objetos JS.
 *
 * Rodar depois de mexer no MAPA:
 *   npm i --no-save @iconify-json/solar && node scripts/gerar-icones-solar.mjs
 *
 * Cada ícone sai em dois pares: `outline` (contorno) e `bold` (preenchido). Os
 * nomes das chaves são os mesmos que o app já usava no lucide-react-native, então
 * a troca no lado das telas foi só o caminho do import.
 */

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * De cada nome que o app usa pro nome do desenho no Solar.
 *
 * Onde o Solar não tem o desenho exato, entrou o vizinho mais próximo em
 * significado — comentado, porque a escolha não é óbvia lendo só os dois nomes.
 */
const MAPA = {
    // Setas e navegação
    ArrowLeft: "arrow-left",
    ArrowUp: "arrow-up",
    ArrowRightCircle: "round-arrow-right",
    ChevronDown: "alt-arrow-down",
    ChevronLeft: "alt-arrow-left",
    ChevronRight: "alt-arrow-right",
    ChevronUp: "alt-arrow-up",

    // Avisos e estados
    AlertCircle: "danger-circle",
    CircleAlert: "danger-circle",
    AlertTriangle: "danger-triangle",
    Info: "info-circle",
    CheckCircle: "check-circle",
    CheckCircle2: "check-circle",
    CheckCheck: "check-read",
    XCircle: "close-circle",
    MinusCircle: "minus-circle",
    CloudOff: "cloud-cross",

    // Tempo
    AlarmClock: "alarm",
    Clock: "clock-circle",
    Timer: "stopwatch",
    Calendar: "calendar",
    CalendarClock: "calendar-mark",
    CalendarDays: "calendar-minimalistic",
    CalendarPlus: "calendar-add",
    CalendarRange: "calendar-date",

    // Mídia e controles
    Play: "play",
    Pause: "pause",
    Square: "stop", // botão de parar a sessão, não um quadrado solto
    SkipForward: "skip-next",
    RefreshCw: "refresh",
    RotateCw: "restart",
    RotateCcw: "restart",
    Repeat: "repeat",

    // Pessoas
    User: "user",
    Users: "users-group-rounded",
    UserPlus: "user-plus",
    UserX: "user-cross",
    HandMetal: "hand-stars", // o "salve" pra quem está focando junto
    Swords: "bolt", // confronto/comparação: o Solar não tem espadas
    Crown: "crown",
    Medal: "medal-ribbon-star",
    Trophy: "cup-star",

    // Abas
    Home: "home-angle",

    // Estudo
    Brain: "atom", // o Solar não tem cérebro; o átomo carrega o mesmo "estudo/IA"
    BrainCircuit: "atom",
    BookOpen: "book",
    Bookmark: "bookmark",
    Lightbulb: "lightbulb",
    Target: "target",
    Flag: "flag",
    Flame: "fire",
    Star: "star",
    Heart: "heart",
    BadgeCheck: "verified-check",
    PartyPopper: "confetti",
    GraduationCap: "square-academic-cap",
    Briefcase: "case-minimalistic",
    Shuffle: "shuffle",
    Paperclip: "paperclip",
    GitCompareArrows: "transfer-horizontal", // comparar dois perfis lado a lado
    Maximize2: "maximize",
    FolderArchive: "archive",
    Download: "download-minimalistic",
    Ellipsis: "menu-dots",
    MoreHorizontal: "menu-dots",
    CalendarCheck: "calendar-mark",
    Rocket: "rocket",
    Sparkles: "stars",
    Zap: "bolt-circle",
    Telescope: "telescope",
    Compass: "compass",
    Globe: "global",

    // Arquivos
    FileText: "file-text",
    FileUp: "upload-minimalistic",
    Folder: "folder",
    FolderOpen: "folder-open",
    ClipboardList: "clipboard-list",
    ListChecks: "checklist",
    LayoutList: "checklist-minimalistic",
    LayoutGrid: "widget",
    Layers: "layers",
    Copy: "copy",
    Trash2: "trash-bin-trash",

    // Imagem
    Image: "gallery",
    Images: "album",
    ImageOff: "gallery-remove",
    Camera: "camera",

    // Gráficos
    BarChart3: "chart-2",
    PieChart: "pie-chart",
    TrendingUp: "graph-up",
    TrendingDown: "graph-down",

    // Ações e formulários
    Search: "magnifer",
    Send: "plain-2",
    Share2: "share",
    Link: "link",
    Pin: "pin",
    Settings: "settings",
    SlidersHorizontal: "tuning-2",
    Edit: "pen-new-square",
    Pencil: "pen",
    Eye: "eye",
    EyeOff: "eye-closed",
    Lock: "lock",
    LockKeyhole: "lock-keyhole",
    LogIn: "login-3",
    LogOut: "logout-3",
    Mail: "letter",
    AtSign: "mention-circle",
    Bell: "bell",
    MessageCircle: "chat-round",
    Menu: "hamburger-menu",
    GripVertical: "hamburger-menu", // alça de arrastar: três traços em vez de pontos
    MousePointerClick: "cursor",
    Coffee: "cup-hot",
    Wind: "wind",
};

/**
 * O Solar desenha tudo dentro de um contêiner: não existe um "x" nem um "check"
 * soltos. Estes quatro são desenhados à mão seguindo a régua do estilo Linear do
 * próprio Solar — grade de 24, traço 1.5 e pontas arredondadas —, e o `bold` é o
 * mesmo traçado mais grosso.
 */
const GLIFOS = {
    Check: "m4 12.9l5 5l11-11",
    X: "m6.5 17.5l11-11m0 11l-11-11",
    Plus: "M12 5v14M5 12h14",
    Minus: "M5 12h14",
};

/** Espessura do traço de cada variante dos glifos desenhados à mão. */
const TRACO = { outline: 1.5, bold: 2.5 };

/**
 * O GitHub é uma marca, então não está (e nem estaria) no Solar. Fica aqui o
 * desenho oficial do Simple Icons pra não sobrar um import solto do lucide só por
 * causa do botão de login.
 */
const MARCAS = {
    Github:
        "M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
};

// ---------------------------------------------------------------------------

const dados = require("@iconify-json/solar/icons.json").icons;

/** Marcador que o componente troca pela cor recebida na hora de desenhar. */
const COR = "@cor";

const TAGS = new Set(["path", "circle", "ellipse", "rect", "line", "polygon"]);

function paraCamelo(atributo) {
    return atributo.replace(/-([a-z])/g, (_, letra) => letra.toUpperCase());
}

/** Lê os `attr="valor"` de uma tag. */
function lerAtributos(texto) {
    const saida = {};
    for (const [, chave, valor] of texto.matchAll(/([\w-]+)="([^"]*)"/g)) {
        saida[paraCamelo(chave)] = valor === "currentColor" ? COR : valor;
    }
    return saida;
}

/**
 * Achata o corpo SVG do Iconify numa lista de formas. Os `<g>` só existem pra
 * compartilhar atributos entre os filhos, então aqui eles somem e os atributos
 * descem — o que sobra é uma lista rasa que o componente percorre e desenha.
 */
function achatar(corpo, herdados = {}) {
    const formas = [];
    const regex = /<(\w+)([^>]*?)(\/?)>/g;
    let m;
    while ((m = regex.exec(corpo))) {
        const [, tag, atributos, fechada] = m;
        if (tag === "g") {
            const fim = acharFechamento(corpo, regex.lastIndex);
            const dentro = corpo.slice(regex.lastIndex, fim);
            formas.push(...achatar(dentro, { ...herdados, ...lerAtributos(atributos) }));
            regex.lastIndex = fim;
            continue;
        }
        if (!TAGS.has(tag)) continue;
        if (!fechada && !atributos.endsWith("/")) {
            // Formas do Solar são todas vazias; se aparecer uma com filhos, é bug.
            throw new Error(`<${tag}> com conteúdo não é suportado`);
        }
        formas.push({ tag, props: { ...herdados, ...lerAtributos(atributos) } });
    }
    return formas;
}

/** Onde termina o `<g>` aberto, respeitando `<g>` aninhado. */
function acharFechamento(corpo, inicio) {
    let profundidade = 1;
    const regex = /<(\/?)g[\s>]/g;
    regex.lastIndex = inicio;
    let m;
    while ((m = regex.exec(corpo))) {
        profundidade += m[1] ? -1 : 1;
        if (profundidade === 0) return m.index;
    }
    return corpo.length;
}

/**
 * Alguns desenhos do Solar fazem os vazados com `<mask>`: uma forma branca é o
 * corpo e as pretas são os furos, e aí um retângulo do tamanho do ícone é pintado
 * através da máscara. Máscara é caro no react-native-svg e obrigaria a guardar a
 * árvore inteira em vez de uma lista rasa — então aqui os dois traçados viram um
 * só com `evenodd`, regra em que um contorno dentro do outro já abre buraco. Dá o
 * mesmo resultado porque nesses ícones o furo está sempre dentro do corpo.
 */
function converterMascara(corpo) {
    const dentroDaMascara = corpo.slice(corpo.indexOf("<mask"), corpo.indexOf("</mask>"));
    const traçados = [];
    for (const forma of achatar(dentroDaMascara)) {
        if (forma.tag !== "path") throw new Error("máscara com forma que não é path");
        traçados.push(forma.props.d);
    }
    return [{ tag: "path", props: { fill: COR, fillRule: "evenodd", clipRule: "evenodd", d: traçados.join(" ") } }];
}

function pegar(nomeSolar, variante) {
    const chave = `${nomeSolar}-${variante}`;
    const icone = dados[chave];
    if (!icone) throw new Error(`ícone ausente no Solar: ${chave}`);
    if (icone.body.includes("<mask")) return converterMascara(icone.body);
    if (/<(defs|use|clipPath)/.test(icone.body)) throw new Error(`desenho com ${chave} usa recurso não suportado`);
    return achatar(icone.body);
}

const icones = {};
const faltando = [];

for (const [nomeApp, nomeSolar] of Object.entries(MAPA)) {
    try {
        icones[nomeApp] = { outline: pegar(nomeSolar, "outline"), bold: pegar(nomeSolar, "bold") };
    } catch (erro) {
        faltando.push(`${nomeApp} -> ${nomeSolar}: ${erro.message}`);
    }
}

for (const [nomeApp, d] of Object.entries(GLIFOS)) {
    const traco = (largura) => [
        {
            tag: "path",
            props: {
                d,
                fill: "none",
                stroke: COR,
                strokeWidth: String(largura),
                strokeLinecap: "round",
                strokeLinejoin: "round",
            },
        },
    ];
    icones[nomeApp] = { outline: traco(TRACO.outline), bold: traco(TRACO.bold) };
}

for (const [nomeApp, d] of Object.entries(MARCAS)) {
    const forma = [{ tag: "path", props: { d, fill: COR } }];
    icones[nomeApp] = { outline: forma, bold: forma };
}

if (faltando.length) {
    console.error("Não achei no Solar:\n  " + faltando.join("\n  "));
    process.exit(1);
}

const nomes = Object.keys(icones).sort();
const corpo = nomes
    .map((nome) => `    ${nome}: ${JSON.stringify(icones[nome])},`)
    .join("\n");

const arquivo = `// GERADO por scripts/gerar-icones-solar.mjs — não editar à mão.
//
// Formas dos ícones Solar (CC BY 4.0), em pares contorno/preenchido. Ver o script
// pra saber de onde vem cada desenho e por que alguns fogem do pacote.

/** Marcador: onde o desenho pede a cor do texto, entra a cor recebida. */
export const COR = ${JSON.stringify(COR)};

export type Forma = { tag: string; props: Record<string, string> };

export const ICONES = {
${corpo}
} satisfies Record<string, { outline: Forma[]; bold: Forma[] }>;

export type NomeIcone = keyof typeof ICONES;
`;

writeFileSync(join(RAIZ, "components/ui/icons/dados.ts"), arquivo);

/**
 * Um export por ícone, escritos um a um em vez de montados num laço: é o que
 * deixa `import { ArrowLeft } from "@/components/ui/icons"` existir de verdade
 * pro TypeScript e pro bundler.
 */
const indice = `// GERADO por scripts/gerar-icones-solar.mjs — não editar à mão.
//
// Os ícones do app, no estilo Solar. Ver components/ui/icons/Icone.tsx pra API.

import { criarIcone } from "./Icone";

export type { IconeComponente, IconeProps, VarianteIcone } from "./Icone";
export type { NomeIcone } from "./dados";

${nomes.map((nome) => `export const ${nome} = criarIcone("${nome}");`).join("\n")}
`;

writeFileSync(join(RAIZ, "components/ui/icons/index.ts"), indice);
console.log(`${nomes.length} ícones gerados em components/ui/icons/`);
