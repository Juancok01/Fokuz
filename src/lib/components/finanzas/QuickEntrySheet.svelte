<script lang="ts">
	import { X, Delete, Trash2, CalendarDays } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import {
		PAYMENT_METHODS,
		addDaysISO,
		formatDigits,
		todayISO,
		dayLabel,
		type FinanceCategory,
		type FinanceTransaction,
		type PaymentMethod,
		type TxType
	} from '$lib/finance';

	let {
		open = false,
		boardId,
		categories = [],
		usage = {},
		initialType = 'expense',
		transaction = null,
		onclose,
		onsaved
	}: {
		open: boolean;
		boardId: number;
		categories: FinanceCategory[];
		/** veces que se ha usado cada categoría, para ordenar las más usadas primero */
		usage?: Record<number, number>;
		initialType?: TxType;
		/** si viene, el formulario edita este movimiento */
		transaction?: FinanceTransaction | null;
		onclose: () => void;
		/** recibe la fecha del movimiento guardado (o null si se eliminó) */
		onsaved: (date: string | null) => void;
	} = $props();

	const METHOD_KEY = 'fokuz:last-payment-method';
	const MAX_DIGITS = 12;

	let type = $state<TxType>('expense');
	let digits = $state('');
	let categoryId = $state<number | null>(null);
	let method = $state<PaymentMethod | null>(null);
	let date = $state(todayISO());
	let note = $state('');
	let showDatePicker = $state(false);
	let saving = $state(false);
	let confirmDelete = $state(false);
	let errorMsg = $state('');

	const isEdit = $derived(!!transaction);
	const amount = $derived(Number(digits || 0));
	const today = $derived(todayISO());
	const yesterday = $derived(addDaysISO(todayISO(), -1));

	const visibleCategories = $derived(
		categories
			.filter((c) => c.type === type)
			.sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.sort_order - b.sort_order)
	);

	// Reinicia el formulario cada vez que se abre
	$effect(() => {
		if (!open) return;
		const tx = transaction;
		type = tx?.type ?? initialType;
		digits = tx ? String(Math.round(Number(tx.amount))) : '';
		categoryId = tx?.category_id ?? null;
		date = tx?.date ?? todayISO();
		note = tx?.description ?? '';
		showDatePicker = false;
		confirmDelete = false;
		errorMsg = '';
		saving = false;
		if (tx) {
			method = tx.payment_method;
		} else {
			let last: string | null = null;
			try {
				last = localStorage.getItem(METHOD_KEY);
			} catch {
				/* sin almacenamiento */
			}
			method = PAYMENT_METHODS.some((m) => m.id === last) ? (last as PaymentMethod) : null;
		}
	});

	function setType(next: TxType) {
		if (next === type) return;
		type = next;
		// la categoría seleccionada no aplica al otro tipo
		if (categoryId && !categories.some((c) => c.id === categoryId && c.type === next)) categoryId = null;
	}

	function press(key: string) {
		errorMsg = '';
		if (key === 'back') {
			digits = digits.slice(0, -1);
			return;
		}
		if (key === 'clear') {
			digits = '';
			return;
		}
		const next = (digits + key).replace(/^0+/, '');
		if (next.length <= MAX_DIGITS) digits = next;
	}

	// Teclado físico (escritorio): números, borrar y Enter
	function onKeydown(e: KeyboardEvent) {
		if (!open || saving) return;
		const target = e.target as HTMLElement | null;
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
			if (e.key === 'Escape') (target as HTMLInputElement).blur();
			return;
		}
		if (/^\d$/.test(e.key)) {
			press(e.key);
			e.preventDefault();
		} else if (e.key === 'Backspace') {
			press('back');
			e.preventDefault();
		} else if (e.key === 'Enter' && target?.tagName !== 'BUTTON') {
			save();
			e.preventDefault();
		} else if (e.key === 'Escape') {
			onclose();
		}
	}

	async function save() {
		if (!supabase || saving) return;
		if (amount <= 0) {
			errorMsg = 'Escribe un monto.';
			return;
		}
		saving = true;
		errorMsg = '';

		const payload = {
			board_id: boardId,
			type,
			amount,
			category_id: categoryId,
			payment_method: method,
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
		onsaved(date);
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

	const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'];
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
		onclick={onclose}
	>
		<div
			class="w-full max-w-md bg-brand-surface rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-brand-divider max-h-[95dvh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-label={isEdit ? 'Editar movimiento' : 'Nuevo movimiento'}
		>
			<div class="overflow-y-auto px-5 pt-3 pb-2">
				<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-4 sm:hidden"></div>

				<!-- Tipo + cerrar -->
				<div class="flex items-center gap-3 mb-4">
					<div class="flex-1 grid grid-cols-2 bg-brand-bg rounded-xl p-1">
						<button
							type="button"
							onclick={() => setType('expense')}
							class="py-2.5 rounded-lg text-sm font-bold transition-colors {type === 'expense'
								? 'bg-red-500 text-white'
								: 'text-brand-text-muted'}"
						>
							Gasto
						</button>
						<button
							type="button"
							onclick={() => setType('income')}
							class="py-2.5 rounded-lg text-sm font-bold transition-colors {type === 'income'
								? 'bg-brand-accent text-brand-bg'
								: 'text-brand-text-muted'}"
						>
							Ingreso
						</button>
					</div>
					<button class="p-2.5 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={onclose} aria-label="Cerrar">
						<X class="w-4 h-4" />
					</button>
				</div>

				<!-- Monto -->
				<div class="text-center py-2 mb-3" aria-live="polite">
					<p
						class="font-black tabular-nums leading-none transition-colors {type === 'expense' ? 'text-red-400' : 'text-brand-accent'}
							{digits.length > 9 ? 'text-4xl' : 'text-5xl'}"
					>
						<span class="text-3xl align-top mr-1 opacity-70">{type === 'expense' ? '−' : '+'}$</span>{formatDigits(digits)}
					</p>
				</div>

				<!-- Categorías -->
				{#if visibleCategories.length > 0}
					<div class="grid grid-cols-4 gap-2 mb-3">
						{#each visibleCategories as cat (cat.id)}
							{@const on = categoryId === cat.id}
							<button
								type="button"
								onclick={() => (categoryId = on ? null : cat.id)}
								class="flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1 border transition-colors min-h-16 {on
									? type === 'expense'
										? 'border-red-400 bg-red-500/15'
										: 'border-brand-accent bg-brand-accent/15'
									: 'border-transparent bg-brand-bg'}"
							>
								<span class="text-xl leading-none">{cat.icon || '•'}</span>
								<span class="text-[11px] font-medium text-brand-text truncate w-full text-center">{cat.name}</span>
							</button>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-brand-text-muted text-center mb-3">
						No hay categorías de {type === 'expense' ? 'gasto' : 'ingreso'} en este tablero.
					</p>
				{/if}

				<!-- Fecha + medio de pago -->
				<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-2 -mx-1 px-1">
					<button
						type="button"
						onclick={() => { date = today; showDatePicker = false; }}
						class="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border {date === today ? 'bg-brand-text text-brand-bg border-brand-text' : 'border-brand-divider text-brand-text-muted'}"
					>Hoy</button>
					<button
						type="button"
						onclick={() => { date = yesterday; showDatePicker = false; }}
						class="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border {date === yesterday ? 'bg-brand-text text-brand-bg border-brand-text' : 'border-brand-divider text-brand-text-muted'}"
					>Ayer</button>
					<button
						type="button"
						onclick={() => (showDatePicker = !showDatePicker)}
						class="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border {date !== today && date !== yesterday ? 'bg-brand-text text-brand-bg border-brand-text' : 'border-brand-divider text-brand-text-muted'}"
					>
						<CalendarDays class="w-3.5 h-3.5" />
						{date !== today && date !== yesterday ? dayLabel(date) : 'Otra'}
					</button>
					<span class="shrink-0 w-px bg-brand-divider mx-1"></span>
					{#each PAYMENT_METHODS as m}
						<button
							type="button"
							onclick={() => (method = method === m.id ? null : m.id)}
							class="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border {method === m.id ? 'bg-brand-text text-brand-bg border-brand-text' : 'border-brand-divider text-brand-text-muted'}"
						>{m.icon} {m.label}</button>
					{/each}
				</div>
				{#if showDatePicker}
					<input
						type="date"
						bind:value={date}
						max={today}
						class="w-full bg-brand-bg rounded-xl px-4 py-3 text-brand-text mb-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 [color-scheme:dark]"
					/>
				{/if}

				<!-- Nota -->
				<input
					type="text"
					bind:value={note}
					maxlength={80}
					placeholder="Nota (opcional)"
					enterkeyhint="done"
					class="w-full bg-brand-bg rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-text-muted/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
				/>
			</div>

			<!-- Teclado numérico -->
			<div class="px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-brand-divider/60">
				<div class="grid grid-cols-3 gap-2 mb-2">
					{#each KEYS as key}
						<button
							type="button"
							onclick={() => press(key)}
							oncontextmenu={(e) => { if (key === 'back') { e.preventDefault(); press('clear'); } }}
							class="h-12 rounded-xl bg-brand-bg text-brand-text text-xl font-semibold active:bg-brand-surface-elevated active:scale-95 transition-transform flex items-center justify-center select-none"
							aria-label={key === 'back' ? 'Borrar' : key}
						>
							{#if key === 'back'}<Delete class="w-6 h-6" />{:else}{key}{/if}
						</button>
					{/each}
				</div>

				<div class="flex gap-2">
					{#if isEdit}
						<button
							type="button"
							onclick={remove}
							disabled={saving}
							class="px-4 rounded-xl font-bold text-sm flex items-center gap-1.5 transition-colors {confirmDelete ? 'bg-red-500 text-white' : 'bg-red-500/15 text-red-400'}"
							aria-label="Eliminar movimiento"
						>
							<Trash2 class="w-4 h-4" />
							{confirmDelete ? '¿Seguro?' : ''}
						</button>
					{/if}
					<button
						type="button"
						onclick={save}
						disabled={saving || amount <= 0}
						class="flex-1 py-4 rounded-xl font-bold text-base disabled:opacity-40 transition-colors {type === 'expense'
							? 'bg-red-500 text-white'
							: 'bg-brand-accent text-brand-bg'}"
					>
						{saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : type === 'expense' ? 'Registrar gasto' : 'Registrar ingreso'}
					</button>
				</div>
				{#if errorMsg}
					<p class="text-sm text-red-400 mt-2 text-center">{errorMsg}</p>
				{/if}
			</div>
		</div>
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
