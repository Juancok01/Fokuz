<script lang="ts">
	import { financeData } from '$lib/finanzas.svelte';
	import { clampPct, formatCOP, pct } from '$lib/finanzas';

	const loans = $derived(financeData.goals.filter((goal) => goal.type === 'loan'));
	const outstanding = $derived(
		loans.reduce((sum, goal) => sum + Math.max(0, goal.target_amount - goal.current_amount), 0)
	);
</script>

<section class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 md:p-5 shadow-sm">
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<h2 class="text-[11px] font-black uppercase tracking-[0.18em] text-brand-text">Préstamos x cobrar</h2>
			<p class="text-[10px] text-brand-text-muted font-medium mt-1">{loans.length} deudores</p>
		</div>
	</div>

	<div class="space-y-4">
		{#each loans as loan}
			{@const remaining = Math.max(0, loan.target_amount - loan.current_amount)}
			{@const progress = clampPct(pct(loan.current_amount, loan.target_amount))}
			<div>
				<div class="flex items-start justify-between gap-3 mb-1.5">
					<div class="min-w-0">
						<p class="text-xs font-bold text-brand-text">{loan.name}</p>
						{#if loan.subtitle}
							<p class="text-[10px] text-brand-text-muted mt-0.5">{loan.subtitle}</p>
						{/if}
					</div>
					<p class="text-xs font-black text-brand-text tabular-nums shrink-0">{formatCOP(remaining)}</p>
				</div>
				<div class="h-1 w-full rounded-full bg-white/5 overflow-hidden">
					<div class="h-full rounded-full bg-brand-accent" style="width: {progress}%"></div>
				</div>
				<p class="text-[9px] font-bold text-brand-text-muted mt-1">
					Recuperado {formatCOP(loan.current_amount)} de {formatCOP(loan.target_amount)}
				</p>
			</div>
		{/each}
	</div>

	<div class="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
		<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Total por cobrar</p>
		<p class="text-sm font-black text-brand-text tabular-nums">{formatCOP(outstanding)}</p>
	</div>
</section>
