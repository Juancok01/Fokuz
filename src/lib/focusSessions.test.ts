// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { buildFocusSession, createFocusLogger, type FocusPhaseRecord } from './focusSessions';

const USER = 'user-a';
const T0 = Date.parse('2026-11-13T15:00:00Z');
const MIN = 60_000;

const rec = (over: Partial<FocusPhaseRecord> = {}): FocusPhaseRecord => ({
	phase: 'focus',
	startedAtMs: T0,
	endedAtMs: T0 + 25 * MIN,
	plannedMs: 25 * MIN,
	remainingMs: 0,
	completed: true,
	taskId: 7,
	...over
});

describe('buildFocusSession (fila de focus_sessions)', () => {
	it('fase completa: tiempo real = tiempo planeado', () => {
		expect(buildFocusSession(rec(), USER)).toEqual({
			user_id: USER,
			phase: 'focus',
			started_at: '2026-11-13T15:00:00.000Z',
			ended_at: '2026-11-13T15:25:00.000Z',
			planned_seconds: 1500,
			actual_seconds: 1500,
			completed: true,
			task_id: 7
		});
	});

	it('fase interrumpida: cuenta solo lo que corrió el reloj (sin pausas)', () => {
		// 10 min corridos, con una pausa larga en medio: terminó 40 min después de empezar
		const row = buildFocusSession(
			rec({ completed: false, remainingMs: 15 * MIN, endedAtMs: T0 + 40 * MIN }),
			USER
		);
		expect(row?.actual_seconds).toBe(600);
		expect(row?.completed).toBe(false);
	});

	it('una interrupción de menos de 1 minuto no se registra', () => {
		expect(buildFocusSession(rec({ completed: false, remainingMs: 25 * MIN - 30_000 }), USER)).toBeNull();
	});

	it('datos imposibles se corrigen o se descartan', () => {
		expect(buildFocusSession(rec({ endedAtMs: T0 - MIN }), USER)?.ended_at).toBe('2026-11-13T15:00:00.000Z');
		expect(buildFocusSession(rec({ plannedMs: 0 }), USER)).toBeNull();
		expect(buildFocusSession(rec(), '')).toBeNull();
		expect(buildFocusSession(rec({ startedAtMs: NaN }), USER)).toBeNull();
	});
});

describe('createFocusLogger (cola local + envío)', () => {
	const setup = (insert: (row: unknown) => Promise<{ code?: string | null } | null>, userId: string | null = USER) => {
		localStorage.clear();
		const insertSpy = vi.fn(insert);
		const logger = createFocusLogger({
			insert: insertSpy,
			getUserId: async () => userId,
			storage: localStorage
		});
		return { logger, insertSpy };
	};

	it('envía la sesión y deja la cola vacía', async () => {
		const { logger, insertSpy } = setup(async () => null);
		await logger.record(rec());
		expect(insertSpy).toHaveBeenCalledTimes(1);
		expect(logger.pending()).toEqual([]);
	});

	it('sin conexión (o sin la tabla todavía) queda en cola y se envía después, en orden', async () => {
		let online = false;
		const { logger, insertSpy } = setup(async () => (online ? null : { code: 'PGRST205' }));
		await logger.record(rec());
		await logger.record(rec({ startedAtMs: T0 + 30 * MIN, endedAtMs: T0 + 55 * MIN }));
		expect(logger.pending()).toHaveLength(2);

		online = true;
		await logger.flush();
		expect(logger.pending()).toEqual([]);
		const sentStarts = insertSpy.mock.calls.slice(-2).map(([r]) => (r as { started_at: string }).started_at);
		expect(sentStarts).toEqual(['2026-11-13T15:00:00.000Z', '2026-11-13T15:30:00.000Z']);
	});

	it('la cola sobrevive a recargar la página', async () => {
		const { logger } = setup(async () => ({ code: null }));
		await logger.record(rec());
		const reloaded = createFocusLogger({
			insert: async () => null,
			getUserId: async () => USER,
			storage: localStorage
		});
		expect(reloaded.pending()).toHaveLength(1);
		await reloaded.flush();
		expect(reloaded.pending()).toEqual([]);
	});

	it('un error que no se arregla reintentando (RLS) descarta la fila en vez de trabar la cola', async () => {
		const { logger } = setup(async () => ({ code: '42501' }));
		await logger.record(rec());
		expect(logger.pending()).toEqual([]);
	});

	it('no duplica la misma fase si se registra dos veces', async () => {
		const { logger } = setup(async () => ({ code: null }));
		await logger.record(rec());
		await logger.record(rec());
		expect(logger.pending()).toHaveLength(1);
	});

	it('sin sesión iniciada no guarda nada', async () => {
		const { logger, insertSpy } = setup(async () => null, null);
		await logger.record(rec());
		expect(insertSpy).not.toHaveBeenCalled();
		expect(logger.pending()).toEqual([]);
	});
});
