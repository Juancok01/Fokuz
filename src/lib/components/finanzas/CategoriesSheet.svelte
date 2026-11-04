<script lang="ts">
	import { X, Plus, Trash2, Check, ChevronDown, Pencil, CornerDownRight } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import { digitsOnly, formatCOP, formatDigits, type FinanceCategory, type FinanceSubcategory, type TxType } from '$lib/finance';

	let {
		open = false,
		boardId,
		categories = [],
		subcategories = [],
		onclose,
		onchanged
	}: {
		open: boolean;
		boardId: number;
		categories: FinanceCategory[];
		subcategories: FinanceSubcategory[];
		onclose: () => void;
		onchanged: () => void;
	} = $props();

	const EMOJIS = ['🛒', '🍔', '☕', '🚌', '⛽', '💡', '🏠', '💊', '🎬', '🛍️', '📚', '🏦', '🐶', '👶', '🎮', '✈️', '🎁', '💼', '✨', '🏷️', '📥', '📦', '💪', '📱'];

	let tab = $state<TxType>('expense');
	let newName = $state('');
	let newIcon = $state('📦');
	let expandedId = $state<number | null>(null);
	let newSubName = $state('');
	let newSubBudget = $state('');

	// edición: categoría (con emoji) o subcategoría
	let editing = $state<{ kind: 'cat' | 'sub'; id: number } | null>(null);
	let editName = $state('');
	let editIcon = $state('');
	let editBudget = $state('');
	let pendingDelete = $state<string | null>(null); // 'cat:3' | 'sub:7'
	let busy = $state(false);
	let errorMsg = $state('');

	const list = $derived(
		categories.filter((c) => c.type === tab).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
	);

	const subsOf = (catId: number) =>
		subcategories.filter((s) => s.category_id === catId).sort((a, b) => a.name.localeCompare(b.name, 'es'));

	$effect(() => {
		if (open) {
			errorMsg = '';
			editing = null;
			pendingDelete = null;
			expandedId = null;
		}
	});

	async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
		if (!supabase) return false;
		busy = true;
		errorMsg = '';
		const { error } = await action();
		busy = false;
		if (error) {
			errorMsg = /monthly_budget/i.test(error.message)
				? 'Para presupuestos por subcategoría ejecuta la migración 027_subcategory_budget.sql en Supabase.'
				: error.message;
			return false;
		}
		onchanged();
		return true;
	}

	async function addCategory() {
		const name = newName.trim();
		if (!name) return;
		const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));
		const ok = await run(() =>
			supabase!.from('finance_categories').insert({ board_id: boardId, name, type: tab, icon: newIcon, sort_order: maxOrder + 1 })
		);
		if (ok) newName = '';
	}

	async function addSubcategory(catId: number) {
		const name = newSubName.trim();
		if (!name) return;
		const row: Record<string, unknown> = { category_id: catId, name };
		if (newSubBudget) row.monthly_budget = Number(newSubBudget);
		const ok = await run(() => supabase!.from('finance_subcategories').insert(row));
		if (ok) {
			newSubName = '';
			newSubBudget = '';
		}
	}

	function toggleExpand(catId: number) {
		expandedId = expandedId === catId ? null : catId;
		newSubName = '';
		newSubBudget = '';
		editing = null;
		pendingDelete = null;
	}

	function startEdit(kind: 'cat' | 'sub', id: number, name: string, icon = '', budget: number | null = null) {
		editing = { kind, id };
		editName = name;
		editIcon = icon || '📦';
		editBudget = budget ? String(Math.round(Number(budget))) : '';
		pendingDelete = null;
	}

	async function saveEdit() {
		if (!editing || !editName.trim()) return;
		const { kind, id } = editing;
		const ok = await run(() =>
			kind === 'cat'
				? supabase!.from('finance_categories').update({ name: editName.trim(), icon: editIcon }).eq('id', id)
				: supabase!
						.from('finance_subcategories')
						.update({ name: editName.trim(), monthly_budget: editBudget ? Number(editBudget) : null })
						.eq('id', id)
		);
		if (ok) editing = null;
	}

	async function remove(kind: 'cat' | 'sub', id: number) {
		const key = `${kind}:${id}`;
		if (pendingDelete !== key) {
			pendingDelete = key;
			return;
		}
		await run(() =>
			supabase!.from(kind === 'cat' ? 'finance_categories' : 'finance_subcategories').delete().eq('id', id)
		);
		pendingDelete = null;
	}

	function budgetInput(e: Event, set: (v: string) => void) {
		const el = e.currentTarget as HTMLInputElement;
		const d = digitsOnly(el.value);
		el.value = d ? formatDigits(d) : '';
		set(d);
	}

	const isEditing = (kind: 'cat' | 'sub', id: number) => editing?.kind === kind && editing.id === id;
</script>

{#snippet deleteButton(kind: 'cat' | 'sub', id: number, label: string)}
	{@const armed = pendingDelete === `${kind}:${id}`}
	<button
		onclick={() => remove(kind, id)}
		disabled={busy}
		class="px-2 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 {armed ? 'bg-red-500 text-white' : 'text-brand-text-muted hover:text-red-400'}"
		aria-label="Eliminar {label}"
	>
		<Trash2 class="w-4 h-4" />{armed ? '¿Eliminar?' : ''}
	</button>
{/snippet}

{#snippet editRow(withEmojis: boolean, withBudget = false)}
	{#if withEmojis}
		<div class="flex flex-wrap gap-1 mb-2">
			{#each EMOJIS as e}
				<button class="w-8 h-8 rounded-lg text-lg {editIcon === e ? 'bg-brand-surface-elevated' : ''}" onclick={() => (editIcon = e)}>{e}</button>
			{/each}
		</div>
	{/if}
	<div class="flex gap-2">
		<input
			bind:value={editName}
			maxlength={24}
			onkeydown={(e) => e.key === 'Enter' && saveEdit()}
			class="flex-1 min-w-0 bg-brand-surface rounded-lg px-3 py-2 text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
		/>
		<button onclick={saveEdit} disabled={busy} class="px-3 rounded-lg bg-brand-accent text-brand-bg" aria-label="Guardar"><Check class="w-4 h-4" /></button>
		<button onclick={() => (editing = null)} class="px-3 rounded-lg bg-brand-surface text-brand-text-muted" aria-label="Cancelar"><X class="w-4 h-4" /></button>
	</div>
	{#if withBudget}
		<label class="flex items-center gap-2 mt-2 bg-brand-surface rounded-lg px-3 text-xs">
			<span class="text-brand-text-muted shrink-0">Presupuesto mensual $</span>
			<input
				type="text"
				inputmode="numeric"
				value={editBudget ? formatDigits(editBudget) : ''}
				oninput={(e) => budgetInput(e, (v) => (editBudget = v))}
				onkeydown={(e) => e.key === 'Enter' && saveEdit()}
				placeholder="Opcional"
				class="flex-1 min-w-0 bg-transparent py-2 text-sm text-brand-text placeholder-brand-text-muted/50 focus:outline-none tabular-nums"
			/>
		</label>
	{/if}
{/snippet}

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

			<div class="grid grid-cols-3 bg-brand-bg rounded-xl p-1 mb-4">
				<button class="py-2 rounded-lg text-sm font-bold {tab === 'expense' ? 'bg-red-500 text-white' : 'text-brand-text-muted'}" onclick={() => (tab = 'expense')}>Gastos</button>
				<button class="py-2 rounded-lg text-sm font-bold {tab === 'income' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted'}" onclick={() => (tab = 'income')}>Ingresos</button>
				<button class="py-2 rounded-lg text-sm font-bold {tab === 'saving' ? 'bg-[#3987e5] text-white' : 'text-brand-text-muted'}" onclick={() => (tab = 'saving')}>Ahorros</button>
			</div>

			<p class="text-xs text-brand-text-muted mb-3">Toca una categoría para ver y agregar sus subcategorías (ej. Servicios → Agua, Luz). A cada subcategoría le puedes poner un presupuesto mensual opcional.</p>

			<ul class="space-y-2 mb-5">
				{#each list as cat (cat.id)}
					{@const subs = subsOf(cat.id)}
					{@const expanded = expandedId === cat.id}
					<li class="rounded-xl bg-brand-bg px-3 py-2">
						{#if isEditing('cat', cat.id)}
							{@render editRow(true)}
						{:else}
							<div class="flex items-center gap-2">
								<button class="flex-1 flex items-center gap-3 text-left min-w-0 py-1" onclick={() => toggleExpand(cat.id)} aria-expanded={expanded}>
									<span class="text-xl">{cat.icon || '•'}</span>
									<span class="text-brand-text truncate">{cat.name}</span>
									{#if subs.length > 0}
										<span class="text-[11px] text-brand-text-muted shrink-0">{subs.length}</span>
									{/if}
									<ChevronDown class="w-4 h-4 text-brand-text-muted shrink-0 transition-transform {expanded ? 'rotate-180' : ''}" />
								</button>
								<button onclick={() => startEdit('cat', cat.id, cat.name, cat.icon ?? '')} class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text" aria-label="Editar {cat.name}">
									<Pencil class="w-4 h-4" />
								</button>
								{@render deleteButton('cat', cat.id, cat.name)}
							</div>
						{/if}

						{#if expanded}
							<ul class="mt-2 ml-4 pl-3 border-l border-brand-divider space-y-1">
								{#each subs as sub (sub.id)}
									<li class="py-1">
										{#if isEditing('sub', sub.id)}
											{@render editRow(false, true)}
										{:else}
											<div class="flex items-center gap-2">
												<CornerDownRight class="w-3.5 h-3.5 text-brand-text-muted shrink-0" />
												<button class="flex-1 min-w-0 flex items-center gap-2 text-left text-sm" onclick={() => startEdit('sub', sub.id, sub.name, '', sub.monthly_budget ?? null)}>
													<span class="text-brand-text truncate">{sub.name}</span>
													{#if sub.monthly_budget}
														<span class="text-[11px] text-brand-text-muted shrink-0 tabular-nums">· {formatCOP(sub.monthly_budget)}/mes</span>
													{/if}
												</button>
												{@render deleteButton('sub', sub.id, sub.name)}
											</div>
										{/if}
									</li>
								{/each}
								<li class="pt-1 space-y-2">
									<div class="flex gap-2">
										<input
											bind:value={newSubName}
											maxlength={24}
											placeholder="Nueva subcategoría"
											onkeydown={(e) => e.key === 'Enter' && addSubcategory(cat.id)}
											class="flex-1 min-w-0 bg-brand-surface rounded-lg px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
										/>
										<button
											onclick={() => addSubcategory(cat.id)}
											disabled={busy || !newSubName.trim()}
											class="px-3 rounded-lg bg-brand-accent text-brand-bg disabled:opacity-50"
											aria-label="Agregar subcategoría"
										>
											<Plus class="w-4 h-4" />
										</button>
									</div>
									{#if newSubName.trim()}
										<label class="flex items-center gap-2 bg-brand-surface rounded-lg px-3 text-xs">
											<span class="text-brand-text-muted shrink-0">Presupuesto mensual $</span>
											<input
												type="text"
												inputmode="numeric"
												value={newSubBudget ? formatDigits(newSubBudget) : ''}
												oninput={(e) => budgetInput(e, (v) => (newSubBudget = v))}
												onkeydown={(e) => e.key === 'Enter' && addSubcategory(cat.id)}
												placeholder="Opcional"
												class="flex-1 min-w-0 bg-transparent py-2 text-sm text-brand-text placeholder-brand-text-muted/50 focus:outline-none tabular-nums"
											/>
										</label>
									{/if}
								</li>
							</ul>
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
					onkeydown={(e) => e.key === 'Enter' && addCategory()}
					class="flex-1 min-w-0 bg-brand-bg rounded-xl px-4 py-3 text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
				/>
				<button onclick={addCategory} disabled={busy || !newName.trim()} class="px-4 rounded-xl bg-brand-accent text-brand-bg font-bold disabled:opacity-50 flex items-center gap-1">
					<Plus class="w-4 h-4" /> Agregar
				</button>
			</div>
			<p class="text-xs text-brand-text-muted mt-3">Al eliminar una categoría se eliminan sus subcategorías, y sus movimientos quedan como “Sin categoría”.</p>

			{#if errorMsg}<p class="text-sm text-red-400 mt-3">{errorMsg}</p>{/if}
		</div>
	</div>
{/if}
