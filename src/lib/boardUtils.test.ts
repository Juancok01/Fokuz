import { describe, expect, it } from 'vitest';
import { buildCalendarDays, getDeadlineStyles, parseLocalDate, tasksOnDate, toLocalISO } from './boardUtils';

describe('buildCalendarDays (grilla del mes)', () => {
	// noviembre 2026: empieza domingo 1 y tiene 30 días
	const days = buildCalendarDays(new Date(2026, 10, 15), new Date(2026, 10, 12));

	it('arma semanas completas de lunes a domingo', () => {
		expect(days.length % 7).toBe(0);
		expect(days[0].date.getDay()).toBe(1); // lunes
		expect(days[days.length - 1].date.getDay()).toBe(0); // domingo
	});

	it('rellena con días de otros meses marcados como ajenos', () => {
		// 1 nov es domingo → 6 días de relleno de octubre (26–31)
		expect(days.slice(0, 6).every((d) => !d.currentMonth)).toBe(true);
		expect(days[0].date.getDate()).toBe(26);
		expect(days.filter((d) => d.currentMonth)).toHaveLength(30);
	});

	it('marca solo el día de hoy', () => {
		const today = days.filter((d) => d.isToday);
		expect(today).toHaveLength(1);
		expect(toLocalISO(today[0].date)).toBe('2026-11-12');
	});

	it('un mes que empieza lunes no tiene relleno inicial', () => {
		// junio 2026 empieza lunes
		const june = buildCalendarDays(new Date(2026, 5, 1));
		expect(june[0].currentMonth).toBe(true);
		expect(june[0].date.getDate()).toBe(1);
	});
});

describe('tasksOnDate (tareas de cada día del calendario)', () => {
	const tasks = [
		{ id: 1, date: '2026-11-12' },
		{ id: 2, date: '2026-11-10', end_date: '2026-11-12' }, // fecha límite el 12
		{ id: 3, date: '2026-11-12T09:00' },
		{ id: 4, date: '2026-11-12', parent_task_id: 1 }, // subtarea: no se muestra
		{ id: 5, date: '2026-11-13' }
	];

	it('incluye tareas por fecha de inicio o por fecha límite, sin subtareas', () => {
		expect(tasksOnDate(tasks, new Date(2026, 10, 12)).map((t) => t.id)).toEqual([1, 2, 3]);
	});

	it('una tarea con fecha límite aparece el día límite, no el de inicio', () => {
		expect(tasksOnDate(tasks, new Date(2026, 10, 10)).map((t) => t.id)).toEqual([]);
	});
});

describe('getDeadlineStyles (color de la fecha límite)', () => {
	const now = new Date(2026, 10, 12, 15, 0);

	it('vencida → rojo', () => {
		expect(getDeadlineStyles('2026-11-11', now).bg).toBe('bg-red-500');
	});

	it('hoy o en ≤2 días → amarillo', () => {
		expect(getDeadlineStyles('2026-11-12', now).bg).toBe('bg-yellow-400');
		expect(getDeadlineStyles('2026-11-14', now).bg).toBe('bg-yellow-400');
	});

	it('más adelante o sin fecha → ámbar', () => {
		expect(getDeadlineStyles('2026-11-20', now).bg).toBe('bg-amber-500');
		expect(getDeadlineStyles(null, now).bg).toBe('bg-amber-500');
	});
});

describe('parseLocalDate', () => {
	it('lee "YYYY-MM-DD" como fecha local (no se corre de día por UTC)', () => {
		const d = parseLocalDate('2026-11-12T23:00')!;
		expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 12]);
		expect(parseLocalDate(null)).toBeNull();
	});
});

describe('monthTitle', () => {
	it('"Noviembre 2026", sin "De" en mayúscula', async () => {
		const { monthTitle } = await import('./boardUtils');
		expect(monthTitle(new Date(2026, 10, 1))).toBe('Noviembre 2026');
		expect(monthTitle(new Date(2027, 0, 15))).toBe('Enero 2027');
	});
});
