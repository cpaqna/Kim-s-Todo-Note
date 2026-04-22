export function formatDate(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

export function formatShortDate(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
}

export function formatDateTime(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
}

export function formatDateFull(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}년 ${month}월 ${day}일`;
}

export function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

export function isOverdue(dueDate: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate + 'T00:00:00');
    return due < today;
}

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
