<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus } from '@lucide/svelte';
	import Dashboard from '$lib/components/finanzas/Dashboard.svelte';
	import Pockets from '$lib/components/finanzas/Pockets.svelte';
	import Savings from '$lib/components/finanzas/Savings.svelte';
	import Loans from '$lib/components/finanzas/Loans.svelte';
	import FinanceTabs from '$lib/components/finanzas/BottomNav.svelte';
	import TransactionModal from '$lib/components/finanzas/TransactionModal.svelte';
	import Donut from '$lib/components/finanzas/Donut.svelte';
	import { financeSummary, financeUI, openFinanceModal, shiftMonth } from '$lib/finanzas.svelte';
	import { MONTHS_ES, clampPct, formatCOP, pct, type SourceFilter } from '$lib/finanzas';

	const summary = $derived(financeSummary());
	const needPct = $derived(pct(summary.need, summary.totalSpent));
	const wantPct = $derived(pct(summary.want, summary.totalSpent));
	const spentRing = $derived(clampPct(summary.spentPct));
	const savedRing = $derived(clampPct(pct(summary.savings, 44_000_000)));
	const monthLabel = $derived(`${MONTHS_ES[financeUI.month]} ${financeUI.year}`);

	const filters: { id: SourceFilter; label: string }[] = [
		{ id: 'all', label: 'Todos' },
		{ id: 'Juan', label: 'Solo Juan' },
		{ id: 'Pao', label: 'Solo Paola' }
	];
</script>

<svelte:head>
	<title>Finanzas · Fokuz</title>
</svelte:head>

<div class="flex-1 overflow-y-auto px-4 py-5 md:px-6 pb-28 lg:pb-8">
	<header class="flex items-center justify-between mb-5">
		<button
			type="button"
			onclick={() => shiftMonth(-1)}
			class="p-2 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-white/5"
			aria-label="Mes anterior"
		>
			<ChevronLeft class="w-5 h-5" />
		</button>
		<div class="text-center">
			<p class="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-text-muted">Presupuesto base cero</p>
			<h1 class="text-xl font-black text-brand-text">{monthLabel}</h1>
		</div>
		<button
			type="button"
			onclick={() => shiftMonth(1)}
			class="p-2 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-white/5"
			aria-label="Mes siguiente"
		>
			<ChevronRight class="w-5 h-5" />
		</button>
	</header>

	<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
		<article class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-text-muted">Diferencia operativa neta</p>
				<p class="text-2xl font-black text-brand-text tabular-nums mt-2 leading-none">{formatCOP(summary.net)}</p>
				<p class="text-[10px] font-bold text-brand-accent mt-2">+93.06% vs mes anterior</p>
			</div>
			<Donut value={82} />
		</article>
		<article class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 shadow-sm">
			<p class="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-text-muted">Ingresos totales</p>
			<p class="text-2xl font-black text-brand-text tabular-nums mt-2 leading-none">{formatCOP(summary.totalIncome)}</p>
			<p class="text-[10px] text-brand-text-muted mt-2">{summary.incomeCount} partidas</p>
		</article>
		<article class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
			<div>
				<p class="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-text-muted">Total gastado</p>
				<p class="text-2xl font-black text-brand-text tabular-nums mt-2 leading-none">{formatCOP(summary.totalSpent)}</p>
				<p class="text-[10px] text-brand-text-muted mt-2">{spentRing.toFixed(1)}% del ingreso</p>
			</div>
			<Donut value={spentRing} tone="rose" />
		</article>
		<article class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 shadow-sm flex items-start justify-between gap-3">
			<div>
				<p class="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-text-muted">Ahorrado e invertido</p>
				<p class="text-2xl font-black text-brand-text tabular-nums mt-2 leading-none">{formatCOP(summary.savings)}</p>
				<p class="text-[10px] text-brand-text-muted mt-2">{savedRing.toFixed(0)}% meta</p>
			</div>
			<Donut value={savedRing} />
		</article>
	</div>

	<section class="bg-[#0d1216] border border-brand-divider rounded-2xl px-4 py-3 mb-4 shadow-sm">
		<div class="flex flex-col md:flex-row md:items-center gap-3">
			<p class="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-text-muted shrink-0">Distribución de flujo</p>
			<div class="flex-1 h-1.5 rounded-full overflow-hidden bg-[#070b0e] flex">
				<div class="h-full bg-rose-400/80" style="width: {clampPct(summary.spentPct)}%"></div>
				<div class="h-full bg-brand-accent" style="width: {Math.min(48, 100 - clampPct(summary.spentPct))}%"></div>
			</div>
		</div>
		<div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] font-bold text-brand-text-muted">
			<span>Gasto {summary.spentPct.toFixed(2)}%</span>
			<span>Ahorro ~48%</span>
			<span>{summary.incomeCount} fuentes · 100% recaudado</span>
			<span>{summary.spentPct.toFixed(2)}% tasa mensual</span>
			<span class="text-brand-accent">Bajo control</span>
			<span>Skandia {savedRing.toFixed(0)}% meta</span>
		</div>
	</section>

	<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-text-muted mr-1">Acciones rápidas</span>
			<button type="button" onclick={() => openFinanceModal('expense')} class="px-3 py-1.5 rounded-full text-[11px] font-bold text-brand-accent hover:bg-brand-accent/10">
				+ Nuevo gasto
			</button>
			<button type="button" onclick={() => openFinanceModal('saving')} class="px-3 py-1.5 rounded-full text-[11px] font-bold text-brand-accent hover:bg-brand-accent/10">
				+ Aporte ahorro
			</button>
			<button type="button" onclick={() => openFinanceModal('loan')} class="px-3 py-1.5 rounded-full text-[11px] font-bold text-brand-accent hover:bg-brand-accent/10">
				+ Registrar préstamo
			</button>
		</div>
		<div class="flex items-center gap-1 bg-[#0d1216] border border-brand-divider rounded-full p-1 self-start">
			{#each filters as filter}
				<button
					type="button"
					onclick={() => (financeUI.sourceFilter = filter.id)}
					class="px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors {financeUI.sourceFilter === filter.id
						? 'bg-brand-accent text-brand-bg'
						: 'text-brand-text-muted hover:text-brand-text'}"
				>
					{filter.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Escritorio: el layout de la captura. Móvil: una pestaña a la vez. -->
	<div class="hidden lg:grid lg:grid-cols-3 gap-4 items-start">
		<Dashboard />
		<div class="space-y-4">
			<section class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 md:p-5 shadow-sm">
				<div class="flex items-start justify-between gap-3 mb-3">
					<div>
						<h2 class="text-[11px] font-black uppercase tracking-[0.18em] text-brand-text">Control necesidad vs deseo</h2>
						<p class="text-[10px] text-brand-text-muted mt-1">Presupuesto inteligente · regla 50/20/30</p>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3 mb-3">
					<div>
						<p class="text-[9px] font-bold uppercase tracking-wider text-brand-text-muted">Necesidad · {needPct}%</p>
						<p class="text-lg font-black text-brand-text tabular-nums mt-1">{formatCOP(summary.need)}</p>
					</div>
					<div class="text-right">
						<p class="text-[9px] font-bold uppercase tracking-wider text-brand-text-muted">Deseos · {wantPct}%</p>
						<p class="text-lg font-black text-brand-text tabular-nums mt-1">{formatCOP(summary.want)}</p>
					</div>
				</div>
				<div class="h-1.5 w-full rounded-full overflow-hidden bg-[#070b0e] flex">
					<div class="h-full bg-brand-accent" style="width: {clampPct(needPct)}%"></div>
					<div class="h-full bg-amber-400" style="width: {clampPct(wantPct)}%"></div>
				</div>
			</section>
			<Pockets compact />
		</div>
		<div class="space-y-4">
			<Savings />
			<Loans />
		</div>
	</div>

	<div class="lg:hidden space-y-4">
		{#if financeUI.tab === 'dashboard'}
			<section class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 shadow-sm">
				<h2 class="text-[11px] font-black uppercase tracking-[0.18em] text-brand-text mb-3">Necesidad vs deseo</h2>
				<div class="grid grid-cols-2 gap-3 mb-3">
					<div>
						<p class="text-[9px] font-bold text-brand-text-muted">Necesidad · {needPct}%</p>
						<p class="text-base font-black text-brand-text tabular-nums">{formatCOP(summary.need)}</p>
					</div>
					<div class="text-right">
						<p class="text-[9px] font-bold text-brand-text-muted">Deseos · {wantPct}%</p>
						<p class="text-base font-black text-brand-text tabular-nums">{formatCOP(summary.want)}</p>
					</div>
				</div>
				<div class="h-1.5 w-full rounded-full overflow-hidden bg-[#070b0e] flex">
					<div class="h-full bg-brand-accent" style="width: {clampPct(needPct)}%"></div>
					<div class="h-full bg-amber-400" style="width: {clampPct(wantPct)}%"></div>
				</div>
			</section>
			<Dashboard />
		{:else if financeUI.tab === 'pockets'}
			<Pockets />
		{:else if financeUI.tab === 'savings'}
			<Savings />
		{:else}
			<Loans />
		{/if}
	</div>
</div>

<button
	type="button"
	onclick={() => openFinanceModal('expense')}
	class="fixed right-5 bottom-20 lg:bottom-6 z-40 w-14 h-14 rounded-full bg-brand-accent text-brand-bg shadow-[0_0_20px_var(--color-brand-accent-muted)] flex items-center justify-center hover:brightness-110 transition-all"
	aria-label="Registrar gasto"
>
	<Plus class="w-7 h-7" />
</button>

<FinanceTabs />
<TransactionModal />
