import { describe, expect, it } from 'vitest';
import {
	defaultEndTime,
	findOverlappingTasks,
	formatTime12,
	groupTasksByPeriod,
	hasDeadline,
	nextFreeSlot,
	splitDateTime,
	splitEndFields,
	taskDayValue,
	type TimedTask
} from './taskTime';

const DAY = '2026-11-12';
const task = (over: Partial<TimedTask>): TimedTask => ({ id: 1, title: 'T', date: DAY, ...over });

describe('splitEndFields (fecha límite vs. hora de fin)', () => {
	it('un fin el mismo día es solo hora de fin, no fecha límite', () => {
		expect(splitEndFields(DAY, '09:00', `${DAY}T10:00`)).toEqual({ endDate: null, endTime: '10:00' });
	});

	it('un fin en otro día sí es fecha límite', () => {
		expect(splitEndFields(DAY, '09:00', '2026-11-15T18:00')).toEqual({ endDate: '2026-11-15', endTime: '18:00' });
	});

	it('sin fin, dura 1 hora por defecto', () => {
		expect(splitEndFields(DAY, '09:00', '')).toEqual({ endDate: null, endTime: '10:00' });
	});
});

describe('hasDeadline', () => {
	it('no hay fecha límite si end_date es el mismo día de inicio (datos antiguos)', () => {
		expect(hasDeadline(task({ end_date: `${DAY}T10:00` }))).toBe(false);
	});

	it('hay fecha límite si end_date es otro día', () => {
		expect(hasDeadline(task({ end_date: '2026-11-15' }))).toBe(true);
	});

	it('sin end_date no hay fecha límite', () => {
		expect(hasDeadline(task({ end_date: null }))).toBe(false);
	});
});

describe('findOverlappingTasks (choques de horario)', () => {
	const busy = task({ id: 10, start_time: '09:00', end_time: '10:00' });

	it('detecta un cruce de horario', () => {
		expect(findOverlappingTasks([busy], DAY, '09:30', '10:30').map((t) => t.id)).toEqual([10]);
	});

	it('horarios contiguos no se cruzan (10:00 justo cuando termina la otra)', () => {
		expect(findOverlappingTasks([busy], DAY, '10:00', '11:00')).toEqual([]);
	});

	it('una tarea completada ya no ocupa su horario', () => {
		expect(findOverlappingTasks([{ ...busy, is_completed: true }], DAY, '09:00', '10:00')).toEqual([]);
	});

	it('ignora la propia tarea al editarla', () => {
		expect(findOverlappingTasks([busy], DAY, '09:00', '10:00', 10)).toEqual([]);
	});

	it('las tareas de otro día o sin hora no cuentan', () => {
		const otherDay = task({ id: 11, date: '2026-11-13', start_time: '09:00' });
		const noTime = task({ id: 12, start_time: null });
		expect(findOverlappingTasks([otherDay, noTime], DAY, '09:00', '10:00')).toEqual([]);
	});

	it('nextFreeSlot propone el siguiente hueco libre', () => {
		expect(nextFreeSlot([busy], DAY, '09:00')).toEqual({ start: '10:00', end: '11:00' });
	});
});

describe('horas y días', () => {
	it('defaultEndTime usa la hora de fin si es posterior; si no, suma 1 hora', () => {
		expect(defaultEndTime('09:00', '11:30')).toBe('11:30');
		expect(defaultEndTime('09:00', '08:00')).toBe('10:00');
		expect(defaultEndTime('23:30')).toBe('23:59'); // no pasa a otro día
	});

	it('taskDayValue usa date, o end_date si no hay date', () => {
		expect(taskDayValue(task({ date: `${DAY}T09:00` }))).toBe(DAY);
		expect(taskDayValue(task({ date: null, end_date: '2026-11-20' }))).toBe('2026-11-20');
	});

	it('splitDateTime separa fecha y hora', () => {
		expect(splitDateTime('2026-11-12T16:30')).toEqual({ date: DAY, time: '16:30' });
		expect(splitDateTime(null)).toEqual({ date: null, time: null });
	});

	it('formatTime12 muestra a. m. / p. m.', () => {
		expect(formatTime12('09:05')).toBe('9:05 a. m.');
		expect(formatTime12('16:30')).toBe('4:30 p. m.');
		expect(formatTime12('00:15')).toBe('12:15 a. m.');
	});

	it('groupTasksByPeriod agrupa por franja y deja las tareas sin hora al final', () => {
		const groups = groupTasksByPeriod([
			task({ id: 1, start_time: '16:30' }),
			task({ id: 2, start_time: '09:00' }),
			task({ id: 3, start_time: null })
		]);
		expect(groups.map((g) => [g.key, g.tasks.map((t) => t.id)])).toEqual([
			['manana', [2]],
			['tarde', [1]],
			['sin-hora', [3]]
		]);
	});
});
