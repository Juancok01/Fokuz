/** Utilidades compartidas de hábitos (Inicio + módulo Hábitos). */

export const COLOMBIA_TZ = 'America/Bogota';

export type Habit = {
	id: number;
	name: string;
	weekdays: number[];
};

export type HabitHealth = 'green' | 'yellow' | 'red' | 'neutral';

/** Etiquetas cortas: Dom … Sáb (índice = Date.getDay()). */
export const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

export const WEEKDAY_NAMES = [
	'Domingo',
	'Lunes',
	'Martes',
	'Miércoles',
	'Jueves',
	'Viernes',
	'Sábado'
] as const;

export const formatDateInTz = (date: Date = new Date(), timeZone = COLOMBIA_TZ) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(date);

/** 0 = domingo … 6 = sábado, en zona Colombia. */
export const getWeekdayInTz = (date: Date = new Date(), timeZone = COLOMBIA_TZ) => {
	const weekday = new Intl.DateTimeFormat('en-US', {
		timeZone,
		weekday: 'short'
	}).format(date);
	const map: Record<string, number> = {
		Sun: 0,
		Mon: 1,
		Tue: 2,
		Wed: 3,
		Thu: 4,
		Fri: 5,
		Sat: 6
	};
	return map[weekday] ?? date.getDay();
};

export const normalizeWeekdays = (raw: unknown): number[] => {
	if (!Array.isArray(raw)) return [];
	return [...new Set(raw.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6))].sort(
		(a, b) => a - b
	);
};

export const habitIsScheduledOn = (habit: Pick<Habit, 'weekdays'>, weekday: number) =>
	habit.weekdays.includes(weekday);

export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export const formatDayKey = (year: number, month: number, day: number) => {
	const m = String(month + 1).padStart(2, '0');
	const d = String(day).padStart(2, '0');
	return `${year}-${m}-${d}`;
};

export const weekdayForMonthDay = (year: number, month: number, day: number) =>
	new Date(year, month, day).getDay();

/** Abreviatura corta para la matriz; el nombre completo se muestra al tocar. */
export const abbreviateHabitName = (name: string, max = 9) => {
	const t = name.trim().replace(/\s+/g, ' ');
	if (!t) return '';
	if (t.length <= max) return t;

	const first = t.split(' ')[0] ?? t;
	if (first.length >= 3 && first.length <= max - 1) return `${first}…`;
	return `${t.slice(0, max - 1)}…`;
};

/**
 * Salud del hábito según % de cumplimiento del mes:
 * ≥70 verde · 30–69 amarillo · &lt;30 rojo · sin días programados = neutro
 */
export const habitHealthFromPct = (pct: number, total: number): HabitHealth => {
	if (total <= 0) return 'neutral';
	if (pct >= 70) return 'green';
	if (pct >= 30) return 'yellow';
	return 'red';
};

export const habitHealthLabel = (health: HabitHealth) => {
	switch (health) {
		case 'green':
			return 'En buen camino';
		case 'yellow':
			return 'Regular';
		case 'red':
			return 'Bajo';
		default:
			return 'Sin datos';
	}
};
