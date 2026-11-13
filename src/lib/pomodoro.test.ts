// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El reproductor de YouTube y $app/environment no son parte de lo que se prueba
vi.mock('./youtubePlayer.svelte', () => ({ ytPlayer: { play: vi.fn(), pause: vi.fn() } }));
vi.mock('$app/environment', () => ({ browser: true, dev: true, building: false, version: 'test' }));

const STORAGE_KEY = 'fokuz:pomodoro:v1';
const MIN = 60_000;
// 12 nov 2026, 10:00 a. m. en Bogotá
const NOW = new Date('2026-11-12T15:00:00Z');

/** Importa el módulo de cero (como al recargar la página). */
const loadPomodoro = async () => {
	vi.resetModules();
	return import('./pomodoro.svelte');
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
});
