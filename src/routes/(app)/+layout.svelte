<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { children } = $props();
</script>

<div class="flex-1 flex flex-col min-h-0 relative pb-16">
	{@render children()}
	<BottomNav />
</div>
