import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoteSaveQueue } from './noteSaveQueue';

describe('cola de guardado de notas', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('guarda automáticamente la nota editada tras la espera', async () => {
		const save = vi.fn(async () => true);
		const queue = createNoteSaveQueue(save, 2000);

		queue.schedule('A');
		await vi.advanceTimersByTimeAsync(1999);
		expect(save).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(save).toHaveBeenCalledWith('A');
		expect(queue.size).toBe(0);
	});

	it('cambiar de nota antes de la espera NO pierde la anterior (bug original)', async () => {
		const saved: string[] = [];
		const queue = createNoteSaveQueue(async (id) => {
			saved.push(id);
			return true;
		}, 2000);

		queue.schedule('A'); // escribo en la nota A
		await vi.advanceTimersByTimeAsync(500);
		queue.schedule('B'); // cambio a B y escribo antes de que se guarde A
		await vi.advanceTimersByTimeAsync(2000);

		expect(saved.sort()).toEqual(['A', 'B']);
	});

	it('flush guarda de inmediato todo lo pendiente (cambiar de nota, cerrar pestaña)', async () => {
		const save = vi.fn(async () => true);
		const queue = createNoteSaveQueue(save, 2000);

		queue.schedule('A');
		queue.markDirty('B');
		const ok = await queue.flush();

		expect(ok).toBe(true);
		expect(save).toHaveBeenCalledTimes(2);
		// el temporizador ya no vuelve a guardar
		await vi.advanceTimersByTimeAsync(5000);
		expect(save).toHaveBeenCalledTimes(2);
	});

	it('varias ediciones seguidas de la misma nota hacen un solo guardado', async () => {
		const save = vi.fn(async () => true);
		const queue = createNoteSaveQueue(save, 2000);

		for (let i = 0; i < 5; i++) {
			queue.schedule('A');
			await vi.advanceTimersByTimeAsync(300);
		}
		await vi.advanceTimersByTimeAsync(2000);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it('si el guardado falla, la nota sigue pendiente y se reintenta', async () => {
		const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		const queue = createNoteSaveQueue(save, 2000);

		queue.markDirty('A');
		expect(await queue.flush()).toBe(false);
		expect(queue.has('A')).toBe(true);

		expect(await queue.flush()).toBe(true);
		expect(queue.has('A')).toBe(false);
	});

	it('un error lanzado al guardar también deja la nota pendiente', async () => {
		const queue = createNoteSaveQueue(async () => {
			throw new Error('sin conexión');
		});
		queue.markDirty('A');
		expect(await queue.flush()).toBe(false);
		expect(queue.has('A')).toBe(true);
	});

	it('una nota eliminada se descarta y no se intenta guardar', async () => {
		const save = vi.fn(async () => true);
		const queue = createNoteSaveQueue(save, 2000);

		queue.schedule('A');
		queue.discard('A');
		await vi.advanceTimersByTimeAsync(3000);
		expect(save).not.toHaveBeenCalled();
	});

	it('flush sin nada pendiente no llama al servidor', async () => {
		const save = vi.fn(async () => true);
		expect(await createNoteSaveQueue(save).flush()).toBe(true);
		expect(save).not.toHaveBeenCalled();
	});
});
