<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Plus, Wallet, Users, TrendingUp, TrendingDown, ChevronRight } from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import BoardFormSheet from '$lib/components/finanzas/BoardFormSheet.svelte';
	import { MONTHS, formatCOP, monthStartISO, type FinanceBoard } from '$lib/finance';

	let boards = $state<FinanceBoard[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let showForm = $state(false);

	const now = new Date();
	const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

	async function loadBoards() {
		if (!supabase) {
			loading = false;
			return;
		}
		loading = true;
		loadError = '';
		const { data, error } = await supabase.rpc('finance_boards_overview', {
			p_month_start: monthStartISO(now.getFullYear(), now.getMonth())
		});
		if (error) {
			loadError = /finance_boards_overview/i.test(error.message)
				? 'Falta ejecutar la migración 024_finance_boards_v2.sql en Supabase.'
				: error.message;
			boards = [];
		} else {
			boards = (data ?? []) as FinanceBoard[];
		}
		loading = false;
	}

	onMount(loadBoards);
</script>

<svelte:head>
	<title>Finanzas · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<Wallet class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Finanzas</h1>
	</div>
	<button
		onclick={() => (showForm = true)}
		class="hidden sm:flex items-center gap-2 bg-brand-accent text-brand-bg px-4 py-2 rounded-xl font-bold text-sm hover:brightness-105"
	>
		<Plus class="w-4 h-4" /> Nuevo tablero
	</button>
</header>

<div class="flex-1 px-4 sm:px-6 py-6 pb-28 w-full max-w-3xl mx-auto space-y-5">
	{#if loading}
		<div class="h-28 rounded-2xl bg-brand-surface skeleton"></div>
		<div class="h-24 rounded-2xl bg-brand-surface skeleton"></div>
		<div class="h-24 rounded-2xl bg-brand-surface skeleton"></div>
	{:else if loadError}
		<p class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-2xl p-4">{loadError}</p>
	{:else}

		<p class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Mis tableros</p>

		{#if boards.length === 0}
			<div class="rounded-2xl border border-dashed border-brand-divider bg-brand-surface px-6 py-10 text-center">
				<Wallet class="w-10 h-10 text-brand-accent mx-auto mb-3" />
				<p class="text-brand-text font-semibold mb-1">Crea tu primer tablero</p>
				<p class="text-sm text-brand-text-muted mb-5">
					Cada tablero es una cuenta: personal, hogar, un viaje… Registra ahí tus ingresos y gastos.
				</p>
				<button
					onclick={() => (showForm = true)}
					class="inline-flex items-center gap-2 bg-brand-accent text-brand-bg px-5 py-3 rounded-xl font-bold hover:brightness-105"
				>
					<Plus class="w-5 h-5" /> Nuevo tablero
				</button>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each boards as board (board.id)}
					<li>
						<a
							href="/finanzas/{board.id}"
							class="flex items-center gap-4 rounded-2xl border border-brand-divider bg-brand-surface p-4 hover:bg-brand-surface-elevated/40 transition-colors"
						>
							<div class="w-1.5 self-stretch rounded-full shrink-0" style="background-color: {board.color}"></div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2">
									<p class="font-bold text-brand-text truncate">{board.title}</p>
									{#if !board.is_owner || Number(board.shared_count) > 0}
										<Users class="w-3.5 h-3.5 text-brand-text-muted shrink-0" aria-label="Compartido" />
									{/if}
								</div>
								<p class="text-2xl font-black tabular-nums mt-0.5 {Number(board.balance) < 0 ? 'text-red-400' : 'text-brand-text'}">
									{formatCOP(board.balance)}
								</p>
								<div class="flex items-center gap-3 mt-1 text-xs font-medium">
									<span class="flex items-center gap-1 text-brand-accent">
										<TrendingUp class="w-3.5 h-3.5" /> {formatCOP(board.month_income)}
									</span>
									<span class="flex items-center gap-1 text-red-400">
										<TrendingDown class="w-3.5 h-3.5" /> {formatCOP(board.month_expense)}
									</span>
									<span class="text-brand-text-muted hidden sm:inline">este mes</span>
								</div>
							</div>
							<ChevronRight class="w-5 h-5 text-brand-text-muted shrink-0" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<!-- Botón flotante (móvil) -->
<button
	type="button"
	onclick={() => (showForm = true)}
	class="sm:hidden fixed right-5 bottom-6 z-30 w-14 h-14 rounded-full bg-brand-accent text-brand-bg shadow-[0_0_20px_var(--color-brand-accent-muted)] flex items-center justify-center active:scale-95 transition-transform"
	aria-label="Nuevo tablero"
>
	<Plus class="w-7 h-7" />
</button>

<BoardFormSheet
	open={showForm}
	onclose={() => (showForm = false)}
	onsaved={(id) => {
		showForm = false;
		goto(`/finanzas/${id}`);
	}}
/>
