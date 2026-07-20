<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<main class="max-w-md mx-auto min-h-screen bg-brand-bg relative shadow-2xl overflow-hidden flex flex-col">
	{@render children()}
</main>
