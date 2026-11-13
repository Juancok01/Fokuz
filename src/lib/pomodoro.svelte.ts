/** Temporizador Pomodoro compartido (sobrevive al cambiar de pestaña y a recargar la página). */
import { browser } from '$app/environment';
import { ytPlayer } from './youtubePlayer.svelte';
import { formatDateInTz } from './habits';
import { flushFocusSessions, recordFocusSession } from './focusSessions';
import { notifyPhaseEnd, requestNotificationPermission } from './pomodoroNotify';

export const MIN_FOCUS_MINS = 5;
export const MAX_FOCUS_MINS = 180;
export const MIN_BREAK_MINS = 1;
export const MAX_BREAK_MINS = 60;

export let FOCUS_MS = 25 * 60 * 1000;
export let BREAK_MS = 5 * 60 * 1000;

export type PomodoroPhase = 'focus' | 'break';

/** Minutos configurados (persisten entre recargas). */
export const pomodoroSettings = $state({ focusMins: 25, breakMins: 5 });

export const pomodoro = $state({
	phase: 'focus' as PomodoroPhase,
	remainingMs: FOCUS_MS,
	running: false,
	awaitingAck: false,
	/** Sesiones de enfoque completadas en sessionsDate (día en zona Colombia). */
	sessions: 0,
	sessionsDate: '',
	linkedTaskId: null as number | null,
	linkedTaskTitle: '',
	completedTasks: [] as { title: string; duration: number }[]
});

export const pomodoroUI = $state({
	isOpen: false,
	isMaximized: false
});

let endsAt: number | null = null;
/** Cuándo arrancó la fase actual y cuánto duraba (para registrarla en focus_sessions). */
let phaseStartedAt: number | null = null;
let phasePlannedMs = 0;
let tickTimer: ReturnType<typeof setInterval> | null = null;
/** Disparo puntual al final de la fase: en pestañas ocultas el intervalo se frena hasta 1 vez por minuto. */
let endTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------- Persistencia ----------------
const STORAGE_KEY = 'fokuz:pomodoro:v1';

type Persisted = {
	focusMins: number;
	breakMins: number;
	phase: PomodoroPhase;
	remainingMs: number;
	running: boolean;
	awaitingAck: boolean;
	endsAt: number | null;
	sessions: number;
	sessionsDate: string;
	linkedTaskId: number | null;
	linkedTaskTitle: string;
	completedTasks: { title: string; duration: number }[];
	phaseStartedAt?: number | null;
	phasePlannedMs?: number;
};

const clamp = (n: number, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));

const phaseMs = (phase: PomodoroPhase) => (phase === 'focus' ? FOCUS_MS : BREAK_MS);

const persist = () => {
	if (!browser) return;
	const data: Persisted = {
		focusMins: pomodoroSettings.focusMins,
		breakMins: pomodoroSettings.breakMins,
		phase: pomodoro.phase,
		remainingMs: pomodoro.remainingMs,
		running: pomodoro.running,
		awaitingAck: pomodoro.awaitingAck,
		endsAt,
		sessions: pomodoro.sessions,
		sessionsDate: pomodoro.sessionsDate,
		linkedTaskId: pomodoro.linkedTaskId,
		linkedTaskTitle: pomodoro.linkedTaskTitle,
		completedTasks: pomodoro.completedTasks,
		phaseStartedAt,
		phasePlannedMs
	};
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		/* almacenamiento no disponible */
	}
};

/** Las métricas son "de hoy": al cambiar de día se reinician. */
const rollDailyMetrics = () => {
	const today = formatDateInTz();
	if (pomodoro.sessionsDate !== today) {
		pomodoro.sessionsDate = today;
		pomodoro.sessions = 0;
		pomodoro.completedTasks = [];
	}
};

const applyTimes = (focusMins: number, breakMins: number) => {
	pomodoroSettings.focusMins = clamp(focusMins, MIN_FOCUS_MINS, MAX_FOCUS_MINS);
	pomodoroSettings.breakMins = clamp(breakMins, MIN_BREAK_MINS, MAX_BREAK_MINS);
	FOCUS_MS = pomodoroSettings.focusMins * 60 * 1000;
	BREAK_MS = pomodoroSettings.breakMins * 60 * 1000;
};

// ---------------- Registro de sesiones ----------------
/** Envía la fase en curso a focus_sessions (completa o interrumpida) y la da por cerrada. */
const finishPhaseRecord = (completed: boolean, endedAtMs: number) => {
	if (phaseStartedAt == null) return;
	recordFocusSession({
		phase: pomodoro.phase,
		startedAtMs: phaseStartedAt,
		endedAtMs,
		plannedMs: phasePlannedMs,
		remainingMs: completed ? 0 : pomodoro.remainingMs,
		completed,
		taskId: pomodoro.linkedTaskId
	});
	phaseStartedAt = null;
};

/** La fase en curso se abandona (saltar, reiniciar, cambiar tiempos o de fase). */
const abandonPhase = () => {
	if (pomodoro.running) {
		const left = endsAt == null ? pomodoro.remainingMs : Math.max(0, endsAt - Date.now());
		pomodoro.remainingMs = left;
	}
	finishPhaseRecord(false, Date.now());
};

// ---------------- Temporizador ----------------
const clearTick = () => {
	if (tickTimer != null) {
		clearInterval(tickTimer);
		tickTimer = null;
	}
	if (endTimer != null) {
		clearTimeout(endTimer);
		endTimer = null;
	}
};

const completePhase = () => {
	finishPhaseRecord(true, endsAt ?? Date.now());
	clearTick();
	pomodoro.running = false;
	endsAt = null;
	pomodoro.remainingMs = 0;
	pomodoro.awaitingAck = true;
	ytPlayer.pause();
	persist();
	// Aviso del sistema si Fokuz no está a la vista (si lo está, ya suena la alarma)
	const nextMins = pomodoro.phase === 'focus' ? pomodoroSettings.breakMins : pomodoroSettings.focusMins;
	notifyPhaseEnd(pomodoro.phase, nextMins, () => {
		pomodoroUI.isOpen = true;
	});
};

const syncRemaining = () => {
	if (!pomodoro.running || endsAt == null) return;
	const left = Math.max(0, endsAt - Date.now());
	pomodoro.remainingMs = left;
	if (left <= 0) completePhase();
};

const startTicking = () => {
	clearTick();
	tickTimer = setInterval(syncRemaining, 250);
	if (endsAt != null) endTimer = setTimeout(syncRemaining, Math.max(0, endsAt - Date.now()) + 50);
};

export const formatPomodoroTime = (ms: number = pomodoro.remainingMs) => {
	const totalSec = Math.max(0, Math.ceil(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const setPomodoroTimes = (focusMins: number, breakMins: number) => {
	applyTimes(focusMins, breakMins);
	if (!pomodoro.running && !pomodoro.awaitingAck) {
		abandonPhase(); // la fase pausada vuelve a empezar con los tiempos nuevos
		pomodoro.remainingMs = phaseMs(pomodoro.phase);
	}
	persist();
};

export const startPomodoro = () => {
	if (pomodoro.running || pomodoro.awaitingAck) return;
	requestNotificationPermission(); // la primera vez, el navegador pregunta si permite avisos
	rollDailyMetrics();

	if (pomodoro.remainingMs <= 0) {
		pomodoro.remainingMs = phaseMs(pomodoro.phase);
	}
	if (phaseStartedAt == null) {
		phaseStartedAt = Date.now();
		phasePlannedMs = pomodoro.remainingMs;
	}
	endsAt = Date.now() + pomodoro.remainingMs;
	pomodoro.running = true;
	startTicking();

	if (pomodoro.phase === 'focus') {
		ytPlayer.play();
	}
	persist();
};

export const pausePomodoro = () => {
	if (!pomodoro.running || pomodoro.awaitingAck) return;
	syncRemaining();
	pomodoro.running = false;
	endsAt = null;
	clearTick();
	ytPlayer.pause();
	persist();
};

/** Confirma el fin del ciclo: apaga la alarma y arranca la siguiente fase. */
export const acknowledgePomodoro = () => {
	if (!pomodoro.awaitingAck) return;

	pomodoro.awaitingAck = false;
	pomodoro.running = false;
	endsAt = null;

	if (pomodoro.phase === 'focus') {
		rollDailyMetrics();
		pomodoro.sessions += 1;
		if (pomodoro.linkedTaskTitle) {
			pomodoro.completedTasks.push({
				title: pomodoro.linkedTaskTitle,
				duration: Math.round(FOCUS_MS / 60000)
			});
		}
		pomodoro.phase = 'break';
		pomodoro.remainingMs = BREAK_MS;
	} else {
		pomodoro.phase = 'focus';
		pomodoro.remainingMs = FOCUS_MS;
	}

	// Arranca la siguiente fase de inmediato
	startPomodoro();
};

/**
 * Salta a la siguiente fase sin contarla como completada.
 * Si la fase ya terminó (alarma sonando), equivale a confirmarla.
 */
export const skipPomodoro = () => {
	if (pomodoro.awaitingAck) {
		acknowledgePomodoro();
		return;
	}
	abandonPhase();
	clearTick();
	pomodoro.running = false;
	endsAt = null;
	pomodoro.phase = pomodoro.phase === 'focus' ? 'break' : 'focus';
	pomodoro.remainingMs = phaseMs(pomodoro.phase);
	ytPlayer.pause();
	persist();
};

export const resetPomodoro = () => {
	abandonPhase();
	clearTick();
	pomodoro.running = false;
	pomodoro.awaitingAck = false;
	endsAt = null;
	pomodoro.remainingMs = phaseMs(pomodoro.phase);
	ytPlayer.pause();
	persist();
};

export const setPomodoroPhase = (phase: PomodoroPhase) => {
	if (pomodoro.running || pomodoro.awaitingAck) return;
	abandonPhase();
	clearTick();
	pomodoro.running = false;
	pomodoro.awaitingAck = false;
	endsAt = null;
	pomodoro.phase = phase;
	pomodoro.remainingMs = phaseMs(phase);
	ytPlayer.pause();
	persist();
};

export const linkPomodoroTask = (id: number, title: string) => {
	pomodoro.linkedTaskId = id;
	pomodoro.linkedTaskTitle = title;
	persist();
};

export const clearPomodoroTask = () => {
	pomodoro.linkedTaskId = null;
	pomodoro.linkedTaskTitle = '';
	persist();
};

// ---------------- Restaurar al cargar ----------------
const restore = () => {
	if (!browser) return;
	let saved: Partial<Persisted> | null = null;
	try {
		saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
	} catch {
		saved = null;
	}

	if (!saved) {
		pomodoro.sessionsDate = formatDateInTz();
		return;
	}

	applyTimes(Number(saved.focusMins ?? 25), Number(saved.breakMins ?? 5));
	pomodoro.phase = saved.phase === 'break' ? 'break' : 'focus';
	pomodoro.sessions = Math.max(0, Number(saved.sessions) || 0);
	pomodoro.sessionsDate = typeof saved.sessionsDate === 'string' ? saved.sessionsDate : '';
	pomodoro.linkedTaskId = typeof saved.linkedTaskId === 'number' ? saved.linkedTaskId : null;
	pomodoro.linkedTaskTitle = typeof saved.linkedTaskTitle === 'string' ? saved.linkedTaskTitle : '';
	pomodoro.completedTasks = Array.isArray(saved.completedTasks) ? saved.completedTasks : [];
	phaseStartedAt = typeof saved.phaseStartedAt === 'number' ? saved.phaseStartedAt : null;
	phasePlannedMs = Number(saved.phasePlannedMs) > 0 ? Number(saved.phasePlannedMs) : phaseMs(pomodoro.phase);
	rollDailyMetrics();

	if (saved.awaitingAck) {
		pomodoro.awaitingAck = true;
		pomodoro.running = false;
		pomodoro.remainingMs = 0;
	} else if (saved.running && typeof saved.endsAt === 'number') {
		const left = saved.endsAt - Date.now();
		if (left > 0) {
			// Sigue corriendo donde iba (la música no se reanuda sola: el navegador lo bloquea)
			endsAt = saved.endsAt;
			pomodoro.running = true;
			pomodoro.remainingMs = left;
			startTicking();
		} else {
			// Terminó mientras la página estaba cerrada
			finishPhaseRecord(true, saved.endsAt);
			pomodoro.remainingMs = 0;
			pomodoro.running = false;
			pomodoro.awaitingAck = true;
		}
	} else {
		const remaining = Number(saved.remainingMs);
		const full = phaseMs(pomodoro.phase);
		pomodoro.remainingMs = remaining > 0 && remaining <= full ? remaining : full;
	}
	persist();
	flushFocusSessions(); // reintenta lo que quedó pendiente (p. ej. sin conexión)
};

restore();

// Al volver a la pestaña, actualiza el reloj de inmediato
if (browser) document.addEventListener('visibilitychange', syncRemaining);
