export const mockUsers = [
    { id: 1, name: "Alex Chen", initials: "AC", hours: 42, streak: 15, rank: 1 },
    { id: 2, name: "Maria Santos", initials: "MS", hours: 38, streak: 12, rank: 2 },
    { id: 3, name: "James Wilson", initials: "JW", hours: 35, streak: 8, rank: 3 },
    { id: 4, name: "Sophie Lee", initials: "SL", hours: 32, streak: 6, rank: 4 },
    { id: 5, name: "You", initials: "YO", hours: 28, streak: 10, rank: 5 },
];

export const mockLiveFeed = [
    { id: 1, user: "Alex Chen", action: "started a Math session", isPublic: true, time: "2m ago" },
    { id: 2, user: "Maria Santos", action: "completed Physics review", isPublic: false, time: "5m ago" },
    { id: 3, user: "James Wilson", action: "started a Chemistry session", isPublic: true, time: "8m ago" },
];

export const subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "History", "Literature"];

export const mockFiles = [
    { id: 1, name: "Calculus Notes.pdf", type: "pdf", author: "Alex Chen", date: "Jan 10", size: "2.4 MB" },
    { id: 2, name: "Physics Diagrams.png", type: "image", author: "Maria Santos", date: "Jan 8", size: "1.8 MB" },
    { id: 3, name: "Chemistry Lab Report.pdf", type: "pdf", author: "James Wilson", date: "Jan 5", size: "3.1 MB" },
    { id: 4, name: "Biology Slides.pdf", type: "pdf", author: "Sophie Lee", date: "Jan 3", size: "5.2 MB" },
];

export const mockBadges = [
    { id: 1, name: "Early Bird", icon: "Star" as const, unlocked: true },
    { id: 2, name: "Night Owl", icon: "Clock" as const, unlocked: true },
    { id: 3, name: "Bookworm", icon: "BookOpen" as const, unlocked: true },
    { id: 4, name: "Streak Master", icon: "Flame" as const, unlocked: false },
    { id: 5, name: "Champion", icon: "Trophy" as const, unlocked: false },
    { id: 6, name: "Team Player", icon: "Users" as const, unlocked: false },
];

export const mockFailedQuestions: { id: number; subject: string; question: string; date: string }[] = [];

export const mockStudySchedule = [
    { id: 1, day: 0, time: "09:00", subject: "Mathematics", duration: 90 },
    { id: 2, day: 0, time: "14:00", subject: "Physics", duration: 60 },
    { id: 3, day: 1, time: "10:00", subject: "Chemistry", duration: 75 },
    { id: 4, day: 2, time: "09:00", subject: "Biology", duration: 60 },
    { id: 5, day: 3, time: "11:00", subject: "History", duration: 45 },
];

export const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const mockPendingInvites = [
    { id: 1, email: "john@email.com", status: "pending" },
    { id: 2, email: "sarah@email.com", status: "pending" },
];

export const mockPublicGroups = [
    {
        id: 1,
        name: "Math Masters",
        initials: "MM",
        members: 128,
        weeklyTarget: 15,
        description: "Advanced mathematics study group for college students",
        isOnline: true,
        activeNow: 23,
    },
    {
        id: 2,
        name: "Science Squad",
        initials: "SS",
        members: 95,
        weeklyTarget: 12,
        description: "Physics, Chemistry & Biology combined study sessions",
        isOnline: true,
        activeNow: 15,
    },
    {
        id: 3,
        name: "History Buffs",
        initials: "HB",
        members: 67,
        weeklyTarget: 8,
        description: "World history and politics discussion group",
        isOnline: false,
        activeNow: 0,
    },
    {
        id: 4,
        name: "Code Academy",
        initials: "CA",
        members: 203,
        weeklyTarget: 20,
        description: "Programming and computer science enthusiasts",
        isOnline: true,
        activeNow: 34,
    },
    {
        id: 5,
        name: "Language Learners",
        initials: "LL",
        members: 312,
        weeklyTarget: 10,
        description: "Practice languages together with native speakers",
        isOnline: true,
        activeNow: 45,
    },
];

export const mockDetailingFeed = [
    {
        id: 1,
        user: "Alex Chen",
        initials: "AC",
        subject: "Mathematics",
        content: "Chapter 7: Integration by Parts",
        durationHours: 2,
        durationMinutes: 15,
        timestamp: "Today at 2:30 PM",
        timeAgo: "1h ago",
        isPublic: true,
        verified: true,
        streak: 15,
        reactions: 5,
    },
    {
        id: 2,
        user: "Maria Santos",
        initials: "MS",
        subject: "Physics",
        content: "Quantum Mechanics - Wave Functions",
        durationHours: 1,
        durationMinutes: 45,
        timestamp: "Today at 1:00 PM",
        timeAgo: "2h ago",
        isPublic: true,
        verified: true,
        streak: 12,
        reactions: 8,
    },
    {
        id: 3,
        user: "James Wilson",
        initials: "JW",
        subject: "Chemistry",
        content: "Organic Chemistry - Alkenes",
        durationHours: 1,
        durationMinutes: 0,
        timestamp: "Today at 11:30 AM",
        timeAgo: "4h ago",
        isPublic: false,
        verified: false,
        streak: 8,
        reactions: 2,
    },
    {
        id: 4,
        user: "Sophie Lee",
        initials: "SL",
        subject: "Biology",
        content: "Cell Division & Mitosis",
        durationHours: 1,
        durationMinutes: 30,
        timestamp: "Today at 9:00 AM",
        timeAgo: "6h ago",
        isPublic: true,
        verified: false,
        streak: 6,
        reactions: 3,
    },
    {
        id: 5,
        user: "You",
        initials: "YO",
        subject: "Mathematics",
        content: "Linear Algebra - Eigenvalues",
        durationHours: 2,
        durationMinutes: 0,
        timestamp: "Yesterday at 8:15 PM",
        timeAgo: "11h ago",
        isPublic: true,
        verified: true,
        streak: 10,
        reactions: 6,
    },
];
