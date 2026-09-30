<script lang="ts">
	import { financeData, financeSummary } from '$lib/finanzas.svelte';
	import { clampPct, formatCOP, pct } from '$lib/finanzas';

	const goals = $derived(financeData.goals.filter((goal) => goal.type === 'saving'));
	const summary = $derived(financeSummary());
	const annualPct = $derived(clampPct(pct(summary.savings, 44_000_000)));
</script>

<section class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 md:p-5 shadow-sm">
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<h2 class="text-[11px] font-black uppercase tracking-[0.18em] text-brand-text">Ahorros Skandia</h2>
			<p class="text-[10px] text-brand-text-muted font-medium mt-1">Ver detalle</p>
		</div>
	</div>

	<div class="space-y-4">
		{#each goals as goal}
			{@const progress = clampPct(pct(goal.current_amount, goal.target_amount))}
			<div>
				<div class="flex items-start justify-between gap-3 mb-1.5">
					<div class="min-w-0">
						<p class="text-xs font-bold text-brand-text">{goal.name}</p>
						{#if goal.subtitle}
							<p class="text-[10px] text-brand-text-muted mt-0.5">{goal.subtitle}</p>
						{/if}
					</div>
					<p class="text-xs font-black text-brand-text tabular-nums shrink-0">{formatCOP(goal.current_amount)}</p>
				</div>
				<div class="h-1 w-full rounded-full bg-white/5 overflow-hidden">
					<div class="h-full rounded-full bg-brand-accent" style="width: {progress}%"></div>
				</div>
				<p class="text-[9px] font-bold text-brand-text-muted mt-1">{progress}% de {formatCOP(goal.target_amount)}</p>
			</div>
		{/each}
	</div>

	<div class="mt-5 pt-4 border-t border-white/5">
		<div class="flex items-center justify-between mb-1.5">
			<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Meta anual 2026</p>
			<p class="text-[10px] font-black text-brand-accent">{annualPct}%</p>
		</div>
		<div class="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
			<div class="h-full rounded-full bg-brand-accent" style="width: {annualPct}%"></div>
		</div>
		<p class="text-[10px] font-bold text-brand-text mt-3">Ahorrado e invertido · {formatCOP(summary.savings)}</p>
	</div>
</section>
