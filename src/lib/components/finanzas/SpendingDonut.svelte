<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { formatCOP, type SpendSlice } from '$lib/finance';

	let { slices = [], total = 0 }: { slices: SpendSlice[]; total: number } = $props();

	const SIZE = 168;
	const STROKE = 22;
	const R = (SIZE - STROKE) / 2;
	const C = 2 * Math.PI * R;
	const GAP = 2; // separación de superficie entre segmentos

	let hovered = $state<string | null>(null);
	let expanded = $state<string | null>(null);

	const arcs = $derived.by(() => {
		let offset = 0;
		const gap = slices.length > 1 ? GAP : 0;
		return slices.map((s) => {
			const len = total > 0 ? (s.total / total) * C : 0;
			const arc = { ...s, dash: Math.max(0, len - gap), offset };
			offset += len;
			return arc;
		});
	});

	const pctOf = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
	const focused = $derived(slices.find((s) => s.key === hovered) ?? null);
</script>

{#if total <= 0}
	<div class="h-48 flex items-center justify-center text-sm text-brand-text-muted text-center px-4">
		Aún no hay gastos este mes.
	</div>
{:else}
	<div class="flex justify-center mb-4">
		<div class="relative" style="width: {SIZE}px; height: {SIZE}px">
			<svg viewBox="0 0 {SIZE} {SIZE}" class="-rotate-90" role="img" aria-label="Distribución de gastos por categoría">
				<circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--color-brand-bg)" stroke-width={STROKE} />
				{#each arcs as a (a.key)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<circle
						cx={SIZE / 2}
						cy={SIZE / 2}
						r={R}
						fill="none"
						stroke={a.color}
						stroke-width={hovered === a.key ? STROKE + 4 : STROKE}
						stroke-dasharray="{a.dash} {C - a.dash}"
						stroke-dashoffset={-a.offset}
						class="transition-[stroke-width,opacity] duration-150 cursor-pointer"
						opacity={hovered && hovered !== a.key ? 0.35 : 1}
						onmouseenter={() => (hovered = a.key)}
						onmouseleave={() => (hovered = null)}
					/>
				{/each}
			</svg>
			<div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
				<p class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted leading-tight">
					{focused ? focused.name : 'Total gastos'}
				</p>
				<p class="text-base font-black text-brand-text tabular-nums leading-tight mt-0.5">
					{formatCOP(focused ? focused.total : total)}
				</p>
				{#if focused}
					<p class="text-[11px] text-brand-text-muted">{pctOf(focused.total)}%</p>
				{/if}
			</div>
		</div>
	</div>

	<ul class="space-y-1">
		{#each slices as s (s.key)}
			{@const open = expanded === s.key}
			<li>
				<button
					type="button"
					class="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand-bg/60 {hovered === s.key ? 'bg-brand-bg/60' : ''}"
					onmouseenter={() => (hovered = s.key)}
					onmouseleave={() => (hovered = null)}
					onclick={() => (expanded = open ? null : s.key)}
					aria-expanded={s.subs.length ? open : undefined}
				>
					<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {s.color}"></span>
					<span class="flex-1 min-w-0 truncate text-brand-text">{s.icon} {s.name}</span>
					<span class="font-bold text-brand-text tabular-nums">{pctOf(s.total)}%</span>
					<span class="text-xs text-brand-text-muted tabular-nums w-24 text-right">{formatCOP(s.total)}</span>
					{#if s.subs.length}
						<ChevronDown class="w-3.5 h-3.5 text-brand-text-muted shrink-0 transition-transform {open ? 'rotate-180' : ''}" />
					{:else}
						<span class="w-3.5 shrink-0"></span>
					{/if}
				</button>
				{#if open && s.subs.length}
					<ul class="ml-7 mr-6 mb-1 border-l border-brand-divider pl-3 space-y-0.5">
						{#each s.subs as sub}
							<li class="flex items-center justify-between gap-2 text-xs py-0.5">
								<span class="text-brand-text-muted truncate">{sub.name}</span>
								<span class="text-brand-text tabular-nums shrink-0">
									{formatCOP(sub.total)} <span class="text-brand-text-muted">· {s.total > 0 ? Math.round((sub.total / s.total) * 100) : 0}%</span>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
