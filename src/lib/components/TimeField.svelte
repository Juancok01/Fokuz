<script lang="ts">
	/**
	 * Selector de hora con formato 12 h (a. m./p. m.).
	 * El valor enlazado (bind:value) sigue siendo 24 h "HH:MM",
	 * así que la validación y lo que se guarda en Supabase no cambian.
	 */
	type Props = {
		value?: string;
		onchange?: (value: string) => void;
		class?: string;
		label?: string;
	};

	let { value = $bindable('09:00'), onchange, class: className = '', label = 'Hora' }: Props = $props();

	const hours12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
	const baseMinutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

	const h24 = $derived(Number(value?.match(/^(\d{2}):/)?.[1] ?? 9));
	const mm = $derived(value?.match(/:(\d{2})/)?.[1] ?? '00');
	const h12 = $derived(String(h24 % 12 || 12));
	const meridiem = $derived(h24 < 12 ? 'am' : 'pm');
	const minutes = $derived(baseMinutes.includes(mm) ? baseMinutes : [...baseMinutes, mm].sort());

	function set(h: string, m: string, mer: string) {
		const hour = (Number(h) % 12) + (mer === 'pm' ? 12 : 0);
		value = `${String(hour).padStart(2, '0')}:${m}`;
		onchange?.(value);
	}
</script>

<div class="flex items-center gap-0.5 {className}" role="group" aria-label={label}>
	<select
		aria-label="{label}: hora"
		value={h12}
		onchange={(e) => set(e.currentTarget.value, mm, meridiem)}
		class="time-select"
	>
		{#each hours12 as h (h)}
			<option value={h}>{h}</option>
		{/each}
	</select>
	<span class="opacity-70">:</span>
	<select
		aria-label="{label}: minutos"
		value={mm}
		onchange={(e) => set(h12, e.currentTarget.value, meridiem)}
		class="time-select"
	>
		{#each minutes as m (m)}
			<option value={m}>{m}</option>
		{/each}
	</select>
	<select
		aria-label="{label}: a. m. o p. m."
		value={meridiem}
		onchange={(e) => set(h12, mm, e.currentTarget.value)}
		class="time-select ampm"
	>
		<option value="am">a. m.</option>
		<option value="pm">p. m.</option>
	</select>
</div>

<style>
	.time-select {
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		outline: none;
		cursor: pointer;
		padding: 0;
		color-scheme: dark;
		font-variant-numeric: tabular-nums;
	}
	.ampm {
		margin-left: 0.4rem;
		font-size: 0.8em;
	}
	.time-select option {
		background-color: #0d1117;
		color: #fff;
	}
</style>
