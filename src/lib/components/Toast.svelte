<script lang="ts">
	import { CheckCircle2 } from 'lucide-svelte';

	let { 
		message = '', 
		show = $bindable(false),
		duration = 3000
	} = $props<{
		message: string;
		show?: boolean;
		duration?: number;
	}>();

	$effect(() => {
		if (show) {
			const timer = setTimeout(() => {
				show = false;
			}, duration);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if show}
	<div class="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
		<div class="flex items-center gap-2 bg-brand-surface border border-brand-accent/50 text-brand-text px-4 py-3 rounded-full shadow-lg shadow-brand-accent/20">
			<CheckCircle2 class="w-5 h-5 text-brand-accent" />
			<span class="font-bold text-sm">{message}</span>
		</div>
	</div>
{/if}
