/** Utilidades compartidas de hábitos (Inicio + módulo Hábitos). */

export const COLOMBIA_TZ = 'America/Bogota';

export type HabitIconId =
	| 'sparkles'
	| 'droplets'
	| 'book'
	| 'dumbbell'
	| 'brain'
	| 'moon'
	| 'sun'
	| 'heart'
	| 'leaf'
	| 'music'
	| 'coffee'
	| 'footprints'
	| 'pen'
	| 'smartphone'
	| 'utensils';

export type Habit = {
	id: number;
	name: string;
	weekdays: number[];
	icon: HabitIconId;
	tag?: string;
};

export type HabitHealth = 'green' | 'yellow' | 'red' | 'neutral';

export const HABIT_ICON_OPTIONS: { id: HabitIconId; label: string }[] = [
	{ id: 'sparkles', label: 'General' },
	{ id: 'droplets', label: 'Agua' },
	{ id: 'book', label: 'Lectura' },
	{ id: 'dumbbell', label: 'Ejercicio' },
	{ id: 'brain', label: 'Mente' },
	{ id: 'moon', label: 'Sueño' },
	{ id: 'sun', label: 'Mañana' },
	{ id: 'heart', label: 'Salud' },
	{ id: 'leaf', label: 'Naturaleza' },
	{ id: 'music', label: 'Música' },
	{ id: 'coffee', label: 'Café' },
	{ id: 'footprints', label: 'Caminar' },
	{ id: 'pen', label: 'Escribir' },
	{ id: 'smartphone', label: 'Digital' },
	{ id: 'utensils', label: 'Comida' }
];

const ICON_IDS = new Set<string>(HABIT_ICON_OPTIONS.map((o) => o.id));

export const normalizeHabitIcon = (raw: unknown): HabitIconId => {
	if (typeof raw === 'string' && ICON_IDS.has(raw)) return raw as HabitIconId;
	return 'sparkles';
};

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

/** Suma días a una fecha "YYYY-MM-DD" (aritmética de calendario, sin zona horaria). */
export const addDaysToDateStr = (day: string, days: number) => {
	const [y, m, d] = day.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return dt.toISOString().slice(0, 10);
};

/** 0 = domingo … 6 = sábado para una fecha "YYYY-MM-DD". */
export const weekdayOfDateStr = (day: string) => {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** Número de semana ISO-8601 (lunes a domingo) para una fecha "YYYY-MM-DD". */
export const isoWeekNumber = (day: string = formatDateInTz()) => {
	const [y, m, d] = day.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	const isoDay = dt.getUTCDay() || 7;
	dt.setUTCDate(dt.getUTCDate() + 4 - isoDay); // jueves de esa semana
	const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
	return Math.ceil(((dt.getTime() - yearStart) / 86400000 + 1) / 7);
};

/** Cuántos días hacia atrás se miran para calcular rachas. */
export const STREAK_LOOKBACK_DAYS = 366;

/**
 * Racha actual: días programados consecutivos cumplidos, contando hacia atrás desde hoy.
 * Si hoy está programado y aún no se ha marcado, no rompe la racha (el día sigue abierto).
 */
export const computeHabitStreak = (
	weekdays: number[],
	doneDates: Set<string>,
	today: string = formatDateInTz(),
	lookbackDays = STREAK_LOOKBACK_DAYS
) => {
	if (weekdays.length === 0) return 0;
	let streak = 0;
	for (let i = 0; i < lookbackDays; i++) {
		const day = addDaysToDateStr(today, -i);
		if (!weekdays.includes(weekdayOfDateStr(day))) continue;
		if (doneDates.has(day)) {
			streak++;
		} else if (i !== 0) {
			break;
		}
	}
	return streak;
};

/** Texto corto de frecuencia: "Todos los días", "Lunes a viernes", "L · X · V"… */
export const weekdaysLabel = (weekdays: number[]) => {
	const set = [...new Set(weekdays)].sort((a, b) => a - b);
	if (set.length === 7) return 'Todos los días';
	if (set.join() === '1,2,3,4,5') return 'Lunes a viernes';
	if (set.join() === '0,6') return 'Fines de semana';
	if (set.length === 1) return `Solo ${WEEKDAY_NAMES[set[0]].toLowerCase()}`;
	// Lunes primero, domingo al final
	return [...set.filter((d) => d !== 0), ...set.filter((d) => d === 0)]
		.map((d) => WEEKDAY_LABELS[d])
		.join(' · ');
};

export const normalizeWeekdays =(raw: unknown): number[] => {
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
