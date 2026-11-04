<script lang="ts">
	import { CHART, formatCOP, type WeekBucket } from '$lib/finance';

	let { weeks = [] }: { weeks: WeekBucket[] } = $props();

	let hovered = $state<number | null>(null);

	const max = $derived(Math.max(1, ...weeks.flatMap((w) => [w.income, w.expense])));
	const empty = $derived(weeks.every((w) => w.income === 0 && w.expense === 0));
	const pct = (v: number) => (v <= 0 ? 0 : Math.max(2, (v / max) * 100));
</script>

<div class="relative">
	<!-- Área de barras -->
	<div class="relative h-48 sm:h-56">
		<!-- líneas guía recesivas -->
		<div class="absolute inset-0 flex flex-col justify-between pointer-events-none" aria-hidden="true">
			{#each [0, 1, 2, 3] as _}
				<div class="border-t border-brand-divider/30"></div>
			{/each}
		</div>

		<div class="relative h-full flex items-end justify-around gap-2">
			{#each weeks as w, i}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="relative flex-1 h-full flex items-end justify-center gap-[2px] cursor-default {w.future ? 'opacity-35' : ''}"
					onmouseenter={() => (hovered = i)}
					onmouseleave={() => (hovered = null)}
					ontouchstart={() => (hovered = hovered === i ? null : i)}
				>
					{#if hovered === i}
						<div class="absolute inset-x-0 -inset-y-1 rounded-lg bg-white/[0.03] pointer-events-none"></div>
					{/if}
					<div
						class="w-[38%] max-w-10 rounded-t-[4px] transition-[height] duration-500"
						style="height: {pct(w.income)}%; background-color: {CHART.income}"
					></div>
					<div
						class="w-[38%] max-w-10 rounded-t-[4px] transition-[height] duration-500"
						style="height: {pct(w.expense)}%; background-color: {CHART.expense}"
					></div>

					{#if hovered === i}
						<div
							class="absolute bottom-full mb-2 z-10 min-w-40 rounded-xl border border-brand-divider bg-brand-bg/95 backdrop-blur px-3 py-2 text-xs shadow-xl pointer-events-none
								{i === 0 ? 'left-0' : i === weeks.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}"
						>
							<p class="font-bold text-brand-text mb-1">{w.label} · días {w.range}</p>
							<p class="flex justify-between gap-3 text-brand-text-muted">
								<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm" style="background-color: {CHART.income}"></span>Ingresos</span>
								<span class="text-brand-text tabular-nums">{formatCOP(w.income)}</span>
							</p>
							<p class="flex justify-between gap-3 text-brand-text-muted">
								<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm" style="background-color: {CHART.expense}"></span>Gastos</span>
								<span class="text-brand-text tabular-nums">{formatCOP(w.expense)}</span>
							</p>
							<p class="flex justify-between gap-3 text-brand-text-muted border-t border-brand-divider/60 mt-1 pt-1">
								<span>Neto</span>
								<span class="text-brand-text font-bold tabular-nums">{formatCOP(w.income - w.expense)}</span>
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if empty}
			<p class="absolute inset-0 flex items-center justify-center text-sm text-brand-text-muted">Sin movimientos este mes</p>
		{/if}
	</div>

	<!-- Eje X -->
	<div class="flex justify-around gap-2 border-t border-brand-divider/60 pt-2">
		{#each weeks as w}
			<p class="flex-1 text-center text-[11px] leading-tight {w.current ? 'text-brand-accent font-bold' : 'text-brand-text-muted'}">
				{w.label}<span class="hidden sm:inline"> ({w.range})</span>
			</p>
		{/each}
	</div>
</div>
