<script lang="ts">
	import { RefreshCw } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Hábitos · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<RefreshCw class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Hábitos</h1>
	</div>
</header>

<div class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
	<div class="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-divider flex items-center justify-center mb-4">
		<RefreshCw class="w-7 h-7 text-brand-accent" />
	</div>
	<h2 class="text-lg font-semibold text-brand-text mb-2">Próximamente</h2>
	<p class="text-brand-text-muted text-sm max-w-xs">Aquí podrás seguir tus hábitos diarios.</p>
</div>
