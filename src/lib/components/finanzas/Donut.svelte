<script lang="ts">
	let { value = 0, tone = 'accent' }: { value?: number; tone?: 'accent' | 'rose' | 'amber' } = $props();

	const colors = {
		accent: '#00DF81',
		rose: '#fb7185',
		amber: '#fbbf24'
	};
	const pct = $derived(Math.min(100, Math.max(0, value)));
</script>

<svg viewBox="0 0 36 36" class="w-10 h-10 -rotate-90" aria-hidden="true">
	<circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />
	<circle
		cx="18"
		cy="18"
		r="14"
		fill="none"
		stroke={colors[tone]}
		stroke-width="4"
		stroke-linecap="round"
		stroke-dasharray="{pct} {100 - pct}"
		pathLength="100"
	/>
</svg>
