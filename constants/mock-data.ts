export const mockUsers = [
    { id: 1, name: "Alex Chen", initials: "AC", hours: 42, ofensiva: 15, rank: 1 },
    { id: 2, name: "Maria Santos", initials: "MS", hours: 38, ofensiva: 12, rank: 2 },
    { id: 3, name: "James Wilson", initials: "JW", hours: 35, ofensiva: 8, rank: 3 },
    { id: 4, name: "Sophie Lee", initials: "SL", hours: 32, ofensiva: 6, rank: 4 },
    { id: 5, name: "Você", initials: "VC", hours: 28, ofensiva: 10, rank: 5 },
];

export const mockLiveFeed = [
    { id: 1, user: "Alex Chen", action: "iniciou uma sessão de Matemática", isPublic: true, time: "há 2m" },
    { id: 2, user: "Maria Santos", action: "concluiu uma revisão de Física", isPublic: false, time: "há 5m" },
    { id: 3, user: "James Wilson", action: "iniciou uma sessão de Química", isPublic: true, time: "há 8m" },
];

export const subjects = ["Matemática", "Física", "Química", "Biologia", "História", "Literatura"];

export const mockFiles = [
    { id: 1, name: "Anotações de Cálculo.pdf", type: "pdf", author: "Alex Chen", date: "10 jan", size: "2.4 MB" },
    { id: 2, name: "Diagramas de Física.png", type: "image", author: "Maria Santos", date: "8 jan", size: "1.8 MB" },
    { id: 3, name: "Relatório de Laboratório de Química.pdf", type: "pdf", author: "James Wilson", date: "5 jan", size: "3.1 MB" },
    { id: 4, name: "Slides de Biologia.pdf", type: "pdf", author: "Sophie Lee", date: "3 jan", size: "5.2 MB" },
];

export const mockBadges = [
    { id: 1, name: "Madrugador", icon: "Star" as const, unlocked: true },
    { id: 2, name: "Coruja da Noite", icon: "Clock" as const, unlocked: true },
    { id: 3, name: "Leitor Voraz", icon: "BookOpen" as const, unlocked: true },
    { id: 4, name: "Mestre da Ofensiva", icon: "Flame" as const, unlocked: false },
    { id: 5, name: "Campeão", icon: "Trophy" as const, unlocked: false },
    { id: 6, name: "Jogador de Equipe", icon: "Users" as const, unlocked: false },
];

export const mockFailedQuestions: { id: number; subject: string; question: string; date: string }[] = [
    {
        id: 1,
        subject: "Matemática",
        question: "Qual é a derivada de f(x) = x³ − 2x + 5?",
        date: "22/03/2026",
    },
];

export const diasDaSemana = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export const disciplinasComCores: { name: string; color: string }[] = [
    { name: "Matemática", color: "#7c3aed" },
    { name: "Física", color: "#e11d48" },
    { name: "Química", color: "#059669" },
    { name: "Biologia", color: "#0891b2" },
    { name: "História", color: "#d97706" },
    { name: "Geografia", color: "#65a30d" },
    { name: "Português", color: "#db2777" },
    { name: "Inglês", color: "#2563eb" },
    { name: "Literatura", color: "#9333ea" },
    { name: "Filosofia", color: "#64748b" },
];

export const mockPendingInvites = [
    { id: 1, email: "john@email.com", status: "pendente" },
    { id: 2, email: "sarah@email.com", status: "pendente" },
];

export const mockPublicGroups = [
    {
        id: 1,
        name: "Mestres da Matemática",
        initials: "MM",
        members: 128,
        weeklyTarget: 15,
        description: "Grupo de estudos de matemática avançada para universitários",
        isOnline: true,
        activeNow: 23,
    },
    {
        id: 2,
        name: "Equipe de Ciências",
        initials: "SS",
        members: 95,
        weeklyTarget: 12,
        description: "Sessões de estudo combinando Física, Química e Biologia",
        isOnline: true,
        activeNow: 15,
    },
    {
        id: 3,
        name: "Fãs de História",
        initials: "HB",
        members: 67,
        weeklyTarget: 8,
        description: "Grupo de discussão sobre história mundial e política",
        isOnline: false,
        activeNow: 0,
    },
    {
        id: 4,
        name: "Academia de Código",
        initials: "CA",
        members: 203,
        weeklyTarget: 20,
        description: "Entusiastas de programação e ciência da computação",
        isOnline: true,
        activeNow: 34,
    },
    {
        id: 5,
        name: "Aprendizes de Idiomas",
        initials: "LL",
        members: 312,
        weeklyTarget: 10,
        description: "Pratique idiomas com falantes nativos",
        isOnline: true,
        activeNow: 45,
    },
];

export const mockDetailingFeed = [
    {
        id: 1,
        user: "Alex Chen",
        initials: "AC",
        subject: "Matemática",
        content: "Capítulo 7: Integração por partes",
        durationHours: 2,
        durationMinutes: 15,
        timestamp: "Hoje às 14:30",
        timeAgo: "há 1h",
        isPublic: true,
        verified: true,
        ofensiva: 15,
        reactions: 5,
    },
    {
        id: 2,
        user: "Maria Santos",
        initials: "MS",
        subject: "Física",
        content: "Mecânica Quântica - Funções de onda",
        durationHours: 1,
        durationMinutes: 45,
        timestamp: "Hoje às 13:00",
        timeAgo: "há 2h",
        isPublic: true,
        verified: true,
        ofensiva: 12,
        reactions: 8,
    },
    {
        id: 3,
        user: "James Wilson",
        initials: "JW",
        subject: "Química",
        content: "Química Orgânica - Alcenos",
        durationHours: 1,
        durationMinutes: 0,
        timestamp: "Hoje às 11:30",
        timeAgo: "há 4h",
        isPublic: false,
        verified: false,
        ofensiva: 8,
        reactions: 2,
    },
    {
        id: 4,
        user: "Sophie Lee",
        initials: "SL",
        subject: "Biologia",
        content: "Divisão celular e mitose",
        durationHours: 1,
        durationMinutes: 30,
        timestamp: "Hoje às 09:00",
        timeAgo: "há 6h",
        isPublic: true,
        verified: false,
        ofensiva: 6,
        reactions: 3,
    },
    {
        id: 5,
        user: "Você",
        initials: "VC",
        subject: "Matemática",
        content: "Álgebra Linear - Autovalores",
        durationHours: 2,
        durationMinutes: 0,
        timestamp: "Ontem às 20:15",
        timeAgo: "há 11h",
        isPublic: true,
        verified: true,
        ofensiva: 10,
        reactions: 6,
    },
];
