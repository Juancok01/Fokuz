<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ChevronLeft, Plus, Save, Trash2, StickyNote, ChevronRight, Share2, X } from 'lucide-svelte';
	import 'quill/dist/quill.snow.css';
	import 'highlight.js/styles/atom-one-dark.css';
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
	let showDeleteConfirm = $state(false);

	let currentUserId = $state('');
	let isOwner = $derived(note.user_id === currentUserId);
	let showShareModal = $state(false);
	let contacts = $state<Contact[]>([]);
	let sharedWithIds = $state<Set<string>>(new Set());
	let shareBusyId = $state<string | null>(null);
	let showNoteSavedToast = $state(false);

	let quillInstance: any = null;
	let showTableModal = $state(false);
	let tableRows = $state(3);
	let tableCols = $state(3);



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

	function quillAction(node: HTMLElement) {
		let quill: any;

		(async () => {
			const Quill = (await import('quill')).default;
			const hljs = (await import('highlight.js')).default;

			const icons = Quill.import('ui/icons');
			icons['table'] = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>';
			icons['table-delete'] = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" opacity="0.3"/><path d="M8 8l8 8M16 8l-8 8"/></svg>';

			quill = new Quill(node, {
				theme: 'snow',
				modules: {
					syntax: { hljs },
					table: true,
					toolbar: {
						container: [
							[{ 'header': [1, 2, 3, false] }],
							['bold', 'italic', 'underline', 'strike'],
							[{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
							['code-block', 'table', 'table-delete'],
							['clean']
						],
						handlers: {
							table: function() {
								showTableModal = true;
							},
							'table-delete': function() {
								this.quill.getModule('table').deleteTable();
							}
						}
					}
				},
				placeholder: 'Escribe tu nota aquí...'
			});

			quillInstance = quill;

			if (note.content) {
				quill.root.innerHTML = note.content;
			}

			quill.on('text-change', () => {
				note.content = quill.root.innerHTML;
			});
		})();

		return {
			destroy() {
				quillInstance = null;
			}
		};
	}
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
				lang="es"
				spellcheck="true"
				class="w-full bg-transparent text-2xl font-bold text-brand-text placeholder-brand-text-muted focus:outline-none"
			/>
			
			<div class="w-full flex-1 min-h-[200px] mt-2 relative quill-wrapper">
				<div use:quillAction class="w-full h-full text-brand-text max-w-none" lang="es" spellcheck="true"></div>
			</div>
			
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

{#if showTableModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onclick={() => showTableModal = false}>
		<div class="bg-brand-surface border border-brand-divider rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-200" onclick={e => e.stopPropagation()}>
			<h3 class="text-xl font-bold text-brand-text mb-4">Insertar Tabla</h3>
			
			<div class="space-y-4 mb-6">
				<div>
					<label class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Filas</label>
					<input type="number" min="1" max="20" bind:value={tableRows} class="w-full bg-brand-bg border border-brand-divider rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-accent transition-colors" />
				</div>
				<div>
					<label class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Columnas</label>
					<input type="number" min="1" max="20" bind:value={tableCols} class="w-full bg-brand-bg border border-brand-divider rounded-xl px-4 py-2.5 text-brand-text focus:outline-none focus:border-brand-accent transition-colors" />
				</div>
			</div>
			
			<div class="flex items-center justify-end gap-2">
				<button type="button" class="px-4 py-2 rounded-xl text-sm font-bold text-brand-text-muted hover:bg-brand-bg transition-colors" onclick={() => showTableModal = false}>Cancelar</button>
				<button type="button" class="px-4 py-2 bg-brand-accent text-brand-bg rounded-xl text-sm font-bold hover:brightness-105 transition-colors" onclick={() => {
					if (quillInstance) {
						quillInstance.getModule('table').insertTable(tableRows, tableCols);
					}
					showTableModal = false;
				}}>Insertar</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Quill Dark Theme Overrides */
	:global(.ql-toolbar.ql-snow) {
		border-color: rgba(255, 255, 255, 0.1) !important;
		background: rgba(255, 255, 255, 0.05);
		border-top-left-radius: 0.5rem;
		border-top-right-radius: 0.5rem;
		font-family: inherit !important;
	}
	:global(.ql-container.ql-snow) {
		border-color: rgba(255, 255, 255, 0.1) !important;
		border-bottom-left-radius: 0.5rem;
		border-bottom-right-radius: 0.5rem;
		font-family: inherit !important;
		font-size: 1rem !important;
	}
	:global(.ql-editor) {
		min-height: 200px;
	}
	:global(.ql-snow .ql-stroke) {
		stroke: #a1a1aa !important;
	}
	:global(.ql-snow .ql-fill, .ql-snow .ql-stroke.ql-fill) {
		fill: #a1a1aa !important;
	}
	:global(.ql-snow .ql-picker) {
		color: #a1a1aa !important;
	}
	:global(.ql-snow .ql-picker-options) {
		background-color: #18181b !important;
		border-color: rgba(255, 255, 255, 0.1) !important;
	}
	:global(.ql-snow .ql-picker-item:hover) {
		color: #e4e4e7 !important;
	}
	:global(.ql-editor.ql-blank::before) {
		color: rgba(255, 255, 255, 0.4) !important;
		font-style: normal !important;
	}
	:global(.ql-editor h1), :global(.ql-editor h2), :global(.ql-editor h3) {
		font-weight: 700 !important;
		margin-top: 1em;
		margin-bottom: 0.5em;
	}
	:global(.ql-editor h1) { font-size: 1.875rem; }
	:global(.ql-editor h2) { font-size: 1.5rem; }
	:global(.ql-editor h3) { font-size: 1.25rem; }
	:global(.ql-editor p) { margin-bottom: 1em; }
	:global(.ql-editor ul), :global(.ql-editor ol) { padding-left: 1.5rem; margin-bottom: 1em; }
	:global(.ql-editor pre.ql-syntax) {
		background-color: #18181b;
		color: #e4e4e7;
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
	}
	:global(.ql-editor table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 1em;
		display: block;
		overflow-x: auto;
	}
	:global(.ql-editor table td) {
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 0.5rem;
		min-width: 120px;
	}
	/* Agrandar checkboxes para mejor usabilidad en móviles (Diseño Circular Amarillo) */
	:global(.ql-snow .ql-editor li[data-list="checked"] > .ql-ui),
	:global(.ql-snow .ql-editor li[data-list="unchecked"] > .ql-ui) {
		display: inline-block !important;
		width: 1.5rem !important;
		height: 1.5rem !important;
		border-radius: 50% !important;
		border: 2px solid #facc15 !important;
		margin-left: -2.25rem !important;
		margin-top: 0.15rem !important;
		margin-right: 0.75rem !important;
		cursor: pointer;
		vertical-align: top;
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
	}
	
	/* Esconder el ::before original para que no estorbe */
	:global(.ql-snow .ql-editor li > .ql-ui::before) {
		display: none !important;
	}

	:global(.ql-snow .ql-editor li[data-list="unchecked"] > .ql-ui) {
		background-color: transparent !important;
	}

	:global(.ql-snow .ql-editor li[data-list="checked"] > .ql-ui) {
		background-color: #facc15 !important;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000000' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E") !important;
		background-size: 65% !important;
		background-position: center !important;
		background-repeat: no-repeat !important;
	}

	:global(.ql-snow .ql-editor li[data-list="checked"]),
	:global(.ql-snow .ql-editor li[data-list="unchecked"]) {
		padding-left: 2.5rem !important;
		min-height: 2em;
	}
</style>
