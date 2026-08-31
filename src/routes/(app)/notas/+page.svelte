<script lang="ts">
	import { Plus, StickyNote, RefreshCw, ChevronRight, Users } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { fetchRootNotes, type Note } from '$lib/notes';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	let notes = $state<Note[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let currentUserId = $state('');

	const loadNotes = async () => {
		loading = true;
		errorMsg = '';
		try {
			const { data: { user } } = await supabase.auth.getUser();
			currentUserId = user?.id || '';
			notes = await fetchRootNotes();
		} catch (e: any) {
			errorMsg = e.message || 'Error al cargar las notas.';
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		loadNotes();
	});

	const openNote = (id: string) => {
		goto(`/notas/${id}`);
	};
</script>

<svelte:head>
	<title>Notas · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<StickyNote class="w-6 h-6 text-brand-accent" />
		<h1 class="text-xl font-bold text-brand-text">Notas</h1>
	</div>
	<button type="button" class="p-2 text-brand-text-muted hover:text-brand-text" onclick={loadNotes} aria-label="Actualizar notas">
		<RefreshCw class="w-5 h-5 {loading ? 'animate-spin' : ''}" />
	</button>
</header>

<div class="flex-1 overflow-y-auto px-4 py-4 pb-28">
	{#if errorMsg}
		<div class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-4 text-sm">
			{errorMsg}
		</div>
	{/if}

	{#if loading && notes.length === 0}
		<div class="space-y-3">
			{#each [1, 2, 3] as _}
				<div class="h-24 rounded-xl bg-brand-surface skeleton"></div>
			{/each}
		</div>
	{:else if notes.length === 0}
		<div class="flex flex-col items-center justify-center text-center px-6 py-16">
			<div class="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-divider flex items-center justify-center mb-4">
				<StickyNote class="w-7 h-7 text-brand-accent" />
			</div>
			<h2 class="text-lg font-semibold text-brand-text mb-2">Sin notas aún</h2>
			<p class="text-brand-text-muted text-sm max-w-xs mb-6">
				Crea tu primera nota para organizar tus ideas.
			</p>
			<button
				type="button"
				class="bg-brand-accent text-brand-bg font-bold px-5 py-3 rounded-xl transition-colors hover:brightness-105"
				onclick={() => goto('/notas/nueva')}
			>
				Crear nota
			</button>
		</div>
	{:else}
		<div class="grid gap-3">
			{#each notes as note (note.id)}
				<button
					type="button"
					class="text-left bg-brand-surface rounded-xl p-4 border border-brand-divider hover:border-brand-accent/50 transition-colors flex flex-col gap-2 relative group"
					onclick={() => openNote(note.id)}
				>
					<div class="flex items-start justify-between w-full gap-2">
						<div class="flex items-center gap-2 overflow-hidden">
							{#if note.user_id !== currentUserId}
								<Users class="w-4 h-4 text-brand-accent shrink-0" title="Compartida conmigo" />
							{/if}
							<h3 class="font-bold text-brand-text truncate pr-6">{note.title || 'Nota sin título'}</h3>
						</div>
						<ChevronRight class="w-4 h-4 text-brand-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
					</div>
					{#if note.content}
						<p class="text-sm text-brand-text-muted line-clamp-2 leading-relaxed">
							{note.content}
						</p>
					{/if}
					<span class="text-[10px] text-brand-text-muted mt-1 uppercase tracking-wider font-semibold">
						{new Date(note.updated_at).toLocaleDateString()}
					</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<button
	type="button"
	class="absolute bottom-24 right-6 w-14 h-14 bg-brand-accent hover:brightness-105 text-brand-bg rounded-full shadow-lg shadow-black/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-20"
	onclick={() => goto('/notas/nueva')}
	aria-label="Crear nota"
>
	<Plus class="w-7 h-7" />
</button>
