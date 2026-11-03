<script lang="ts">
	import { X, Plus, Trash2, Check } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { FinanceCategory, TxType } from '$lib/finance';

	let {
		open = false,
		boardId,
		categories = [],
		onclose,
		onchanged
	}: {
		open: boolean;
		boardId: number;
		categories: FinanceCategory[];
		onclose: () => void;
		onchanged: () => void;
	} = $props();

	const EMOJIS = ['🛒', '🍔', '☕', '🚌', '⛽', '💡', '🏠', '💊', '🎬', '🛍️', '📚', '🏦', '🐶', '👶', '🎮', '✈️', '🎁', '💼', '✨', '🏷️', '📥', '📦', '💪', '📱'];

	let tab = $state<TxType>('expense');
	let newName = $state('');
	let newIcon = $state('📦');
	let editingId = $state<number | null>(null);
	let editName = $state('');
	let editIcon = $state('');
	let pendingDelete = $state<number | null>(null);
	let busy = $state(false);
	let errorMsg = $state('');

	const list = $derived(
		categories.filter((c) => c.type === tab).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
	);

	$effect(() => {
		if (open) {
			errorMsg = '';
			editingId = null;
			pendingDelete = null;
		}
	});

	async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
		if (!supabase) return false;
		busy = true;
		errorMsg = '';
		const { error } = await action();
		busy = false;
		if (error) {
			errorMsg = error.message;
			return false;
		}
		onchanged();
		return true;
	}

	async function add() {
		const name = newName.trim();
		if (!name || !supabase) return;
		const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));
		const ok = await run(() =>
			supabase!.from('finance_categories').insert({ board_id: boardId, name, type: tab, icon: newIcon, sort_order: maxOrder + 1 })
		);
		if (ok) newName = '';
	}

	function startEdit(cat: FinanceCategory) {
		editingId = cat.id;
		editName = cat.name;
		editIcon = cat.icon || '📦';
		pendingDelete = null;
	}

	async function saveEdit() {
		if (editingId === null || !editName.trim()) return;
		const id = editingId;
		const ok = await run(() =>
			supabase!.from('finance_categories').update({ name: editName.trim(), icon: editIcon }).eq('id', id)
		);
		if (ok) editingId = null;
	}

	async function remove(id: number) {
		if (pendingDelete !== id) {
			pendingDelete = id;
			return;
		}
		await run(() => supabase!.from('finance_categories').delete().eq('id', id));
		pendingDelete = null;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onclick={onclose}>
		<div
			class="w-full max-w-md bg-brand-surface rounded-t-3xl sm:rounded-2xl p-5 pt-3 shadow-2xl border-t sm:border border-brand-divider max-h-[92dvh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-4 sm:hidden"></div>
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-bold text-brand-text">Categorías</h3>
				<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={onclose} aria-label="Cerrar">
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="grid grid-cols-2 bg-brand-bg rounded-xl p-1 mb-4">
				<button class="py-2 rounded-lg text-sm font-bold {tab === 'expense' ? 'bg-red-500 text-white' : 'text-brand-text-muted'}" onclick={() => (tab = 'expense')}>Gastos</button>
				<button class="py-2 rounded-lg text-sm font-bold {tab === 'income' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted'}" onclick={() => (tab = 'income')}>Ingresos</button>
			</div>

			<ul class="space-y-2 mb-5">
				{#each list as cat (cat.id)}
					<li class="rounded-xl bg-brand-bg px-3 py-2">
						{#if editingId === cat.id}
							<div class="flex flex-wrap gap-1 mb-2">
								{#each EMOJIS as e}
									<button class="w-8 h-8 rounded-lg text-lg {editIcon === e ? 'bg-brand-surface-elevated' : ''}" onclick={() => (editIcon = e)}>{e}</button>
								{/each}
							</div>
							<div class="flex gap-2">
								<input bind:value={editName} maxlength={20} class="flex-1 bg-brand-surface rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
								<button onclick={saveEdit} disabled={busy} class="px-3 rounded-lg bg-brand-accent text-brand-bg" aria-label="Guardar"><Check class="w-4 h-4" /></button>
								<button onclick={() => (editingId = null)} class="px-3 rounded-lg bg-brand-surface text-brand-text-muted" aria-label="Cancelar"><X class="w-4 h-4" /></button>
							</div>
						{:else}
							<div class="flex items-center gap-3">
								<button class="flex-1 flex items-center gap-3 text-left min-w-0" onclick={() => startEdit(cat)}>
									<span class="text-xl">{cat.icon || '•'}</span>
									<span class="text-brand-text truncate">{cat.name}</span>
								</button>
								<button
									onclick={() => remove(cat.id)}
									disabled={busy}
									class="px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 {pendingDelete === cat.id ? 'bg-red-500 text-white' : 'text-brand-text-muted hover:text-red-400'}"
									aria-label="Eliminar {cat.name}"
								>
									<Trash2 class="w-4 h-4" />{pendingDelete === cat.id ? '¿Eliminar?' : ''}
								</button>
							</div>
						{/if}
					</li>
				{:else}
					<li class="text-sm text-brand-text-muted text-center py-4">Sin categorías todavía.</li>
				{/each}
			</ul>

			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Nueva categoría</p>
			<div class="flex flex-wrap gap-1 mb-2">
				{#each EMOJIS as e}
					<button class="w-8 h-8 rounded-lg text-lg {newIcon === e ? 'bg-brand-surface-elevated' : ''}" onclick={() => (newIcon = e)}>{e}</button>
				{/each}
			</div>
			<div class="flex gap-2">
				<input
					bind:value={newName}
					maxlength={20}
					placeholder="Nombre"
					onkeydown={(e) => e.key === 'Enter' && add()}
					class="flex-1 bg-brand-bg rounded-xl px-4 py-3 text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
				/>
				<button onclick={add} disabled={busy || !newName.trim()} class="px-4 rounded-xl bg-brand-accent text-brand-bg font-bold disabled:opacity-50 flex items-center gap-1">
					<Plus class="w-4 h-4" /> Agregar
				</button>
			</div>
			<p class="text-xs text-brand-text-muted mt-3">Al eliminar una categoría, sus movimientos quedan como “Sin categoría”.</p>

			{#if errorMsg}<p class="text-sm text-red-400 mt-3">{errorMsg}</p>{/if}
		</div>
	</div>
{/if}
