/**
 * Cola de guardado de notas.
 *
 * Cada nota editada se marca como pendiente con su propio id; el guardado automático
 * guarda esas notas (no "la que esté abierta"), y `flush()` permite guardar de inmediato
 * al cambiar de nota, ocultar la pestaña o salir de la página. Si un guardado falla, la
 * nota sigue pendiente para reintentarse.
 *
 * Probado en noteSaveQueue.test.ts.
 */
export type SaveFn = (noteId: string) => Promise<boolean>;

export function createNoteSaveQueue(save: SaveFn, delayMs = 2000) {
	const pending = new Set<string>();
	let timer: ReturnType<typeof setTimeout> | null = null;

	const clearTimer = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	};

	async function flush(): Promise<boolean> {
		clearTimer();
		const ids = [...pending];
		if (ids.length === 0) return true;
		const results = await Promise.all(
			ids.map(async (id) => {
				pending.delete(id);
				let ok = false;
				try {
					ok = await save(id);
				} catch {
					ok = false;
				}
				if (!ok) pending.add(id);
				return ok;
			})
		);
		return results.every(Boolean);
	}

	return {
		/** Marca la nota como pendiente y (re)programa el guardado automático. */
		schedule(noteId: string) {
			pending.add(noteId);
			clearTimer();
			timer = setTimeout(() => {
				timer = null;
				void flush();
			}, delayMs);
		},
		/** Marca la nota como pendiente sin programar (para guardarla con flush()). */
		markDirty(noteId: string) {
			pending.add(noteId);
		},
		/** Olvida una nota pendiente (p. ej. porque se eliminó). */
		discard(noteId: string) {
			pending.delete(noteId);
		},
		has: (noteId: string) => pending.has(noteId),
		get size() {
			return pending.size;
		},
		flush
	};
}
