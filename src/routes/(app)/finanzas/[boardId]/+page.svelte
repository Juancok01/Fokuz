<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Plus,
		Minus,
		Pencil,
		Tags,
		Trash2,
		LogOut,
		Users,
		MoreVertical
	} from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import QuickEntrySheet from '$lib/components/finanzas/QuickEntrySheet.svelte';
	import CategoriesSheet from '$lib/components/finanzas/CategoriesSheet.svelte';
	import BoardFormSheet from '$lib/components/finanzas/BoardFormSheet.svelte';
	import {
		MONTHS,
		PAYMENT_METHODS,
		dayLabel,
		formatCOP,
		monthStartISO,
		type BoardMember,
		type FinanceCategory,
		type FinanceTransaction,
		type TxType
	} from '$lib/finance';

	type Board = {
		id: number;
		title: string;
		description: string | null;
		color: string;
		initial_balance: number;
		user_id: string;
	};

	const boardId = $derived(Number(page.params.boardId));

	let board = $state<Board | null>(null);
	let categories = $state<FinanceCategory[]>([]);
	let transactions = $state<FinanceTransaction[]>([]);
	let members = $state<BoardMember[]>([]);
	let myId = $state<string | null>(null);
	let loading = $state(true);
	let loadError = $state('');

	const now = new Date();
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth());
	let filter = $state<'all' | TxType>('all');

	// Hojas / modales
	let entryOpen = $state(false);
	let entryType = $state<TxType>('expense');
	let editingTx = $state<FinanceTransaction | null>(null);
	let categoriesOpen = $state(false);
	let boardFormOpen = $state(false);
	let menuOpen = $state(false);
	let confirmDeleteBoard = $state(false);
	let confirmLeave = $state(false);

	const isOwner = $derived(!!board && board.user_id === myId);
	const isShared = $derived(members.length > 1);
	const catMap = $derived(new Map(categories.map((c) => [c.id, c])));
	const memberMap = $derived(new Map(members.map((m) => [m.user_id, m])));
	const methodMap = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));

	const balance = $derived(
		Number(board?.initial_balance ?? 0) +
			transactions.reduce((sum, t) => sum + (t.type === 'income' ? 1 : -1) * Number(t.amount), 0)
	);

	const monthStart = $derived(monthStartISO(year, month));
	const nextMonthStart = $derived(monthStartISO(year, month + 1));
	const monthTx = $derived(transactions.filter((t) => t.date >= monthStart && t.date < nextMonthStart));
	const monthIncome = $derived(monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0));
	const monthExpense = $derived(monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0));

	// Gasto por categoría del mes (top 5)
	const expenseByCategory = $derived.by(() => {
		const totals = new Map<number | null, number>();
		for (const t of monthTx) {
			if (t.type !== 'expense') continue;
			totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + Number(t.amount));
		}
		return [...totals.entries()]
			.map(([id, total]) => ({ cat: id !== null ? catMap.get(id) : undefined, total }))
			.sort((a, b) => b.total - a.total)
			.slice(0, 5);
	});

	// Movimientos agrupados por día
	const groups = $derived.by(() => {
		const list = filter === 'all' ? monthTx : monthTx.filter((t) => t.type === filter);
		const byDay = new Map<string, FinanceTransaction[]>();
		for (const t of list) {
			if (!byDay.has(t.date)) byDay.set(t.date, []);
			byDay.get(t.date)!.push(t);
		}
		return [...byDay.entries()].map(([date, items]) => ({
			date,
			items,
			net: items.reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * Number(t.amount), 0)
		}));
	});

	// Frecuencia de uso por categoría (para ordenar los chips del registro rápido)
	const usage = $derived.by(() => {
		const counts: Record<number, number> = {};
		for (const t of transactions.slice(0, 300)) {
			if (t.category_id) counts[t.category_id] = (counts[t.category_id] ?? 0) + 1;
		}
		return counts;
	});

	$effect(() => {
		if (boardId) loadAll(boardId);
	});

	async function loadAll(id: number) {
		if (!supabase) return;
		loading = true;
		loadError = '';
		const {
			data: { session }
		} = await supabase.auth.getSession();
		myId = session?.user?.id ?? null;

		const { data: boardData, error } = await supabase
			.from('finance_boards')
			.select('id, title, description, color, initial_balance, user_id')
			.eq('id', id)
			.maybeSingle();

		if (error || !boardData) {
			loadError = error
				? /color|initial_balance/i.test(error.message)
					? 'Falta ejecutar la migración 024_finance_boards_v2.sql en Supabase.'
					: error.message
				: 'Este tablero no existe o no tienes acceso.';
			board = null;
			loading = false;
			return;
		}
		board = boardData as Board;
		await Promise.all([loadCategories(), loadTransactions(), loadMembers()]);
		loading = false;
	}

	async function loadCategories() {
		if (!supabase) return;
		const { data } = await supabase
			.from('finance_categories')
			.select('id, board_id, name, type, color, icon, sort_order')
			.eq('board_id', boardId)
			.order('sort_order');
		categories = (data ?? []) as FinanceCategory[];
	}

	async function loadTransactions() {
		if (!supabase) return;
		const { data, error } = await supabase
			.from('finance_transactions')
			.select('id, board_id, category_id, amount, type, description, date, payment_method, created_by, created_at')
			.eq('board_id', boardId)
			.order('date', { ascending: false })
			.order('created_at', { ascending: false });
		if (error) loadError = error.message;
		transactions = (data ?? []) as FinanceTransaction[];
	}

	async function loadMembers() {
		if (!supabase) return;
		const { data } = await supabase.rpc('finance_board_members', { p_board_id: boardId });
		members = (data ?? []) as BoardMember[];
	}

	function shiftMonth(delta: number) {
		const d = new Date(year, month + delta, 1);
		year = d.getFullYear();
		month = d.getMonth();
	}

	function openNew(type: TxType) {
		editingTx = null;
		entryType = type;
		entryOpen = true;
	}

	function openEdit(tx: FinanceTransaction) {
		editingTx = tx;
		entryOpen = true;
	}

	async function onEntrySaved(date: string | null) {
		entryOpen = false;
		editingTx = null;
		await loadTransactions();
		// si se registró en otro mes (ej. "Ayer" siendo día 1), saltar a ese mes
		if (date && !(date >= monthStart && date < nextMonthStart)) {
			const [y, m] = date.split('-').map(Number);
			year = y;
			month = m - 1;
		}
	}

	function txSubtitle(tx: FinanceTransaction) {
		const parts: string[] = [];
		const cat = tx.category_id ? catMap.get(tx.category_id) : undefined;
		if (tx.description && cat) parts.push(cat.name);
		const pm = tx.payment_method ? methodMap.get(tx.payment_method) : undefined;
		if (pm) parts.push(`${pm.icon} ${pm.label}`);
		const who = isShared && tx.created_by ? memberMap.get(tx.created_by) : undefined;
		if (who) parts.push(who.user_id === myId ? 'Tú' : who.display_name);
		return parts.join(' · ');
	}

	async function deleteBoard() {
		confirmDeleteBoard = false;
		if (!supabase || !board) return;
		const { error } = await supabase.from('finance_boards').delete().eq('id', board.id);
		if (error) {
			loadError = error.message;
			return;
		}
		goto('/finanzas');
	}

	async function leaveBoard() {
		confirmLeave = false;
		if (!supabase || !board || !myId) return;
		const { error } = await supabase
			.from('finance_board_shares')
			.delete()
			.eq('board_id', board.id)
			.eq('shared_with', myId);
		if (error) {
			loadError = error.message;
			return;
		}
		goto('/finanzas');
	}
</script>

<svelte:head>
	<title>{board?.title ?? 'Tablero'} · Finanzas · Fokuz</title>
</svelte:head>

<header class="flex items-center gap-2 px-3 sm:px-6 py-4 bg-brand-surface rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<a href="/finanzas" class="p-2 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated" aria-label="Volver a tableros">
		<ArrowLeft class="w-5 h-5" />
	</a>
	<div class="flex-1 min-w-0 flex items-center gap-2">
		{#if board}
			<span class="w-3 h-3 rounded-full shrink-0" style="background-color: {board.color}"></span>
			<h1 class="text-lg font-bold text-brand-text truncate">{board.title}</h1>
			{#if isShared}
				<span class="flex items-center gap-1 text-[11px] text-brand-text-muted shrink-0"><Users class="w-3.5 h-3.5" />{members.length}</span>
			{/if}
		{/if}
	</div>
	{#if board}
		<div class="hidden sm:flex items-center gap-2">
			<button onclick={() => openNew('income')} class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-accent/15 text-brand-accent font-bold text-sm hover:bg-brand-accent/25">
				<Plus class="w-4 h-4" /> Ingreso
			</button>
			<button onclick={() => openNew('expense')} class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 text-red-400 font-bold text-sm hover:bg-red-500/25">
				<Minus class="w-4 h-4" /> Gasto
			</button>
		</div>
		<div class="relative">
			<button onclick={() => (menuOpen = !menuOpen)} class="p-2 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated" aria-label="Opciones del tablero">
				<MoreVertical class="w-5 h-5" />
			</button>
			{#if menuOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="fixed inset-0 z-20" onclick={() => (menuOpen = false)}></div>
				<div class="absolute right-0 mt-1 w-52 z-30 bg-brand-surface border border-brand-divider rounded-xl shadow-2xl py-1 text-sm">
					<button class="w-full flex items-center gap-3 px-4 py-3 text-brand-text hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; categoriesOpen = true; }}>
						<Tags class="w-4 h-4 text-brand-accent" /> Categorías
					</button>
					{#if isOwner}
						<button class="w-full flex items-center gap-3 px-4 py-3 text-brand-text hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; boardFormOpen = true; }}>
							<Pencil class="w-4 h-4 text-brand-accent" /> Editar y compartir
						</button>
						<button class="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; confirmDeleteBoard = true; }}>
							<Trash2 class="w-4 h-4" /> Eliminar tablero
						</button>
					{:else}
						<button class="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; confirmLeave = true; }}>
							<LogOut class="w-4 h-4" /> Salir del tablero
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</header>

<div class="flex-1 px-4 sm:px-6 py-5 pb-32 w-full max-w-3xl mx-auto space-y-5">
	{#if loading}
		<div class="h-40 rounded-2xl bg-brand-surface skeleton"></div>
		<div class="h-16 rounded-2xl bg-brand-surface skeleton"></div>
		<div class="h-16 rounded-2xl bg-brand-surface skeleton"></div>
	{:else if loadError && !board}
		<div class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
			{loadError}
			<a href="/finanzas" class="block mt-2 font-bold underline">Volver a mis tableros</a>
		</div>
	{:else if board}
		{#if loadError}
			<p class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-2xl p-3">{loadError}</p>
		{/if}

		<!-- Saldo + mes -->
		<section class="relative rounded-2xl border border-brand-divider bg-brand-surface p-5 overflow-hidden">
			<div class="absolute -top-20 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20" style="background-color: {board.color}"></div>
			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Saldo actual</p>
			<p class="text-4xl font-black tabular-nums mt-1 {balance < 0 ? 'text-red-400' : 'text-brand-text'}">{formatCOP(balance)}</p>

			<div class="flex items-center justify-between mt-5 mb-3">
				<button onclick={() => shiftMonth(-1)} class="p-1.5 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-bg" aria-label="Mes anterior">
					<ChevronLeft class="w-5 h-5" />
				</button>
				<p class="text-sm font-bold text-brand-text">{MONTHS[month]} {year}</p>
				<button onclick={() => shiftMonth(1)} class="p-1.5 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-bg" aria-label="Mes siguiente">
					<ChevronRight class="w-5 h-5" />
				</button>
			</div>
			<div class="grid grid-cols-3 gap-2 text-center">
				<div class="rounded-xl bg-brand-bg py-3 px-1">
					<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Ingresos</p>
					<p class="text-sm sm:text-base font-black text-brand-accent tabular-nums mt-0.5">{formatCOP(monthIncome)}</p>
				</div>
				<div class="rounded-xl bg-brand-bg py-3 px-1">
					<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Gastos</p>
					<p class="text-sm sm:text-base font-black text-red-400 tabular-nums mt-0.5">{formatCOP(monthExpense)}</p>
				</div>
				<div class="rounded-xl bg-brand-bg py-3 px-1">
					<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Diferencia</p>
					<p class="text-sm sm:text-base font-black tabular-nums mt-0.5 {monthIncome - monthExpense < 0 ? 'text-red-400' : 'text-brand-text'}">
						{formatCOP(monthIncome - monthExpense)}
					</p>
				</div>
			</div>
		</section>

		<!-- En qué se fue el dinero -->
		{#if expenseByCategory.length > 0}
			<section class="rounded-2xl border border-brand-divider bg-brand-surface p-4">
				<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-3">¿En qué se fue?</p>
				<ul class="space-y-2.5">
					{#each expenseByCategory as row}
						{@const share = monthExpense > 0 ? (row.total / monthExpense) * 100 : 0}
						<li>
							<div class="flex items-center justify-between text-sm mb-1">
								<span class="text-brand-text truncate">{row.cat?.icon ?? '•'} {row.cat?.name ?? 'Sin categoría'}</span>
								<span class="text-brand-text tabular-nums font-semibold shrink-0 ml-2">
									{formatCOP(row.total)} <span class="text-brand-text-muted text-xs font-normal">{Math.round(share)}%</span>
								</span>
							</div>
							<div class="h-1.5 rounded-full bg-brand-bg overflow-hidden">
								<div class="h-full rounded-full bg-red-400/80" style="width: {share}%"></div>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Filtro -->
		<div class="flex items-center justify-between">
			<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Movimientos</p>
			<div class="flex bg-brand-surface border border-brand-divider rounded-full p-1 text-xs font-bold">
				{#each [{ id: 'all', label: 'Todos' }, { id: 'expense', label: 'Gastos' }, { id: 'income', label: 'Ingresos' }] as f}
					<button
						onclick={() => (filter = f.id as typeof filter)}
						class="px-3 py-1.5 rounded-full {filter === f.id ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted'}"
					>{f.label}</button>
				{/each}
			</div>
		</div>

		<!-- Lista por día -->
		{#if groups.length === 0}
			<div class="rounded-2xl border border-dashed border-brand-divider bg-brand-surface px-6 py-10 text-center">
				<p class="text-brand-text font-semibold mb-1">Sin movimientos en {MONTHS[month].toLowerCase()}</p>
				<p class="text-sm text-brand-text-muted">Toca <span class="font-bold text-brand-accent">+</span> para registrar tu primer gasto o ingreso.</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each groups as group (group.date)}
					<section>
						<div class="flex items-center justify-between px-1 mb-1.5">
							<p class="text-xs font-bold text-brand-text-muted">{dayLabel(group.date)}</p>
							<p class="text-xs font-semibold tabular-nums {group.net < 0 ? 'text-red-400/80' : 'text-brand-accent/80'}">
								{group.net > 0 ? '+' : ''}{formatCOP(group.net)}
							</p>
						</div>
						<ul class="rounded-2xl border border-brand-divider bg-brand-surface divide-y divide-brand-divider/50 overflow-hidden">
							{#each group.items as tx (tx.id)}
								{@const cat = tx.category_id ? catMap.get(tx.category_id) : undefined}
								<li>
									<button onclick={() => openEdit(tx)} class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-surface-elevated/40 active:bg-brand-surface-elevated/60">
										<span class="w-10 h-10 rounded-xl bg-brand-bg flex items-center justify-center text-lg shrink-0">{cat?.icon ?? (tx.type === 'income' ? '📥' : '•')}</span>
										<div class="flex-1 min-w-0">
											<p class="text-sm font-semibold text-brand-text truncate">{tx.description || cat?.name || 'Sin categoría'}</p>
											{#if txSubtitle(tx)}
												<p class="text-xs text-brand-text-muted truncate">{txSubtitle(tx)}</p>
											{/if}
										</div>
										<span class="text-sm font-bold tabular-nums shrink-0 {tx.type === 'income' ? 'text-brand-accent' : 'text-brand-text'}">
											{tx.type === 'income' ? '+' : '−'}{formatCOP(tx.amount)}
										</span>
									</button>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</div>

{#if board}
	<!-- Botón flotante (móvil): toque = gasto, el selector de la hoja permite cambiar a ingreso -->
	<button
		type="button"
		onclick={() => openNew('expense')}
		class="sm:hidden fixed right-5 bottom-6 z-30 w-16 h-16 rounded-full bg-brand-accent text-brand-bg shadow-[0_0_24px_var(--color-brand-accent-muted)] flex items-center justify-center active:scale-95 transition-transform"
		aria-label="Registrar movimiento"
	>
		<Plus class="w-8 h-8" />
	</button>

	<QuickEntrySheet
		open={entryOpen}
		boardId={board.id}
		{categories}
		{usage}
		initialType={entryType}
		transaction={editingTx}
		onclose={() => { entryOpen = false; editingTx = null; }}
		onsaved={onEntrySaved}
	/>

	<CategoriesSheet
		open={categoriesOpen}
		boardId={board.id}
		{categories}
		onclose={() => (categoriesOpen = false)}
		onchanged={() => { loadCategories(); loadTransactions(); }}
	/>

	<BoardFormSheet
		open={boardFormOpen}
		{board}
		onclose={() => (boardFormOpen = false)}
		onsaved={() => { boardFormOpen = false; loadAll(board!.id); }}
	/>
{/if}

<ConfirmModal
	isOpen={confirmDeleteBoard}
	title="Eliminar tablero"
	message="Se eliminarán el tablero, sus categorías y todos sus movimientos. Esta acción no se puede deshacer."
	confirmText="Eliminar"
	onConfirm={deleteBoard}
	onCancel={() => (confirmDeleteBoard = false)}
/>

<ConfirmModal
	isOpen={confirmLeave}
	title="Salir del tablero"
	message="Dejarás de ver este tablero. El dueño puede volver a compartirlo contigo."
	confirmText="Salir"
	onConfirm={leaveBoard}
	onCancel={() => (confirmLeave = false)}
/>
