<script lang="ts">
	import { X, PlusCircle, Check, Trash2, ArrowUpRight, ArrowDownLeft, PiggyBank } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import {
		PAYMENT_METHODS,
		addDaysISO,
		dayLabel,
		formatCOP,
		formatDigits,
		todayISO,
		type FinanceCategory,
		type FinanceSubcategory,
		type FinanceTransaction,
		type PaymentMethod,
		type TxType
	} from '$lib/finance';

	let {
		open = false,
		boardId,
		categories = [],
		subcategories = [],
		transactions = [],
		usage = {},
		initialType = 'expense',
		transaction = null,
		onclose,
		onsaved
	}: {
		open: boolean;
		boardId: number;
		categories: FinanceCategory[];
		subcategories?: FinanceSubcategory[];
		/** movimientos del tablero, para mostrar cuánto queda del presupuesto */
		transactions?: FinanceTransaction[];
		/** veces que se ha usado cada categoría, para mostrar primero las más usadas */
		usage?: Record<number, number>;
		initialType?: TxType;
		/** si viene, el modal edita este movimiento */
		transaction?: FinanceTransaction | null;
		onclose: () => void;
		/** fecha del movimiento guardado (null si se eliminó); keepOpen = "guardar y registrar otro" */
		onsaved: (date: string | null, keepOpen?: boolean) => void;
	} = $props();

	const METHOD_KEY = 'fokuz:last-payment-method';
	const MAX_DIGITS = 12;

	const TYPE_TABS = [
		{ id: 'expense' as TxType, label: 'Gasto (−)', icon: ArrowUpRight, active: 'bg-red-500 text-white' },
		{ id: 'income' as TxType, label: 'Ingreso (+)', icon: ArrowDownLeft, active: 'bg-brand-accent text-brand-bg' },
		{ id: 'saving' as TxType, label: 'Ahorro', icon: PiggyBank, active: 'bg-[#3987e5] text-white' }
	];

	let type = $state<TxType>('expense');
	let digits = $state('');
	let categoryId = $state<number | ''>('');
	let subcategoryId = $state<number | ''>('');
	let method = $state<PaymentMethod | ''>('');
	let date = $state(todayISO());
	let note = $state('');
	let saving = $state(false);
	let confirmDelete = $state(false);
	let errorMsg = $state('');
	let amountInput = $state<HTMLInputElement | null>(null);
	let showDatePicker = $state(false);
	let savedFlash = $state('');
	let submitAgain = false;

	const isEdit = $derived(!!transaction);
	const amount = $derived(Number(digits || 0));

	const typeCategories = $derived(
		categories
			.filter((c) => c.type === type)
			.sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.sort_order - b.sort_order)
	);
	const typeSubcategories = $derived(
		categoryId === ''
			? []
			: subcategories
					.filter((s) => s.category_id === categoryId)
					.sort((a, b) => a.name.localeCompare(b.name, 'es'))
	);

	// Presupuesto de la subcategoría elegida en el mes de la fecha del movimiento
	const subBudget = $derived.by(() => {
		if (type !== 'expense' || subcategoryId === '' || !date) return null;
		const sub = subcategories.find((s) => s.id === subcategoryId);
		const limit = Number(sub?.monthly_budget ?? 0);
		if (!sub || limit <= 0) return null;
		const ym = date.slice(0, 7);
		const used = transactions
			.filter(
				(t) =>
					t.type === 'expense' &&
					t.subcategory_id === sub.id &&
					t.date.slice(0, 7) === ym &&
					t.id !== transaction?.id
			)
			.reduce((s, t) => s + Number(t.amount), 0);
		const after = used + amount;
		return { name: sub.name, limit, used, after, left: limit - after };
	});

	const today = todayISO();
	const yesterday = addDaysISO(today, -1);
	const typeLabel = $derived(type === 'expense' ? 'gasto' : type === 'income' ? 'ingreso' : 'ahorro');

	const saveLabel = $derived(
		saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : `Guardar ${typeLabel}`
	);
	const saveClass = $derived(
		type === 'expense' ? 'bg-red-500 text-white' : type === 'saving' ? 'bg-[#3987e5] text-white' : 'bg-brand-accent text-brand-bg'
	);

	// Reinicia el formulario cada vez que se abre
	$effect(() => {
		if (!open) return;
		const tx = transaction;
		type = tx?.type ?? initialType;
		digits = tx ? String(Math.round(Number(tx.amount))) : '';
		categoryId = tx?.category_id ?? '';
		subcategoryId = tx?.subcategory_id ?? '';
		date = tx?.date ?? todayISO();
		note = tx?.description ?? '';
		confirmDelete = false;
		errorMsg = '';
		saving = false;
		savedFlash = '';
		showDatePicker = !!tx && tx.date !== todayISO() && tx.date !== addDaysISO(todayISO(), -1);
		if (tx) {
			method = tx.payment_method ?? '';
		} else {
			let last: string | null = null;
			try {
				last = localStorage.getItem(METHOD_KEY);
			} catch {
				/* sin almacenamiento */
			}
			method = PAYMENT_METHODS.some((m) => m.id === last) ? (last as PaymentMethod) : '';
		}
		// En computador se enfoca el monto para escribir de una vez. En el celular no, para que el
		// teclado no tape las categorías ni el botón de guardar: se toca el monto cuando se quiera.
		if (window.matchMedia('(pointer: fine)').matches) queueMicrotask(() => amountInput?.focus());
	});

	function setType(next: TxType) {
		if (next === type) return;
		type = next;
		if (categoryId !== '' && !categories.some((c) => c.id === categoryId && c.type === next)) {
			categoryId = '';
			subcategoryId = '';
		}
	}

	function onCategoryChange() {
		subcategoryId = '';
	}

	function onAmountInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		digits = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS);
		el.value = digits ? formatDigits(digits) : '';
		errorMsg = '';
	}

	async function save(e?: Event) {
		e?.preventDefault();
		if (!supabase || saving) return;
		if (amount <= 0) {
			errorMsg = 'Escribe un monto.';
			amountInput?.focus();
			return;
		}
		if (!date) {
			errorMsg = 'Elige una fecha.';
			return;
		}
		saving = true;
		errorMsg = '';

		const payload = {
			board_id: boardId,
			type,
			amount,
			category_id: categoryId === '' ? null : categoryId,
			subcategory_id: subcategoryId === '' ? null : subcategoryId,
			payment_method: method === '' ? null : method,
			date,
			description: note.trim() || null
		};

		const { error } = transaction
			? await supabase.from('finance_transactions').update(payload).eq('id', transaction.id)
			: await supabase.from('finance_transactions').insert(payload);

		saving = false;
		if (error) {
			errorMsg = /payment_method|created_by/i.test(error.message)
				? 'Falta ejecutar la migración 024_finance_boards_v2.sql en Supabase.'
				: error.message;
			return;
		}
		try {
			if (method) localStorage.setItem(METHOD_KEY, method);
		} catch {
			/* sin almacenamiento */
		}
		navigator.vibrate?.(15);
		const again = submitAgain && !transaction;
		submitAgain = false;
		onsaved(date, again);
		if (again) {
			// deja tipo, categoría, método y fecha; limpia monto y nota para el siguiente
			savedFlash = `✓ ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} de ${formatCOP(amount)} guardado`;
			digits = '';
			note = '';
			subcategoryId = '';
			if (amountInput) amountInput.value = '';
			amountInput?.focus();
			setTimeout(() => (savedFlash = ''), 2500);
		}
	}

	async function remove() {
		if (!supabase || !transaction) return;
		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}
		saving = true;
		const { error } = await supabase.from('finance_transactions').delete().eq('id', transaction.id);
		saving = false;
		if (error) {
			errorMsg = error.message;
			return;
		}
		onsaved(null);
	}

	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet chip(active: boolean, label: string, onclick: () => void, tone = 'neutral')}
	<button
		type="button"
		{onclick}
		class="shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors active:scale-95
			{active
			? tone === 'expense'
				? 'bg-red-500 text-white border-red-500'
				: tone === 'income'
					? 'bg-brand-accent text-brand-bg border-brand-accent'
					: tone === 'saving'
						? 'bg-[#3987e5] text-white border-[#3987e5]'
						: 'bg-brand-text text-brand-bg border-brand-text'
			: 'bg-brand-bg border-brand-divider text-brand-text'}"
	>{label}</button>
{/snippet}

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
		onclick={onclose}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			onsubmit={save}
			onclick={(e) => e.stopPropagation()}
			class="w-full sm:max-w-lg bg-brand-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-brand-divider max-h-[94dvh] sm:max-h-[90dvh] flex flex-col"
			aria-label={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
		>
			<!-- Encabezado fijo -->
			<div class="shrink-0 px-4 sm:px-6 pt-2 sm:pt-5">
				<div class="w-10 h-1.5 bg-brand-divider rounded-full mx-auto mb-3 sm:hidden"></div>
				<div class="flex items-center gap-3 mb-3 sm:pb-4 sm:mb-4 sm:border-b border-brand-divider/60">
					<span class="hidden sm:flex w-9 h-9 rounded-xl bg-brand-accent/15 text-brand-accent items-center justify-center">
						<PlusCircle class="w-5 h-5" />
					</span>
					<h3 class="flex-1 text-base sm:text-lg font-bold text-brand-text">{isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}</h3>
					<button type="button" class="p-2 -mr-1 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-bg" onclick={onclose} aria-label="Cerrar">
						<X class="w-5 h-5" />
					</button>
				</div>

				<!-- Tipo -->
				<div class="grid grid-cols-3 gap-1 bg-brand-bg rounded-xl p-1 mb-3 sm:mb-5" role="tablist">
					{#each TYPE_TABS as t}
						{@const Icon = t.icon}
						<button
							type="button"
							role="tab"
							aria-selected={type === t.id}
							onclick={() => setType(t.id)}
							class="flex items-center justify-center gap-1.5 py-3 sm:py-2.5 rounded-lg text-sm font-bold transition-colors {type === t.id ? t.active : 'text-brand-text-muted hover:text-brand-text'}"
						>
							<Icon class="w-4 h-4" />
							{t.label}
						</button>
					{/each}
				</div>

				<!-- Monto -->
				<label for="tx-amount" class="hidden sm:block text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Monto del movimiento</label>
				<div class="flex items-center bg-brand-bg border border-brand-divider rounded-xl px-4 mb-3 sm:mb-5 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/20">
					<span class="text-2xl font-bold text-brand-text-muted mr-2">$</span>
					<input
						id="tx-amount"
						bind:this={amountInput}
						type="text"
						inputmode="numeric"
						enterkeyhint="done"
						autocomplete="off"
						value={digits ? formatDigits(digits) : ''}
						oninput={onAmountInput}
						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); amountInput?.blur(); } }}
						placeholder="0"
						aria-label="Monto"
						class="flex-1 min-w-0 bg-transparent py-3 sm:py-4 text-4xl sm:text-3xl font-black tabular-nums placeholder-brand-text-muted/40 focus:outline-none
							{type === 'expense' ? 'text-red-400' : type === 'saving' ? 'text-[#7fb2f0]' : 'text-brand-accent'}"
					/>
					<span class="text-[11px] font-bold px-2 py-1 rounded-md bg-brand-surface border border-brand-divider text-brand-text-muted">COP</span>
				</div>
			</div>

			<!-- Cuerpo desplazable -->
			<div class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 pb-3">
				<!-- ===== Móvil: todo con toques ===== -->
				<div class="sm:hidden space-y-4">
					<div>
						<p class="text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Categoría</p>
						{#if typeCategories.length > 0}
							<div class="grid grid-cols-4 gap-2">
								{#each typeCategories as cat (cat.id)}
									{@const on = categoryId === cat.id}
									<button
										type="button"
										onclick={() => { categoryId = on ? '' : cat.id; subcategoryId = ''; }}
										class="flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 border transition-colors active:scale-95 min-h-[4.25rem] {on
											? type === 'expense'
												? 'border-red-400 bg-red-500/15'
												: type === 'saving'
													? 'border-[#3987e5] bg-[#3987e5]/15'
													: 'border-brand-accent bg-brand-accent/15'
											: 'border-transparent bg-brand-bg'}"
										aria-pressed={on}
									>
										<span class="text-2xl leading-none">{cat.icon || '•'}</span>
										<span class="text-[11px] font-medium text-brand-text leading-tight text-center line-clamp-2 w-full">{cat.name}</span>
									</button>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-brand-text-muted">Aún no hay categorías de {typeLabel}. Créalas desde ⋮ → Categorías.</p>
						{/if}
					</div>

					{#if typeSubcategories.length > 0}
						<div>
							<p class="text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Subcategoría</p>
							<div class="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
								{#each typeSubcategories as sub (sub.id)}
									{@render chip(subcategoryId === sub.id, sub.name, () => (subcategoryId = subcategoryId === sub.id ? '' : sub.id), type)}
								{/each}
							</div>
						</div>
					{/if}

					<div>
						<p class="text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Fecha</p>
						<div class="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
							{@render chip(date === today && !showDatePicker, 'Hoy', () => { date = today; showDatePicker = false; })}
							{@render chip(date === yesterday && !showDatePicker, 'Ayer', () => { date = yesterday; showDatePicker = false; })}
							{@render chip(showDatePicker || (date !== today && date !== yesterday), showDatePicker || (date !== today && date !== yesterday) ? `📅 ${dayLabel(date)}` : '📅 Otra fecha', () => (showDatePicker = true))}
						</div>
						{#if showDatePicker}
							<input
								type="date"
								bind:value={date}
								aria-label="Fecha"
								class="mt-2 w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-base text-brand-text focus:outline-none focus:border-brand-accent [color-scheme:dark]"
							/>
						{/if}
					</div>

					<div>
						<p class="text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Método de pago</p>
						<div class="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
							{#each PAYMENT_METHODS as m}
								{@render chip(method === m.id, `${m.icon} ${m.label}`, () => (method = method === m.id ? '' : m.id))}
							{/each}
						</div>
					</div>

					<input
						type="text"
						bind:value={note}
						maxlength={80}
						enterkeyhint="done"
						placeholder="Concepto o nota (opcional)"
						aria-label="Concepto o nota"
						class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-base text-brand-text placeholder-brand-text-muted/50 focus:outline-none focus:border-brand-accent"
					/>
				</div>

				<!-- ===== Escritorio: formulario ===== -->
				<div class="hidden sm:grid grid-cols-2 gap-4">
					<div>
						<label for="tx-category" class="block text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Categoría</label>
						<select
							id="tx-category"
							bind:value={categoryId}
							onchange={onCategoryChange}
							class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-accent [color-scheme:dark]"
						>
							<option value="">Sin categoría</option>
							{#each typeCategories as cat (cat.id)}
								<option value={cat.id}>{cat.icon ?? ''} {cat.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="tx-method" class="block text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Método de pago</label>
						<select
							id="tx-method"
							bind:value={method}
							class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-accent [color-scheme:dark]"
						>
							<option value="">Sin especificar</option>
							{#each PAYMENT_METHODS as m}
								<option value={m.id}>{m.icon} {m.label}</option>
							{/each}
						</select>
					</div>

					{#if typeSubcategories.length > 0}
						<div class="col-span-2">
							<label for="tx-subcategory" class="block text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Subcategoría</label>
							<select
								id="tx-subcategory"
								bind:value={subcategoryId}
								class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-accent [color-scheme:dark]"
							>
								<option value="">— Ninguna —</option>
								{#each typeSubcategories as sub (sub.id)}
									<option value={sub.id}>{sub.name}{sub.monthly_budget ? ` · presup. ${formatCOP(sub.monthly_budget)}` : ''}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div>
						<label for="tx-note" class="block text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Concepto / nota</label>
						<input
							id="tx-note"
							type="text"
							bind:value={note}
							maxlength={80}
							placeholder="Ej: Mercado, gasolina, nómina…"
							class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-sm text-brand-text placeholder-brand-text-muted/50 focus:outline-none focus:border-brand-accent"
						/>
					</div>

					<div>
						<label for="tx-date" class="block text-[11px] font-bold text-brand-text-muted tracking-wider uppercase mb-2">Fecha</label>
						<input
							id="tx-date"
							type="date"
							bind:value={date}
							class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-3 text-sm text-brand-text focus:outline-none focus:border-brand-accent [color-scheme:dark]"
						/>
					</div>

					{#if typeCategories.length === 0}
						<p class="col-span-2 text-xs text-brand-text-muted">Aún no hay categorías de {typeLabel}. Créalas desde ⋮ → Categorías.</p>
					{/if}
				</div>

				{#if subBudget}
					<p class="text-xs mt-3 {subBudget.left < 0 ? 'text-red-400' : subBudget.after / subBudget.limit >= 0.85 ? 'text-amber-400' : 'text-brand-text-muted'}">
						{#if subBudget.left >= 0}
							Con este gasto te quedan <b class="tabular-nums">{formatCOP(subBudget.left)}</b> de {formatCOP(subBudget.limit)} en {subBudget.name} este mes.
						{:else}
							⚠ Con este gasto te pasas por <b class="tabular-nums">{formatCOP(-subBudget.left)}</b> del presupuesto de {subBudget.name} ({formatCOP(subBudget.limit)}).
						{/if}
					</p>
				{/if}
			</div>

			<!-- Acciones (siempre visibles, sobre el teclado) -->
			<div class="shrink-0 px-4 sm:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-5 border-t border-brand-divider/60 bg-brand-surface rounded-b-none sm:rounded-b-2xl">
				{#if errorMsg}
					<p class="text-sm text-red-400 mb-2">{errorMsg}</p>
				{:else if savedFlash}
					<p class="text-sm text-brand-accent mb-2" aria-live="polite">{savedFlash}</p>
				{/if}
				<div class="flex items-center gap-2">
					{#if isEdit}
						<button
							type="button"
							onclick={remove}
							disabled={saving}
							class="px-3 py-3.5 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-colors {confirmDelete ? 'bg-red-500 text-white' : 'bg-red-500/15 text-red-400'}"
							aria-label="Eliminar movimiento"
						>
							<Trash2 class="w-4 h-4" />
							{confirmDelete ? '¿Eliminar?' : ''}
						</button>
					{:else}
						<button
							type="submit"
							onclick={() => (submitAgain = true)}
							disabled={saving || amount <= 0}
							class="px-3 py-3.5 rounded-xl font-bold text-sm border border-brand-divider text-brand-text bg-brand-bg disabled:opacity-40 whitespace-nowrap"
							title="Guardar y registrar otro"
						>
							+ Otro
						</button>
					{/if}
					<span class="hidden sm:block flex-1"></span>
					<button type="button" onclick={onclose} class="hidden sm:block px-4 py-3 rounded-xl font-bold text-sm text-brand-text bg-brand-bg border border-brand-divider hover:brightness-125">
						Cancelar
					</button>
					<button
						type="submit"
						onclick={() => (submitAgain = false)}
						disabled={saving || amount <= 0}
						class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3.5 sm:py-3 rounded-xl font-bold text-base sm:text-sm disabled:opacity-40 transition-colors {saveClass}"
					>
						<Check class="w-5 h-5 sm:w-4 sm:h-4" />
						{saveLabel}
					</button>
				</div>
			</div>
		</form>
	</div>
{/if}

<style>
	.no-scrollbar {
		scrollbar-width: none;
	}
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
</style>
