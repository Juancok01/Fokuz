<script lang="ts">
	import BottomNav from '$lib/components/BottomNav.svelte';
	import GlobalPomodoro from '$lib/components/GlobalPomodoro.svelte';
	import { Menu } from '@lucide/svelte';
	import logo from '$lib/assets/Logo_Fokuz.png';

	let { children } = $props();
	let isMenuOpen = $state(false);

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function closeMenu() {
		isMenuOpen = false;
	}
</script>

<div class="flex-1 flex flex-col min-h-0 relative">
	<!-- Top App Bar -->
	<header class="h-14 bg-brand-surface flex items-center px-4 border-b border-brand-divider shrink-0 sticky top-0 z-10">
		<button onclick={toggleMenu} class="p-2 hover:bg-brand-surface-elevated rounded-lg transition-colors" aria-label="Abrir menú">
			<Menu class="w-6 h-6 text-brand-text" />
		</button>
		<div class="ml-4 flex items-center gap-2">
			<img src={logo} alt="Fokuz Logo" class="w-6 h-6 rounded-md object-contain" />
			<h1 class="font-semibold text-brand-text text-lg">Fokuz</h1>
		</div>
	</header>

	<div class="flex-1 flex flex-col min-h-0 relative overflow-hidden">
		<!-- Overlay -->
		{#if isMenuOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div 
				class="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-sm"
				onclick={closeMenu}
			></div>
		{/if}

		<BottomNav isOpen={isMenuOpen} {closeMenu} />
		
		<div class="flex-1 flex flex-col min-h-0 relative overflow-y-auto">
			{@render children()}
		</div>

		<GlobalPomodoro />
	</div>
</div>
