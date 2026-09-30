<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { financeData, financeSummary, pocketSpent, togglePaid, visibleTransactions } from '$lib/finanzas.svelte';
	import { clampPct, formatCOP, pct } from '$lib/finanzas';

	let { compact = false }: { compact?: boolean } = $props();
	let openId = $state('hogar');

	const summary = $derived(financeSummary());
	const txs = $derived(visibleTransactions());
	const itemCount = $derived(txs.filter((tx) => tx.type === 'expense').length);
</script>

<section class="bg-[#0d1216] border border-brand-divider rounded-2xl p-4 md:p-5 shadow-sm">
	<div class="flex items-start justify-between gap-3 mb-4">
		<div>
			<h2 class="text-[11px] font-black uppercase tracking-[0.18em] text-brand-text">Bolsillos & gastos</h2>
			<p class="text-[10px] text-brand-text-muted font-medium mt-1">
				Asignación {formatCOP(summary.allocated)}
			</p>
		</div>
		<p class="text-[10px] font-bold text-brand-text-muted">{itemCount} ítems</p>
	</div>

	<div class="space-y-2">
		{#each financeData.pockets as pocket}
			{@const spent = pocketSpent(pocket.id)}
			{@const progress = clampPct(pct(spent, pocket.allocated_budget))}
			{@const items = txs.filter((tx) => tx.type === 'expense' && tx.pocket_id === pocket.id)}
			{@const open = openId === pocket.id}
			<div class="rounded-2xl border border-white/5 bg-[#070b0e] overflow-hidden">
				<button
					type="button"
					class="w-full text-left px-3.5 py-3"
					onclick={() => (openId = open ? '' : pocket.id)}
				>
					<div class="flex items-center justify-between gap-3 mb-2">
						<div class="flex items-center gap-2 min-w-0">
							<span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:{pocket.color_hex}"></span>
							<p class="text-xs font-bold text-brand-text truncate">{pocket.name}</p>
							<p class="text-[10px] text-brand-text-muted">{items.length} partidas</p>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<p class="text-xs font-black text-brand-text tabular-nums">{formatCOP(spent)}</p>
							<ChevronDown class="w-4 h-4 text-brand-text-muted transition-transform {open ? 'rotate-180' : ''}" />
						</div>
					</div>
					<div class="h-1 w-full rounded-full bg-white/5 overflow-hidden">
						<div
							class="h-full rounded-full {progress > 100 ? 'bg-rose-400' : 'bg-brand-accent'}"
							style="width: {Math.min(progress, 100)}%"
						></div>
					</div>
					<p class="text-[9px] font-bold text-brand-text-muted mt-1.5">
						{formatCOP(spent)} de {formatCOP(pocket.allocated_budget)} · {progress}%
					</p>
				</button>

				{#if open}
					<div class="px-3.5 pb-3 space-y-2">
						{#each items as tx}
							<div class="flex items-center justify-between gap-3 py-1.5">
								<label class="flex items-center gap-2 min-w-0 cursor-pointer">
									<input
										type="checkbox"
										checked={tx.paid}
										onchange={() => togglePaid(tx.id)}
										class="size-3.5 rounded border-brand-divider bg-transparent text-brand-accent focus:ring-0"
									/>
									<span class="text-[11px] font-medium {tx.paid ? 'text-brand-text-muted line-through' : 'text-brand-text'} truncate">
										{tx.note}
									</span>
								</label>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="px-1.5 py-0.5 rounded text-[8px] font-bold border {tx.method === 'Digital' ? 'border-brand-accent/30 text-brand-accent' : 'border-amber-400/30 text-amber-300'}">
										{tx.method}
									</span>
									{#if tx.classification !== 'None'}
										<span class="px-1.5 py-0.5 rounded text-[8px] font-bold border {tx.classification === 'Need' ? 'border-white/15 text-brand-text-muted' : 'border-amber-400/30 text-amber-300'}">
											{tx.classification === 'Need' ? 'Need' : 'Want'}
										</span>
									{/if}
									<span class="text-[11px] font-black text-brand-text tabular-nums">{formatCOP(tx.amount)}</span>
								</div>
							</div>
						{:else}
							<p class="text-[11px] text-brand-text-muted py-2">Sin movimientos en este bolsillo.</p>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if !compact}
		<p class="text-[10px] text-brand-text-muted mt-4">
			Presupuesto base cero: cada peso del mes queda asignado a un sobre antes de gastarse.
		</p>
	{/if}
</section>
