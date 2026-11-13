/**
 * Utilidades puras del tablero de tareas (vista Calendario y fechas límite).
 * Probadas en boardUtils.test.ts.
 */

export type CalendarDay = { date: Date; currentMonth: boolean; isToday?: boolean };

/** Fecha local a partir de "YYYY-MM-DD" (o un timestamp con esa fecha al inicio). */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
	if (!dateStr) return null;
	const parts = dateStr.substring(0, 10).split('-');
	if (parts.length === 3) {
		return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
	}
	return new Date(dateStr);
}

/** "YYYY-MM-DD" → fecha corta según el navegador (ej. "12/11/2026"). */
export function formatLocalDate(dateStr: string | null | undefined): string {
	const d = parseLocalDate(dateStr);
	return d ? d.toLocaleDateString() : '';
}

/** Fecha local como "YYYY-MM-DD" (sin pasar por UTC). */
export function toLocalISO(d: Date): string {
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

/**
 * Días a mostrar en la grilla de un mes: semanas completas de lunes a domingo,
 * con los días de relleno del mes anterior/siguiente marcados como currentMonth=false.
 */
export function buildCalendarDays(monthDate: Date, today: Date = new Date()): CalendarDay[] {
	const year = monthDate.getFullYear();
	const month = monthDate.getMonth();
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);

	const days: CalendarDay[] = [];
	const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // lunes primero
	for (let i = 0; i < startPadding; i++) {
		days.push({ date: new Date(year, month, -startPadding + i + 1), currentMonth: false });
	}
	for (let i = 1; i <= lastDay.getDate(); i++) {
		const d = new Date(year, month, i);
		days.push({ date: d, currentMonth: true, isToday: today.toDateString() === d.toDateString() });
	}
	const remainder = days.length % 7;
	const endPadding = remainder === 0 ? 0 : 7 - remainder;
	for (let i = 1; i <= endPadding; i++) {
		days.push({ date: new Date(year, month + 1, i), currentMonth: false });
	}
	return days;
}

type CalendarTask = { date?: string | null; end_date?: string | null; parent_task_id?: number | null };

/**
 * Tareas que caen en un día del calendario del tablero (por fecha límite si la tienen,
 * si no por fecha de inicio). Las subtareas no aparecen: se ven dentro de su tarea.
 */
export function tasksOnDate<T extends CalendarTask>(tasks: T[], day: Date): T[] {
	const dateStr = toLocalISO(day);
	return tasks.filter((t) => {
		if (t.parent_task_id) return false;
		const target = (t.end_date ? t.end_date : t.date)?.substring(0, 10);
		return target === dateStr;
	});
}

export type DeadlineStyles = { badge: string; border: string; bg: string };

const AMBER: DeadlineStyles = {
	badge: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
	border: 'border-amber-500/50',
	bg: 'bg-amber-500'
};
const RED: DeadlineStyles = {
	badge: 'text-red-500 bg-red-500/10 border-red-500/20',
	border: 'border-red-500/50',
	bg: 'bg-red-500'
};
const YELLOW: DeadlineStyles = {
	badge: 'text-yellow-300 bg-yellow-400/10 border-yellow-400/20',
	border: 'border-yellow-400/50',
	bg: 'bg-yellow-400'
};

/** Color de una fecha límite: vencida en rojo, en ≤2 días en amarillo, el resto en ámbar. */
export function getDeadlineStyles(dateStr: string | null | undefined, now: Date = new Date()): DeadlineStyles {
	const target = parseLocalDate(dateStr);
	if (!target) return AMBER;
	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	target.setHours(0, 0, 0, 0);
	const diffDays = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
	if (diffDays < 0) return RED;
	if (diffDays <= 2) return YELLOW;
	return AMBER;
}

/** Título del mes: "Noviembre 2026" (sin el "de" que agrega toLocaleDateString). */
export function monthTitle(date: Date): string {
	const month = date.toLocaleDateString('es-ES', { month: 'long' });
	return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
}
