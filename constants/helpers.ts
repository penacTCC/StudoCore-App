import { avatarColors } from "./colors";

export function getAvatarColor(index: number): string {
    return avatarColors[index % avatarColors.length];
}

export function getSubjectColor(subject: string) {
    switch (subject) {
        case "Mathematics":
        case "Matemática": return { bg: "rgba(99, 102, 241, 0.2)", text: "#818cf8", border: "rgba(99, 102, 241, 0.3)" };
        case "Physics":
        case "Física": return { bg: "rgba(16, 185, 129, 0.2)", text: "#34d399", border: "rgba(16, 185, 129, 0.3)" };
        case "Chemistry":
        case "Química": return { bg: "rgba(245, 158, 11, 0.2)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.3)" };
        case "Biology":
        case "Biologia": return { bg: "rgba(244, 63, 94, 0.2)", text: "#fb7185", border: "rgba(244, 63, 94, 0.3)" };
        case "History":
        case "História": return { bg: "rgba(249, 115, 22, 0.2)", text: "#fb923c", border: "rgba(249, 115, 22, 0.3)" };
        case "Literature": return { bg: "rgba(139, 92, 246, 0.2)", text: "#a78bfa", border: "rgba(139, 92, 246, 0.3)" };
        default: return { bg: "rgba(100, 116, 139, 0.2)", text: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" };
    }
}

export function formatDuration(hours: number, minutes: number) {
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

// Calcula "Xh atrás" / "Xm atrás" / "Xd atrás" a partir de um timestamp ISO.
export function getTimeAgo(createdAt: string): string {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Agora";
    if (mins < 60) return `${mins}m atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
}
