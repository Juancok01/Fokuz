import { describe, expect, it } from 'vitest';
import {
	addDaysToDateStr,
	computeHabitStreak,
	formatDateInTz,
	getWeekdayInTz,
	habitHealthFromPct,
	isoWeekNumber,
	normalizeWeekdays,
	weekdayOfDateStr,
	weekdaysLabel
} from './habits';

const MON_FRI = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
// 2026-11-12 es jueves
const TODAY = '2026-11-12';

describe('computeHabitStreak (racha actual)', () => {
	it('un hábito sin registros tiene racha 0', () => {
		expect(computeHabitStreak(MON_FRI, new Set(), TODAY)).toBe(0);
	});

	it('cumplido solo hoy = 1', () => {
		expect(computeHabitStreak(MON_FRI, new Set([TODAY]), TODAY)).toBe(1);
	});

	it('hoy pendiente no rompe la racha (el día sigue abierto)', () => {
		const done = new Set(['2026-11-11', '2026-11-10', '2026-11-09']);
		expect(computeHabitStreak(MON_FRI, done, TODAY)).toBe(3);
	});

	it('los días no programados (fin de semana) no rompen la racha', () => {
		// jue 12, mié 11, mar 10, lun 9, (sáb 7 y dom 8 no tocan), vie 6
		const done = new Set(['2026-11-12', '2026-11-11', '2026-11-10', '2026-11-09', '2026-11-06']);
		expect(computeHabitStreak(MON_FRI, done, TODAY)).toBe(5);
	});

	it('un día programado sin cumplir rompe la racha', () => {
		// cumplió hoy y anteayer, pero falló ayer (mié 11)
		const done = new Set(['2026-11-12', '2026-11-10']);
		expect(computeHabitStreak(MON_FRI, done, TODAY)).toBe(1);
	});

	it('la racha cruza meses (no se reinicia el día 1)', () => {
		const done = new Set<string>();
		for (let i = 0; i < 20; i++) done.add(addDaysToDateStr('2026-11-05', -i)); // 17 oct – 5 nov
		expect(computeHabitStreak(EVERY_DAY, done, '2026-11-05')).toBe(20);
	});

	it('un hábito sin días programados tiene racha 0', () => {
		expect(computeHabitStreak([], new Set([TODAY]), TODAY)).toBe(0);
	});

	it('respeta el límite de días hacia atrás', () => {
		const done = new Set<string>();
		for (let i = 0; i < 10; i++) done.add(addDaysToDateStr(TODAY, -i));
		expect(computeHabitStreak(EVERY_DAY, done, TODAY, 5)).toBe(5);
	});
});

describe('isoWeekNumber (número de semana)', () => {
	it.each([
		['2026-11-12', 46],
		['2026-01-01', 1],
		['2027-01-01', 53], // pertenece a la última semana de 2026
		['2020-12-31', 53],
		['2021-01-03', 53],
		['2021-01-04', 1],
		['2024-12-30', 1] // lunes que ya es semana 1 de 2025
	])('%s es la semana %i', (day, week) => {
		expect(isoWeekNumber(day)).toBe(week);
	});
});

describe('fechas como texto YYYY-MM-DD', () => {
	it('suma y resta días cruzando meses y años', () => {
		expect(addDaysToDateStr('2026-03-01', -1)).toBe('2026-02-28');
		expect(addDaysToDateStr('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDaysToDateStr('2028-02-28', 1)).toBe('2028-02-29'); // bisiesto
	});

	it('calcula el día de la semana sin depender de la zona horaria', () => {
		expect(weekdayOfDateStr('2026-11-12')).toBe(4); // jueves
		expect(weekdayOfDateStr('2026-11-15')).toBe(0); // domingo
	});
});

describe('zona horaria de Colombia', () => {
	it('a las 10 p. m. en Bogotá todavía es el mismo día (aunque en UTC ya sea el siguiente)', () => {
		const lateNight = new Date('2026-11-13T03:00:00Z'); // 12 nov, 10:00 p. m. en Bogotá
		expect(formatDateInTz(lateNight)).toBe('2026-11-12');
		expect(getWeekdayInTz(lateNight)).toBe(4);
	});
});

describe('weekdaysLabel (frecuencia del hábito)', () => {
	it('nombra los patrones comunes', () => {
		expect(weekdaysLabel(EVERY_DAY)).toBe('Todos los días');
		expect(weekdaysLabel(MON_FRI)).toBe('Lunes a viernes');
		expect(weekdaysLabel([0, 6])).toBe('Fines de semana');
		expect(weekdaysLabel([3])).toBe('Solo miércoles');
	});

	it('pone el domingo al final en listas mixtas', () => {
		expect(weekdaysLabel([0, 1, 3, 5])).toBe('L · X · V · D');
	});
});

describe('normalizeWeekdays y salud del hábito', () => {
	it('limpia, ordena y quita duplicados o valores inválidos', () => {
		expect(normalizeWeekdays([5, '1', 1, 9, -1, 3])).toEqual([1, 3, 5]);
		expect(normalizeWeekdays(null)).toEqual([]);
	});

	it('clasifica el cumplimiento: ≥70 verde, 30–69 amarillo, <30 rojo', () => {
		expect(habitHealthFromPct(70, 10)).toBe('green');
		expect(habitHealthFromPct(69, 10)).toBe('yellow');
		expect(habitHealthFromPct(30, 10)).toBe('yellow');
		expect(habitHealthFromPct(29, 10)).toBe('red');
		expect(habitHealthFromPct(0, 0)).toBe('neutral');
	});
});
