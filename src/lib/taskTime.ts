export const DEFAULT_DURATION_MIN = 60;

export function localDayString(d = new Date()): string {
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addLocalDays(day: string, days: number): string {
	const [year, month, date] = day.split('-').map(Number);
	return localDayString(new Date(year, month - 1, date + days));
}

export function extractTime(value?: string | null): string | null {
	if (!value) return null;
	const match = String(value).match(/(\d{2}:\d{2})/);
	return match?.[1] ?? null;
}

export function splitDateTime(value?: string | null): { date: string | null; time: string | null } {
	if (!value) return { date: null, time: null };
	const date = String(value).substring(0, 10);
	const iso = String(value).match(/T(\d{2}:\d{2})/);
	const space = String(value).match(/[ T](\d{2}:\d{2})/);
	return {
		date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
		time: iso?.[1] || space?.[1] || extractTime(value)
	};
}

export function composeDateTime(date?: string | null, time?: string | null): string {
	const day = splitDateTime(date).date || localDayString();
	return `${day}T${extractTime(time) || '09:00'}`;
}

export type TimedTask = {
	id?: number;
	title?: string;
	date?: string | null;
	end_date?: string | null;
	start_time?: string | null;
	end_time?: string | null;
	is_completed?: boolean;
};

export function taskTimeLabel(task: TimedTask): string | null {
	return extractTime(task.start_time) || splitDateTime(task.date).time || splitDateTime(task.end_date).time;
}

export function taskDayValue(task: TimedTask): string {
	return (task.date || task.end_date || '').substring(0, 10);
}

export function timeToMinutes(value?: string | null): number | null {
	const time = extractTime(value);
	if (!time) return null;
	const [hours, minutes] = time.split(':').map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
	return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
	const day = 24 * 60;
	const normalized = ((total % day) + day) % day;
	const hours = Math.floor(normalized / 60);
	const minutes = normalized % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
	return minutesToTime((timeToMinutes(time) ?? 0) + minutes);
}

export function defaultEndTime(start: string, end?: string | null): string {
	const startMinutes = timeToMinutes(start) ?? 9 * 60;
	const endMinutes = timeToMinutes(end);
	if (endMinutes != null && endMinutes > startMinutes) return extractTime(end) as string;
	return minutesToTime(Math.min(startMinutes + DEFAULT_DURATION_MIN, 24 * 60 - 1));
}

export function taskEndTime(task: TimedTask): string | null {
	const start = taskTimeLabel(task);
	if (!start) return null;
	return defaultEndTime(start, task.end_time);
}

export function taskRangeLabel(task: TimedTask): string | null {
	const start = taskTimeLabel(task);
	if (!start) return null;
	const end = taskEndTime(task);
	return end ? `${start} – ${end}` : start;
}

export function durationLabel(start?: string | null, end?: string | null): string {
	const bounds = slotBounds(start, end);
	if (!bounds) return '';
	const mins = bounds[1] - bounds[0];
	if (mins < 60) return `${mins} min`;
	const hours = Math.floor(mins / 60);
	const rest = mins % 60;
	if (rest === 0) return hours === 1 ? '1 h' : `${hours} h`;
	return `${hours} h ${rest} min`;
}

export function taskDurationLabel(task: TimedTask): string {
	const start = taskTimeLabel(task);
	if (!start) return '';
	return durationLabel(start, taskEndTime(task));
}

function slotBounds(start?: string | null, end?: string | null): [number, number] | null {
	const startMinutes = timeToMinutes(start);
	if (startMinutes == null) return null;
	let endMinutes = timeToMinutes(end);
	if (endMinutes == null || endMinutes <= startMinutes) {
		endMinutes = Math.min(startMinutes + DEFAULT_DURATION_MIN, 24 * 60);
	}
	return [startMinutes, endMinutes];
}

export function findOverlappingTasks(
	tasks: TimedTask[],
	day: string,
	start: string,
	end: string,
	ignoreId?: number | null
): TimedTask[] {
	const incoming = slotBounds(start, end);
	if (!incoming) return [];
	const [a0, a1] = incoming;

	return tasks.filter((task) => {
		if (ignoreId != null && task.id === ignoreId) return false;
		if (taskDayValue(task) !== day) return false;
		const otherStart = taskTimeLabel(task);
		if (!otherStart) return false;
		const other = slotBounds(otherStart, taskEndTime(task));
		if (!other) return false;
		const [b0, b1] = other;
		return a0 < b1 && b0 < a1;
	});
}

export function overlapMessage(conflicts: TimedTask[]): string {
	if (!conflicts.length) return '';
	const names = conflicts
		.map((task) => `«${task.title || 'Tarea'}» (${taskRangeLabel(task)})`)
		.join(', ');
	if (conflicts.length === 1) return `Este horario se cruza con ${names}.`;
	return `Este horario se cruza con ${conflicts.length} tareas: ${names}.`;
}

export function nextFreeSlot(
	tasks: TimedTask[],
	day: string,
	preferredStart: string,
	duration = DEFAULT_DURATION_MIN
): { start: string; end: string } {
	let start = extractTime(preferredStart) || '09:00';
	for (let i = 0; i < 48; i++) {
		const end = addMinutesToTime(start, duration);
		const endMinutes = timeToMinutes(end) ?? 0;
		const startMinutes = timeToMinutes(start) ?? 0;
		if (endMinutes > startMinutes && findOverlappingTasks(tasks, day, start, end).length === 0) {
			return { start, end };
		}
		start = addMinutesToTime(start, 30);
	}
	return { start: preferredStart, end: addMinutesToTime(preferredStart, duration) };
}

export const START_TIME_SQL_HINT =
	'Para guardar el horario hay que agregar start_time y end_time. Ejecuta supabase/migrations/022_task_start_time.sql y 023_task_end_time.sql en el SQL Editor de Supabase.';
