<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ChevronLeft, Plus, Save, Trash2, StickyNote, ChevronRight, Share2, X } from 'lucide-svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import {
		fetchNote,
		fetchSubnotes,
		createNote,
		updateNote,
		deleteNote,
		fetchNoteShares,
		fetchMyContacts,
		shareNote,
		unshareNote,
		type Note,
		type Contact
	} from '$lib/notes';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { supabase } from '$lib/supabaseClient';

	const id = $derived(page.params.id);
	const parentId = $derived(page.url.searchParams.get('parent_id'));
	const isNew = $derived(id === 'nueva');

	let note = $state<Partial<Note>>({ title: '', content: '' });
	let subnotes = $state<Note[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let errorMsg = $state('');
	let previewMode = $state(false);
	let showDeleteConfirm = $state(false);

	let currentUserId = $state('');
	let isOwner = $derived(note.user_id === currentUserId);
	let showShareModal = $state(false);
	let contacts = $state<Contact[]>([]);
	let sharedWithIds = $state<Set<string>>(new Set());
	let shareBusyId = $state<string | null>(null);
	let showNoteSavedToast = $state(false);

	const parsedContent = $derived.by(() => {
		if (!previewMode || !note.content) return '';
		try {
			const html = marked.parse(note.content, { async: false }) as string;
			return DOMPurify.sanitize(html);
		} catch (e) {
			return '<p class="text-red-400">Error al procesar formato</p>';
		}
	});

	const loadData = async () => {
		const { data: { user } } = await supabase.auth.getUser();
		currentUserId = user?.id || '';

		if (isNew) {
			note = { title: '', content: '', parent_id: parentId };
			subnotes = [];
			loading = false;
			return;
		}

		loading = true;
		errorMsg = '';
		try {
			const [n, subs, shares, myContacts] = await Promise.all([
				fetchNote(id), 
				fetchSubnotes(id),
				fetchNoteShares(id),
				fetchMyContacts()
			]);
			note = n;
			subnotes = subs;
			sharedWithIds = new Set(shares);
			contacts = myContacts;

			// Muestra el toast si venimos de una redirección después de crear
			if (page.url.searchParams.get('saved') === 'true') {
				showNoteSavedToast = true;
				// Limpia la URL para evitar que se muestre de nuevo al recargar
				const url = new URL(page.url.href);
				url.searchParams.delete('saved');
				goto(url.pathname + url.search, { replaceState: true });
			}
		} catch (e: any) {
			errorMsg = e.message || 'Error al cargar la nota.';
		} finally {
			loading = false;
		}
	};

	$effect(() => {
		void id; // Re-run when ID changes
		loadData();
	});

	const handleSave = async () => {
		saving = true;
		errorMsg = '';
		try {
			if (isNew) {
				const created = await createNote({
					title: note.title,
					content: note.content,
					parent_id: note.parent_id
				});
				goto(`/notas/${created.id}?saved=true`, { replaceState: true });
			} else {
				await updateNote(id, { title: note.title, content: note.content });
				showNoteSavedToast = true;
			}
		} catch (e: any) {
			errorMsg = e.message || 'Error al guardar la nota.';
		} finally {
			saving = false;
		}
	};

	const handleDeleteRequest = () => {
		showDeleteConfirm = true;
	};

	const handleDeleteConfirm = async () => {
		showDeleteConfirm = false;
		try {
			await deleteNote(id);
			if (note.parent_id) {
				goto(`/notas/${note.parent_id}`);
			} else {
				goto('/notas');
			}
		} catch (e: any) {
			errorMsg = e.message || 'Error al eliminar.';
		}
	};

	const toggleShare = async (contactId: string, isShared: boolean) => {
		if (shareBusyId === contactId) return;
		shareBusyId = contactId;
		try {
			if (isShared) {
				await unshareNote(id, contactId);
				sharedWithIds.delete(contactId);
			} else {
				await shareNote(id, contactId);
				sharedWithIds.add(contactId);
			}
			sharedWithIds = new Set(sharedWithIds);
		} catch (e: any) {
			alert('Error al compartir: ' + e.message);
		} finally {
			shareBusyId = null;
		}
	};

	const goBack = () => {
		if (note.parent_id) {
			goto(`/notas/${note.parent_id}`);
		} else {
			goto('/notas');
		}
	};
</script>

<svelte:head>
	<title>{isNew ? 'Nueva Nota' : (note.title || 'Nota')} · Fokuz</title>
</svelte:head>

<header class="flex items-center justify-between p-4 bg-brand-surface pb-4 z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="p-2 -ml-2 rounded-full bg-brand-surface text-brand-text-muted hover:text-brand-text transition-colors"
			onclick={goBack}
			aria-label="Volver"
		>
			<ChevronLeft class="w-6 h-6" />
		</button>
		<h1 class="text-lg font-bold text-brand-text truncate w-32 md:w-auto">
			{isNew ? 'Nueva Nota' : 'Editar Nota'}
		</h1>
	</div>
	<div class="flex items-center gap-2">
		{#if !isNew}
			{#if isOwner}
				<button
					type="button"
					class="p-2 rounded-full text-brand-text-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors"
					onclick={() => showShareModal = true}
					aria-label="Compartir"
				>
					<Share2 class="w-5 h-5" />
				</button>
			{/if}
			{#if isOwner}
				<button
					type="button"
					class="p-2 rounded-full text-red-400 hover:bg-red-500/10 transition-colors"
					onclick={handleDeleteRequest}
					aria-label="Eliminar"
				>
					<Trash2 class="w-5 h-5" />
				</button>
			{/if}
		{/if}
		<button
			type="button"
			class="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent text-brand-bg font-bold rounded-lg transition-colors hover:brightness-105 disabled:opacity-50"
			onclick={handleSave}
			disabled={saving}
		>
			<Save class="w-4 h-4" />
			<span class="text-sm">{saving ? '...' : 'Guardar'}</span>
		</button>
	</div>
</header>

<div class="flex-1 overflow-y-auto px-4 py-4 pb-28">
	{#if errorMsg}
		<div class="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl mb-4 text-sm">
			{errorMsg}
		</div>
	{/if}

	{#if loading}
		<div class="space-y-4 mt-2">
			<div class="h-10 rounded-xl bg-brand-surface skeleton"></div>
			<div class="h-40 rounded-xl bg-brand-surface skeleton"></div>
		</div>
	{:else}
		<div class="flex flex-col h-full space-y-4">
			<input
				type="text"
				bind:value={note.title}
				placeholder="Título de la nota..."
				class="w-full bg-transparent text-2xl font-bold text-brand-text placeholder-brand-text-muted focus:outline-none"
			/>
			
			<div class="flex items-center gap-2 mb-2 bg-brand-surface p-1 rounded-lg w-fit mt-2">
				<button
					type="button"
					class="px-3 py-1.5 rounded-md text-xs font-bold transition-colors {!previewMode ? 'bg-brand-bg text-brand-text shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}"
					onclick={() => previewMode = false}
				>
					Escribir
				</button>
				<button
					type="button"
					class="px-3 py-1.5 rounded-md text-xs font-bold transition-colors {previewMode ? 'bg-brand-bg text-brand-text shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}"
					onclick={() => previewMode = true}
				>
					Vista Previa
				</button>
			</div>
			
			{#if previewMode}
				<div class="w-full flex-1 min-h-[200px] prose prose-invert prose-brand overflow-y-auto">
					{@html parsedContent}
				</div>
			{:else}
				<textarea
					bind:value={note.content}
					placeholder="Escribe tu nota usando Markdown (ej: **negrita**, tablas, etc)..."
					class="w-full flex-1 min-h-[200px] bg-transparent resize-none text-brand-text placeholder-brand-text-muted/60 focus:outline-none leading-relaxed font-mono text-sm"
				></textarea>
			{/if}
			
			{#if !isNew}
				<div class="pt-6 border-t border-brand-divider mt-auto">
					<div class="flex items-center justify-between mb-4">
						<h3 class="font-bold text-brand-text text-sm uppercase tracking-wider">Subnotas</h3>
						<button
							type="button"
							class="text-xs font-bold text-brand-accent bg-brand-accent/10 px-3 py-1.5 rounded-lg hover:bg-brand-accent/20 transition-colors flex items-center gap-1"
							onclick={() => goto(`/notas/nueva?parent_id=${id}`)}
						>
							<Plus class="w-3 h-3" />
							Crear Subnota
						</button>
					</div>

					{#if subnotes.length === 0}
						<div class="text-center py-6 border border-dashed border-brand-divider rounded-xl">
							<p class="text-sm text-brand-text-muted">No hay subnotas.</p>
						</div>
					{:else}
						<div class="grid gap-2">
							{#each subnotes as subnote (subnote.id)}
								<button
									type="button"
									class="text-left bg-brand-surface rounded-xl p-3 border border-brand-divider hover:border-brand-accent/50 transition-colors flex flex-col gap-1 relative group"
									onclick={() => goto(`/notas/${subnote.id}`)}
								>
									<div class="flex items-center justify-between w-full">
										<div class="flex items-center gap-2">
											<StickyNote class="w-4 h-4 text-brand-text-muted" />
											<h4 class="font-bold text-brand-text text-sm truncate pr-4">{subnote.title || 'Sin título'}</h4>
										</div>
										<ChevronRight class="w-4 h-4 text-brand-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<ConfirmModal 
	isOpen={showDeleteConfirm}
	title="Eliminar Nota"
	message="¿Estás seguro de eliminar esta nota? También se eliminarán TODAS sus subnotas permanentemente."
	confirmText="Sí, eliminar"
	onConfirm={handleDeleteConfirm}
	onCancel={() => showDeleteConfirm = false}
/>

{#if showShareModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onclick={() => showShareModal = false}>
		<div class="bg-brand-surface border border-brand-divider rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-200" onclick={e => e.stopPropagation()}>
			<button type="button" class="absolute top-4 right-4 p-1.5 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-bg transition-colors" onclick={() => showShareModal = false} aria-label="Cerrar">
				<X class="w-5 h-5" />
			</button>
			
			<h3 class="text-xl font-bold text-brand-text mb-2">Compartir Nota</h3>
			<p class="text-sm text-brand-text-muted mb-6">Permite a tus contactos ver y editar esta nota.</p>
			
			{#if contacts.length === 0}
				<p class="text-sm text-brand-text-muted text-center py-4 bg-brand-bg rounded-xl">No tienes contactos agregados. Ve a tu Perfil para agregar contactos por correo.</p>
			{:else}
				<div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
					{#each contacts as contact}
						{@const isShared = sharedWithIds.has(contact.id)}
						<div class="flex items-center justify-between p-3 rounded-xl border {isShared ? 'border-brand-accent/30 bg-brand-accent/5' : 'border-brand-divider bg-brand-bg'} transition-colors">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-bold text-brand-text truncate">{contact.display_name}</p>
								<p class="text-xs text-brand-text-muted truncate">{contact.email}</p>
							</div>
							<button 
								type="button"
								class="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors {isShared ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-brand-accent text-brand-bg hover:brightness-105'} disabled:opacity-50"
								disabled={shareBusyId === contact.id}
								onclick={() => toggleShare(contact.id, isShared)}
							>
								{#if shareBusyId === contact.id}
									...
								{:else if isShared}
									Quitar
								{:else}
									Compartir
								{/if}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<Toast bind:show={showNoteSavedToast} message="Nota guardada correctamente" />
