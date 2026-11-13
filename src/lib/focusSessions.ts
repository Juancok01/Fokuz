/**
 * Registro de sesiones de Pomodoro en la tabla public.focus_sessions (migración 033).
 *
 * Cada fase terminada (completa o interrumpida) se guarda primero en una cola local y
 * después se envía a Supabase. Si no hay conexión, o la tabla todavía no existe, queda en
 * la cola y se reintenta en el siguiente registro o al recargar la app.
 * Probado en focusSessions.test.ts.
 */

export type FocusPhase = 'focus' | 'break';

/** Lo que sabe el temporizador cuando termina una fase. */
export type FocusPhaseRecord = {
	phase: FocusPhase;
	startedAtMs: number;
	endedAtMs: number;
	/** Duración configurada de la fase. */
	plannedMs: number;
	/** Tiempo que faltaba al terminar (0 si se completó). */
	remainingMs: number;
	completed: boolean;
	taskId: number | null;
};

/** Fila de public.focus_sessions. */
export type FocusSessionRow = {
	user_id: string;
	phase: FocusPhase;
	started_at: string;
	ended_at: string;
	planned_seconds: number;
	actual_seconds: number;
	completed: boolean;
	task_id: number | null;
};

/** Una fase interrumpida con menos de esto no se registra (fue un clic de prueba, no una sesión). */
export const MIN_INTERRUPTED_SECONDS = 60;

/**
 * Convierte lo que sabe el temporizador en una fila. Devuelve null si no vale la pena guardarla
 * (interrumpida demasiado pronto) o si los datos no tienen sentido.
 */
export function buildFocusSession(rec: FocusPhaseRecord, userId: string): FocusSessionRow | null {
	if (!userId || !Number.isFinite(rec.startedAtMs) || !Number.isFinite(rec.endedAtMs)) return null;
	const planned = Math.round(rec.plannedMs / 1000);
	if (planned <= 0) return null;

	// Tiempo realmente corrido (sin contar pausas): lo configurado menos lo que faltaba
	const actual = rec.completed
		? planned
		: Math.min(planned, Math.max(0, Math.round((rec.plannedMs - rec.remainingMs) / 1000)));
	if (!rec.completed && actual < MIN_INTERRUPTED_SECONDS) return null;

	const endedAtMs = Math.max(rec.endedAtMs, rec.startedAtMs);
	return {
		user_id: userId,
		phase: rec.phase,
		started_at: new Date(rec.startedAtMs).toISOString(),
		ended_at: new Date(endedAtMs).toISOString(),
		planned_seconds: planned,
		actual_seconds: actual,
		completed: rec.completed,
		task_id: rec.taskId
	};
}

/** Errores de Postgres que nunca se arreglan reintentando: esa fila se descarta. */
const PERMANENT_ERRORS = new Set([
	'42501', // RLS: la fila es de otro usuario (p. ej. se cambió de cuenta en este navegador)
	'23514', // check violado
	'23502', // falta un dato obligatorio
	'22P02' // formato inválido
]);

type InsertResult = { code?: string | null } | null;

type LoggerOptions = {
	/** Inserta una fila; devuelve el error o null. Los duplicados deben ignorarse. */
	insert: (row: FocusSessionRow) => Promise<InsertResult>;
	getUserId: () => Promise<string | null>;
	storage?: Storage | null;
	storageKey?: string;
	/** Tamaño máximo de la cola local (se descartan las más viejas). */
	maxQueue?: number;
};

export function createFocusLogger({
	insert,
	getUserId,
	storage = null,
	storageKey = 'fokuz:focus-sessions-queue:v1',
	maxQueue = 500
}: LoggerOptions) {
	const readQueue = (): FocusSessionRow[] => {
		try {
			const parsed = JSON.parse(storage?.getItem(storageKey) ?? '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	};
	const writeQueue = (rows: FocusSessionRow[]) => {
		try {
			if (rows.length) storage?.setItem(storageKey, JSON.stringify(rows.slice(-maxQueue)));
			else storage?.removeItem(storageKey);
		} catch {
			/* almacenamiento no disponible */
		}
	};

	let memoryQueue: FocusSessionRow[] = [];
	const getQueue = () => (storage ? readQueue() : memoryQueue);
	const setQueue = (rows: FocusSessionRow[]) => {
		if (storage) writeQueue(rows);
		else memoryQueue = rows.slice(-maxQueue);
	};

	let flushing: Promise<void> | null = null;

	/** Envía la cola en orden; lo que falla por algo temporal se queda para después. */
	const flush = (): Promise<void> => {
		if (flushing) return flushing;
		flushing = (async () => {
			const queue = getQueue();
			const sent = new Set<string>();
			for (const row of queue) {
				let error: InsertResult;
				try {
					error = await insert(row);
				} catch {
					error = { code: null }; // sin conexión
				}
				if (!error || (error.code && PERMANENT_ERRORS.has(error.code))) {
					sent.add(`${row.user_id}|${row.started_at}`);
				} else {
					break; // problema temporal: se reintenta después, sin cambiar el orden
				}
			}
			// Se relee la cola: pudo crecer mientras se enviaba
			setQueue(getQueue().filter((r) => !sent.has(`${r.user_id}|${r.started_at}`)));
		})().finally(() => {
			flushing = null;
		});
		return flushing;
	};

	const record = async (rec: FocusPhaseRecord) => {
		const userId = await getUserId();
		const row = userId ? buildFocusSession(rec, userId) : null;
		if (row) {
			const queue = getQueue();
			if (!queue.some((r) => r.user_id === row.user_id && r.started_at === row.started_at)) {
				setQueue([...queue, row]);
			}
		}
		if (flushing) await flushing;
		await flush();
	};

	return { record, flush, pending: getQueue };
}

// ---------------- Instancia de la app (Supabase) ----------------
let appLogger: ReturnType<typeof createFocusLogger> | null = null;

const getAppLogger = () => {
	if (appLogger) return appLogger;
	const client = async () => (await import('./supabaseClient')).supabase;
	appLogger = createFocusLogger({
		storage: typeof localStorage === 'undefined' ? null : localStorage,
		getUserId: async () => {
			const db = await client();
			if (!db) return null;
			const { data } = await db.auth.getSession();
			return data.session?.user.id ?? null;
		},
		insert: async (row) => {
			const db = await client();
			if (!db) return { code: null };
			const { error } = await db
				.from('focus_sessions')
				.upsert(row, { onConflict: 'user_id,started_at', ignoreDuplicates: true });
			return error ? { code: error.code ?? null } : null;
		}
	});
	return appLogger;
};

/** Registra una fase terminada. Nunca lanza: si falla, queda en la cola local. */
export const recordFocusSession = (rec: FocusPhaseRecord) =>
	getAppLogger()
		.record(rec)
		.catch(() => {});

/** Reintenta enviar lo que haya quedado pendiente. */
export const flushFocusSessions = () =>
	getAppLogger()
		.flush()
		.catch(() => {});
