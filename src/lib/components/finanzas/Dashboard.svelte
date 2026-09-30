<script lang="ts">
	import { financeSummary } from '$lib/finanzas.svelte';
	import { formatCOP, pct } from '$lib/finanzas';

	const summary = $derived(financeSummary());
	const juanPct = $derived(pct(summary.juanIncome, summary.totalIncome));
	const paoPct = $derived(pct(summary.paoIncome, summary.totalIncome));
	const jointPct = $derived(pct(summary.jointIncome, summary.totalIncome));
</script>

<section class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 md:p-5 shadow-sm">
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<h2 class="text-[11px] font-black uppercase tracking-[0.18em] text-brand-text">Ingresos del mes</h2>
			<p class="text-[10px] text-brand-text-muted font-medium mt-1">{summary.incomeCount} partidas</p>
		</div>
		<p class="text-sm font-black text-brand-accent tabular-nums">{formatCOP(summary.totalIncome)}</p>
	</div>

	<div class="mb-4">
		<div class="flex justify-between text-[9px] font-bold text-brand-text-muted mb-1.5">
			<span>Contribución</span>
			<span>Juan {juanPct}% · Pao {paoPct}% · {jointPct}%</span>
		</div>
		<div class="h-1.5 w-full rounded-full overflow-hidden bg-[#070b0e] flex">
			<div class="h-full bg-brand-accent" style="width: {juanPct}%"></div>
			<div class="h-full bg-[#2CC295]" style="width: {paoPct}%"></div>
			<div class="h-full bg-white/25" style="width: {jointPct}%"></div>
		</div>
	</div>

	<div class="divide-y divide-white/5">
		{#each summary.incomes as income}
			<div class="flex items-start justify-between gap-3 py-3">
				<div class="min-w-0">
					<p class="text-xs font-bold text-brand-text truncate">{income.note}</p>
					<p class="text-[10px] text-brand-text-muted mt-0.5">
						{income.source === 'Joint' ? 'Conjunto' : income.source} · {income.method}
					</p>
				</div>
				<div class="text-right shrink-0">
					<p class="text-xs font-black text-brand-text tabular-nums">{formatCOP(income.amount)}</p>
					<p class="text-[9px] font-bold text-brand-accent mt-0.5">Depositado</p>
				</div>
			</div>
		{:else}
			<p class="py-8 text-center text-xs text-brand-text-muted">No hay ingresos en este mes.</p>
		{/each}
	</div>

	<div class="flex items-center justify-between pt-3 mt-1 border-t border-white/5">
		<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Total ingresos mensuales</p>
		<p class="text-sm font-black text-brand-text tabular-nums">{formatCOP(summary.totalIncome)}</p>
	</div>
</section>
