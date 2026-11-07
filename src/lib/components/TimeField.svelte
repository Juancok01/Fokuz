<script lang="ts">
	/**
	 * Selector de hora con menú desplegable en formato 12 h (a. m./p. m.).
	 * El valor enlazado (bind:value) sigue siendo 24 h "HH:MM",
	 * así que la validación y lo que se guarda en Supabase no cambian.
	 */
	import { tick } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';

	type Props = {
		value?: string;
		onchange?: (value: string) => void;
		class?: string;
		label?: string;
		/** Minutos entre cada opción del menú */
		step?: number;
	};

	let {
		value = $bindable('09:00'),
		onchange,
		class: className = '',
		label = 'Hora',
		step = 15
	}: Props = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement>();
	let list = $state<HTMLUListElement>();

	function toHHMM(total: number) {
		const h = Math.floor(total / 60);
		const m = total % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
	}

	function format12(v?: string | null) {
		const match = v?.match(/^(\d{2}):(\d{2})/);
		if (!match) return '--:--';
		const h = Number(match[1]);
		const meridiem = h < 12 ? 'a. m.' : 'p. m.';
		return `${h % 12 || 12}:${match[2]} ${meridiem}`;
	}

	const options = $derived.by(() => {
		const all: string[] = [];
		for (let t = 0; t < 24 * 60; t += step) all.push(toHHMM(t));
		if (value && /^\d{2}:\d{2}$/.test(value) && !all.includes(value)) {
			all.push(value);
			all.sort();
		}
		return all;
	});

	async function toggle() {
		open = !open;
		if (!open) return;
		await tick();
		const selected = list?.querySelector<HTMLElement>('[aria-selected="true"]');
		if (list && selected) {
			list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.clientHeight / 2;
		}
	}

	function choose(v: string) {
		value = v;
		open = false;
		onchange?.(v);
	}

	function onWindowClick(e: MouseEvent) {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}

	function onWindowKey(e: KeyboardEvent) {
		if (open && e.key === 'Escape') open = false;
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKey} />

<div class="relative" bind:this={root}>
	<button
		type="button"
		class="flex items-center justify-between gap-2 text-left {className}"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label="{label}: {format12(value)}"
		onclick={toggle}
	>
		<span class="whitespace-nowrap">{format12(value)}</span>
		<ChevronDown class="w-3.5 h-3.5 shrink-0 opacity-60 transition-transform {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<ul
			bind:this={list}
			role="listbox"
			aria-label={label}
			class="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-lg border border-brand-divider bg-brand-surface py-1 shadow-xl shadow-black/40"
		>
			{#each options as opt (opt)}
				<li role="option" aria-selected={opt === value}>
					<button
						type="button"
						class="w-full px-3 py-1.5 text-left text-sm font-bold tabular-nums whitespace-nowrap transition-colors {opt === value
							? 'bg-brand-accent/15 text-brand-accent'
							: 'text-brand-text hover:bg-white/5'}"
						onclick={() => choose(opt)}
					>
						{format12(opt)}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
