/** Temporizador Pomodoro compartido (sobrevive al cambiar de pestaña). */

export const FOCUS_MS = 25 * 60 * 1000;
export const BREAK_MS = 5 * 60 * 1000;

export type PomodoroPhase = 'focus' | 'break';

export const pomodoro = $state({
	phase: 'focus' as PomodoroPhase,
	remainingMs: FOCUS_MS,
	running: false,
	sessions: 0,
	linkedTaskId: null as number | null,
	linkedTaskTitle: ''
});

let endsAt: number | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

const clearTick = () => {
	if (tickTimer != null) {
		clearInterval(tickTimer);
		tickTimer = null;
	}
};

const playChime = () => {
	try {
		const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		const ctx = new Ctx();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.value = 880;
		gain.gain.value = 0.07;
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start();
		gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
		osc.stop(ctx.currentTime + 0.45);
		osc.onended = () => ctx.close();
	} catch {
		/* sin audio disponible */
	}
};

const completePhase = () => {
	clearTick();
	pomodoro.running = false;
	endsAt = null;
	playChime();

	if (pomodoro.phase === 'focus') {
		pomodoro.sessions += 1;
		pomodoro.phase = 'break';
		pomodoro.remainingMs = BREAK_MS;
	} else {
		pomodoro.phase = 'focus';
		pomodoro.remainingMs = FOCUS_MS;
	}
};

const syncRemaining = () => {
	if (!pomodoro.running || endsAt == null) return;
	const left = Math.max(0, endsAt - Date.now());
	pomodoro.remainingMs = left;
	if (left <= 0) completePhase();
};

export const formatPomodoroTime = (ms: number = pomodoro.remainingMs) => {
	const totalSec = Math.max(0, Math.ceil(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const startPomodoro = () => {
	if (pomodoro.running) return;
	if (pomodoro.remainingMs <= 0) {
		pomodoro.remainingMs = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
	}
	endsAt = Date.now() + pomodoro.remainingMs;
	pomodoro.running = true;
	clearTick();
	tickTimer = setInterval(syncRemaining, 250);
};

export const pausePomodoro = () => {
	if (!pomodoro.running) return;
	syncRemaining();
	pomodoro.running = false;
	endsAt = null;
	clearTick();
};

export const resetPomodoro = () => {
	clearTick();
	pomodoro.running = false;
	endsAt = null;
	pomodoro.remainingMs = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
};

export const setPomodoroPhase = (phase: PomodoroPhase) => {
	clearTick();
	pomodoro.running = false;
	endsAt = null;
	pomodoro.phase = phase;
	pomodoro.remainingMs = phase === 'focus' ? FOCUS_MS : BREAK_MS;
};

export const linkPomodoroTask = (id: number, title: string) => {
	pomodoro.linkedTaskId = id;
	pomodoro.linkedTaskTitle = title;
};

export const clearPomodoroTask = () => {
	pomodoro.linkedTaskId = null;
	pomodoro.linkedTaskTitle = '';
};
