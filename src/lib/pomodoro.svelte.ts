/** Temporizador Pomodoro compartido (sobrevive al cambiar de pestaña). */
import { ytPlayer } from './youtubePlayer.svelte';

export let FOCUS_MS = 25 * 60 * 1000;
export let BREAK_MS = 5 * 60 * 1000;

export const setPomodoroTimes = (focusMins: number, breakMins: number) => {
	FOCUS_MS = focusMins * 60 * 1000;
	BREAK_MS = breakMins * 60 * 1000;
	if (!pomodoro.running && !pomodoro.awaitingAck) {
		pomodoro.remainingMs = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
	}
};

export type PomodoroPhase = 'focus' | 'break';

export const pomodoro = $state({
	phase: 'focus' as PomodoroPhase,
	remainingMs: FOCUS_MS,
	running: false,
	awaitingAck: false,
	sessions: 0,
	linkedTaskId: null as number | null,
	linkedTaskTitle: '',
	completedTasks: [] as {title: string, duration: number}[]
});

export const pomodoroUI = $state({
	isOpen: false,
	isMaximized: false
});

let endsAt: number | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

const clearTick = () => {
	if (tickTimer != null) {
		clearInterval(tickTimer);
		tickTimer = null;
	}
};

const completePhase = () => {
	clearTick();
	pomodoro.running = false;
	endsAt = null;
	pomodoro.remainingMs = 0;
	pomodoro.awaitingAck = true;
	ytPlayer.pause();
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
	if (pomodoro.running || pomodoro.awaitingAck) return;
	
	if (pomodoro.remainingMs <= 0) {
		pomodoro.remainingMs = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
	}
	endsAt = Date.now() + pomodoro.remainingMs;
	pomodoro.running = true;
	clearTick();
	tickTimer = setInterval(syncRemaining, 250);
	
	if (pomodoro.phase === 'focus') {
		ytPlayer.play();
	}
};

export const pausePomodoro = () => {
	if (!pomodoro.running || pomodoro.awaitingAck) return;
	syncRemaining();
	pomodoro.running = false;
	endsAt = null;
	clearTick();
	ytPlayer.pause();
};

/** Confirma el fin del ciclo: apaga el pito y prepara la siguiente fase. */
export const acknowledgePomodoro = () => {
	if (!pomodoro.awaitingAck) return;

	pomodoro.awaitingAck = false;
	pomodoro.running = false;
	endsAt = null;

	if (pomodoro.phase === 'focus') {
		pomodoro.sessions += 1;
		if (pomodoro.linkedTaskTitle) {
			pomodoro.completedTasks.push({ title: pomodoro.linkedTaskTitle, duration: Math.round(FOCUS_MS / 60000) });
		}
		pomodoro.phase = 'break';
		pomodoro.remainingMs = BREAK_MS;
	} else {
		pomodoro.phase = 'focus';
		pomodoro.remainingMs = FOCUS_MS;
	}
	
	// Auto-start the next phase immediately after acknowledging
	startPomodoro();
};

export const resetPomodoro = () => {
	clearTick();
	pomodoro.running = false;
	pomodoro.awaitingAck = false;
	endsAt = null;
	pomodoro.remainingMs = pomodoro.phase === 'focus' ? FOCUS_MS : BREAK_MS;
	ytPlayer.pause();
};

export const setPomodoroPhase = (phase: PomodoroPhase) => {
	if (pomodoro.running || pomodoro.awaitingAck) return;
	clearTick();
	pomodoro.running = false;
	pomodoro.awaitingAck = false;
	endsAt = null;
	pomodoro.phase = phase;
	pomodoro.remainingMs = phase === 'focus' ? FOCUS_MS : BREAK_MS;
	ytPlayer.pause();
};

export const linkPomodoroTask = (id: number, title: string) => {
	pomodoro.linkedTaskId = id;
	pomodoro.linkedTaskTitle = title;
};

export const clearPomodoroTask = () => {
	pomodoro.linkedTaskId = null;
	pomodoro.linkedTaskTitle = '';
};
