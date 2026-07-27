<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';
	import type { Session } from '@supabase/supabase-js';

	let { children } = $props();

	let session = $state<Session | null>(null);
	let loading = $state(true);

	onMount(() => {
		supabase?.auth.getSession().then(({ data: { session: currentSession } }) => {
			session = currentSession;
			loading = false;
		});

		const {
			data: { subscription },
		} = supabase?.auth.onAuthStateChange((_event, currentSession) => {
			session = currentSession;
		}) ?? { data: { subscription: { unsubscribe: () => {} } } };

		return () => subscription.unsubscribe();
	});

	const signInWithGoogle = async () => {
		await supabase?.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: window.location.origin
			}
		});
	};
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<main class="max-w-md mx-auto min-h-screen bg-brand-bg relative shadow-2xl overflow-hidden flex flex-col">
	{#if loading}
		<div class="flex-1 flex items-center justify-center h-full">
			<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-accent"></div>
		</div>
	{:else if !session}
		<div class="flex-1 flex flex-col items-center justify-center p-8 space-y-8 bg-brand-bg">
			<div class="text-center space-y-3">
				<div class="w-20 h-20 bg-brand-surface rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-sm border border-brand-divider">
					<img src={favicon} alt="Fokuz Logo" class="w-12 h-12" />
				</div>
				<h1 class="text-4xl font-bold text-brand-text tracking-tight">Fokuz</h1>
				<p class="text-brand-text-muted text-lg">Organiza tu día de forma simple</p>
			</div>
			
			<button 
				onclick={signInWithGoogle}
				class="w-full flex items-center justify-center gap-3 bg-white text-gray-800 px-6 py-4 rounded-xl font-medium shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow transition-all active:scale-[0.98]"
			>
				<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="w-6 h-6" />
				Continuar con Google
			</button>
		</div>
	{:else}
		{@render children()}
	{/if}
</main>
