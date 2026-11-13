// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El reproductor de YouTube y $app/environment no son parte de lo que se prueba
vi.mock('./youtubePlayer.svelte', () => ({ ytPlayer: { play: vi.fn(), pause: vi.fn() } }));
vi.mock('$app/environment', () => ({ browser: true, dev: true, building: false, version: 'test' }));
// El envío a Supabase se prueba en focusSessions.test.ts; aquí solo importa qué se registra
vi.mock('./focusSessions', () => ({ recordFocusSession: vi.fn(), flushFocusSessions: vi.fn() }));
vi.mock('./pomodoroNotify', () => ({ notifyPhaseEnd: vi.fn(), requestNotificationPermission: vi.fn() }));

const STORAGE_KEY = 'fokuz:pomodoro:v1';
const MIN = 60_000;
// 12 nov 2026, 10:00 a. m. en Bogotá
const NOW = new Date('2026-11-12T15:00:00Z');

/** Importa el módulo de cero (como al recargar la página). */
const loadPomodoro = async () => {
	vi.resetModules();
	return import('./pomodoro.svelte');
};

/** Lo que el Pomodoro mandó a focus_sessions desde la última recarga. */
const recorded = async () => {
	const { recordFocusSession } = await import('./focusSessions');
	return vi.mocked(recordFocusSession).mock.calls.map(([r]) => r);
};

// Recargar el módulo compila Svelte en cada prueba: margen extra en la corrida completa
describe('Pomodoro', { timeout: 20_000 }, () => {
	beforeEach(() => {
		localStorage.clear();
		// Solo se simulan los relojes que usa el Pomodoro; setImmediate/nextTick quedan reales
		// para que recargar el módulo (vi.resetModules + import) no se quede esperando.
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
		vi.setSystemTime(NOW);
	});
	afterEach(() => vi.useRealTimers());

	it('arranca en 25:00 de enfoque', async () => {
		const p = await loadPomodoro();
		expect(p.pomodoro.phase).toBe('focus');
		expect(p.formatPomodoroTime()).toBe('25:00');
	});

	it('pausar conserva el tiempo restante (no vuelve a 25:00)', async () => {
		const p = await loadPomodoro();
		p.startPomodoro();
		await vi.advanceTimersByTimeAsync(3000);
		p.pausePomodoro();
		expect(p.formatPomodoroTime()).toBe('24:57');
		await vi.advanceTimersByTimeAsync(10_000);
		expect(p.formatPomodoroTime()).toBe('24:57');
	});

	it('al recargar, una sesión en curso sigue corriendo donde iba', async () => {
		let p = await loadPomodoro();
		p.startPomodoro();
		await vi.advanceTimersByTimeAsync(5 * MIN);

		p = await loadPomodoro(); // "recarga"
		expect(p.pomodoro.running).toBe(true);
		expect(p.formatPomodoroTime()).toBe('20:00');
	});

	it('si la fase terminó con la página cerrada, al volver queda como terminada', async () => {
		let p = await loadPomodoro();
		p.startPomodoro();
		vi.setSystemTime(new Date(NOW.getTime() + 30 * MIN)); // pasaron 30 min sin la página

		p = await loadPomodoro();
		expect(p.pomodoro.running).toBe(false);
		expect(p.pomodoro.awaitingAck).toBe(true);
		expect(p.pomodoro.remainingMs).toBe(0);
	});

	it('la configuración de minutos se guarda entre recargas y respeta los límites', async () => {
		let p = await loadPomodoro();
		p.setPomodoroTimes(45, 10);
		p = await loadPomodoro();
		expect(p.pomodoroSettings).toEqual({ focusMins: 45, breakMins: 10 });
		expect(p.formatPomodoroTime()).toBe('45:00');

		p.setPomodoroTimes(999, 0);
		expect(p.pomodoroSettings).toEqual({ focusMins: p.MAX_FOCUS_MINS, breakMins: p.MIN_BREAK_MINS });
	});

	it('terminar un enfoque cuenta una sesión y arranca el descanso', async () => {
		const p = await loadPomodoro();
		p.setPomodoroTimes(25, 5);
		p.startPomodoro();
		await vi.advanceTimersByTimeAsync(25 * MIN + 500);
		expect(p.pomodoro.awaitingAck).toBe(true);

		p.acknowledgePomodoro();
		expect(p.pomodoro.sessions).toBe(1);
		expect(p.pomodoro.phase).toBe('break');
		expect(p.pomodoro.running).toBe(true);
		expect(p.formatPomodoroTime()).toBe('05:00');
	});

	it('Saltar cambia de fase sin contar la sesión', async () => {
		const p = await loadPomodoro();
		p.startPomodoro();
		p.skipPomodoro();
		expect(p.pomodoro.phase).toBe('break');
		expect(p.pomodoro.running).toBe(false);
		expect(p.pomodoro.sessions).toBe(0);
		p.skipPomodoro();
		expect(p.pomodoro.phase).toBe('focus');
	});

	it('las sesiones "de hoy" se reinician al cambiar de día', async () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ focusMins: 25, breakMins: 5, phase: 'focus', sessions: 4, sessionsDate: '2026-11-11', completedTasks: [{ title: 'Ayer', duration: 25 }] })
		);
		const p = await loadPomodoro();
		expect(p.pomodoro.sessions).toBe(0);
		expect(p.pomodoro.completedTasks).toEqual([]);
		expect(p.pomodoro.sessionsDate).toBe('2026-11-12');
	});

	it('la tarea vinculada sobrevive a la recarga', async () => {
		let p = await loadPomodoro();
		p.linkPomodoroTask(7, 'Devocional');
		p = await loadPomodoro();
		expect(p.pomodoro.linkedTaskId).toBe(7);
		expect(p.pomodoro.linkedTaskTitle).toBe('Devocional');
	});

	it('ignora datos guardados corruptos', async () => {
		localStorage.setItem(STORAGE_KEY, '{no-es-json');
		const p = await loadPomodoro();
		expect(p.formatPomodoroTime()).toBe('25:00');
	});

	describe('registro de sesiones (focus_sessions)', () => {
		it('un enfoque completo se registra una vez, con su tarea', async () => {
			const p = await loadPomodoro();
			p.linkPomodoroTask(7, 'Informe');
			p.startPomodoro();
			await vi.advanceTimersByTimeAsync(25 * MIN + 500);
			p.acknowledgePomodoro(); // arranca el descanso: todavía no se registra
			expect(await recorded()).toEqual([
				{
					phase: 'focus',
					startedAtMs: NOW.getTime(),
					endedAtMs: NOW.getTime() + 25 * MIN,
					plannedMs: 25 * MIN,
					remainingMs: 0,
					completed: true,
					taskId: 7
				}
			]);
		});

		it('pausar no registra; al terminar, la sesión conserva la hora de inicio original', async () => {
			const p = await loadPomodoro();
			p.startPomodoro();
			await vi.advanceTimersByTimeAsync(5 * MIN);
			p.pausePomodoro();
			await vi.advanceTimersByTimeAsync(30 * MIN);
			expect(await recorded()).toEqual([]);
			p.startPomodoro();
			await vi.advanceTimersByTimeAsync(20 * MIN + 500);
			const [r] = await recorded();
			expect(r.startedAtMs).toBe(NOW.getTime());
			expect(r.completed).toBe(true);
		});

		it('Saltar a mitad de un enfoque lo registra como interrumpido con lo que faltaba', async () => {
			const p = await loadPomodoro();
			p.startPomodoro();
			await vi.advanceTimersByTimeAsync(10 * MIN);
			p.skipPomodoro();
			const [r] = await recorded();
			expect(r.completed).toBe(false);
			expect(r.phase).toBe('focus');
			expect(r.remainingMs).toBe(15 * MIN);
		});

		it('Reiniciar también cierra la fase como interrumpida', async () => {
			const p = await loadPomodoro();
			p.startPomodoro();
			await vi.advanceTimersByTimeAsync(3 * MIN);
			p.resetPomodoro();
			expect((await recorded()).map((r) => r.completed)).toEqual([false]);
		});

		it('si terminó con la página cerrada, se registra al volver, y solo una vez', async () => {
			let p = await loadPomodoro();
			p.startPomodoro();
			vi.setSystemTime(NOW.getTime() + 60 * MIN); // página cerrada una hora
			p = await loadPomodoro();
			const [r] = await recorded();
			expect(r.completed).toBe(true);
			expect(r.endedAtMs).toBe(NOW.getTime() + 25 * MIN);

			vi.mocked((await import('./focusSessions')).recordFocusSession).mockClear();
			await loadPomodoro(); // otra recarga con la alarma sonando
			expect(await recorded()).toEqual([]);
		});
	});

	describe('aviso del sistema', () => {
		it('al terminar un enfoque avisa con los minutos del descanso; al iniciar pide permiso', async () => {
			const p = await loadPomodoro();
			const n = await import('./pomodoroNotify');
			p.setPomodoroTimes(25, 10);
			p.startPomodoro();
			expect(vi.mocked(n.requestNotificationPermission)).toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(25 * MIN + 500);
			expect(vi.mocked(n.notifyPhaseEnd).mock.calls.map(([phase, mins]) => [phase, mins])).toEqual([['focus', 10]]);
		});

		it('pausar o saltar no avisa', async () => {
			const p = await loadPomodoro();
			const n = await import('./pomodoroNotify');
			p.startPomodoro();
			p.pausePomodoro();
			p.skipPomodoro();
			expect(vi.mocked(n.notifyPhaseEnd)).not.toHaveBeenCalled();
		});

		it('termina a tiempo aunque el navegador frene el reloj de la pestaña oculta', async () => {
			const p = await loadPomodoro();
			const realSetInterval = globalThis.setInterval;
			// Simula una pestaña oculta: el intervalo de 250 ms no llega a correr
			vi.spyOn(globalThis, 'setInterval').mockImplementation((() => 0) as unknown as typeof setInterval);
			p.startPomodoro();
			await vi.advanceTimersByTimeAsync(25 * MIN + 100);
			expect(p.pomodoro.awaitingAck).toBe(true);
			globalThis.setInterval = realSetInterval;
		});
	});
});
