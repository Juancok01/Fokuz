<script lang="ts">
	import { User, LogOut, Check } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	let alias = $state('');
	let email = $state('');
	let saving = $state(false);
	let saved = $state(false);
	let loading = $state(true);
	let errorMsg = $state('');

	const loadProfile = async () => {
		loading = true;
		errorMsg = '';

		if (!supabase) {
			loading = false;
			return;
		}

		const { data, error } = await supabase.auth.getUser();
		if (error) {
			errorMsg = error.message;
			loading = false;
			return;
		}

		const meta = data.user?.user_metadata ?? {};
		alias = (meta.alias || '').trim();
		email = data.user?.email ?? '';
		loading = false;
	};

	const saveAlias = async () => {
		if (!supabase) return;

		const value = alias.trim();
		saving = true;
		saved = false;
		errorMsg = '';

		const { error } = await supabase.auth.updateUser({
			data: { alias: value }
		});

		saving = false;

		if (error) {
			errorMsg = error.message;
			return;
		}

		alias = value;
		saved = true;
		setTimeout(() => {
			saved = false;
		}, 2000);
	};

	onMount(() => {
		loadProfile();
	});
</script>

<svelte:head>
	<title>Perfil · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<User class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Perfil</h1>
	</div>
</header>

<div class="flex-1 px-6 py-8 space-y-6 pb-28">
	{#if loading}
		<div class="bg-brand-surface border border-brand-divider rounded-2xl p-5 space-y-4">
			<div class="h-4 w-28 rounded bg-brand-surface-elevated skeleton"></div>
			<div class="h-12 w-full rounded-xl bg-brand-surface-elevated skeleton"></div>
			<div class="h-12 w-full rounded-xl bg-brand-surface-elevated skeleton"></div>
		</div>
	{:else}
		<div class="bg-brand-surface border border-brand-divider rounded-2xl p-5 space-y-4">
			<div class="flex items-center gap-4">
				<div class="w-12 h-12 rounded-full bg-brand-accent/20 flex items-center justify-center shrink-0">
					<User class="w-6 h-6 text-brand-accent" />
				</div>
				<div class="min-w-0">
					<p class="font-semibold text-brand-text">Tu cuenta</p>
					<p class="text-sm text-brand-text-muted truncate">{email || 'Gestiona tu sesión en Fokuz'}</p>
				</div>
			</div>

			<div class="border-t border-brand-divider pt-4 space-y-3">
				<label for="alias" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase">
					Alias
				</label>
				<p class="text-sm text-brand-text-muted">
					¿Cómo te gustaría que te llamáramos?
				</p>
				<input
					id="alias"
					type="text"
					bind:value={alias}
					placeholder="Ej. Juan, Alex..."
					maxlength={24}
					class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
				/>
				<button
					onclick={saveAlias}
					disabled={saving}
					class="w-full bg-brand-accent hover:brightness-105 disabled:opacity-60 text-brand-bg font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
				>
					{#if saved}
						<Check class="w-5 h-5" />
						Guardado
					{:else}
						{saving ? 'Guardando...' : 'Guardar alias'}
					{/if}
				</button>
				{#if errorMsg}
					<p class="text-sm text-red-400">{errorMsg}</p>
				{/if}
			</div>
		</div>
	{/if}

	<button
		onclick={() => supabase?.auth.signOut()}
		class="w-full flex items-center justify-center gap-2 bg-brand-surface border border-brand-divider text-brand-text px-6 py-4 rounded-xl font-medium hover:bg-brand-surface-elevated transition-colors"
	>
		<LogOut class="w-5 h-5 text-red-400" />
		Cerrar sesión
	</button>
</div>
