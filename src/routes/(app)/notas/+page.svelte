<script lang="ts">
	import { 
		Plus, Folder, Star, Briefcase, Lightbulb, Tag, Archive, Trash2,
		Search, CalendarDays, Lock, LayoutGrid, List, ChevronRight, Clock,
		Timer, Share2, MoreHorizontal, Bold, Italic, Underline, CheckSquare,
		AlignLeft, Code, Target, Check, Edit2, Heading1, Heading2, Heading3,
		X, Menu
	} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { onMount, onDestroy } from 'svelte';
	
	// Quill (imported dynamically to avoid SSR errors)
	import type Quill from 'quill';
	import 'quill/dist/quill.snow.css';
	
	// Highlight.js
	import 'highlight.js/styles/atom-one-dark.css';

	// Estado
	let quillInstance: Quill | null = null;
	let isQuillUpdating = false;

	// Mobile states
	let showMobileList = $state(false);
	let showMobileFolders = $state(false);

	let activeFolderId = $state<string | null>(null);
	let activeFolderName = $state<string>('Todas las Notas');
	let folders = $state<{id: string, name: string}[]>([]);
	let notes = $state<any[]>([]);
	
	let filteredNotes = $derived(notes.filter(n => {
		if (activeFolderId === null) {
			if (activeFolderName === 'Favoritas' && !n.pinned) return false;
		} else {
			if (n.folder_id !== activeFolderId) return false;
		}

		return (n.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
			   (n.excerpt || '').toLowerCase().includes(searchQuery.toLowerCase());
	}));
	let activeNoteId = $state<string | null>(null);
	let activeNote = $derived(filteredNotes.length > 0 ? (filteredNotes.find(n => n.id === activeNoteId) || filteredNotes[0]) : null);
	let viewMode = $state<'grid' | 'list'>('grid');
	let searchQuery = $state('');

	let showNewFolderModal = $state(false);
	let newFolderName = $state('');
	let isCreatingFolder = $state(false);
	
	let showEditFolderModal = $state(false);
	let folderToEdit = $state<{id: string, name: string} | null>(null);
	let editFolderName = $state('');
	let isEditingFolder = $state(false);

	let showDeleteFolderModal = $state(false);
	let folderToDelete = $state<{id: string, name: string} | null>(null);
	let isDeletingFolder = $state(false);

	
	let showShareToast = $state(false);
	let showSaveToast = $state(false);
	let showDeleteModal = $state(false);
	let showShareModal = $state(false);
	let shareSearchQuery = $state('');
	
	type Contact = {
		id: string;
		email: string;
		display_name: string;
		nickname: string;
		selected?: boolean;
		avatar?: string;
		color?: string;
	};

	let appContacts = $state<Contact[]>([]);
	
	let filteredContacts = $derived(
		appContacts.filter(c => c.display_name.toLowerCase().includes(shareSearchQuery.toLowerCase()) || c.email.toLowerCase().includes(shareSearchQuery.toLowerCase()))
	);

	const contactColors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];

	let currentTime = $state(Date.now());

	onMount(() => {
		const interval = setInterval(() => currentTime = Date.now(), 60000);
		
		Promise.all([loadFolders(), loadContacts()]).then(() => {
			loadNotes();
		});

		return () => clearInterval(interval);
	});

	function quillAction(node: HTMLElement) {
		let isDestroyed = false;

		(async () => {
			const QuillLib = (await import('quill')).default;
			const hljsLib = (await import('highlight.js')).default;
			
			if (isDestroyed) return;

			quillInstance = new QuillLib(node, {
				modules: {
					syntax: { hljs: hljsLib },
					toolbar: '#toolbar-container'
				},
				placeholder: 'Escribe el contenido de tu nota aquí...',
				theme: 'snow'
			});

			quillInstance.on('text-change', () => {
				if (isQuillUpdating || !activeNote) return;
				const index = notes.findIndex(n => n.id === activeNote.id);
				if (index !== -1) {
					notes[index].excerpt = quillInstance!.root.innerHTML;
				}
			});

			if (activeNote && activeNote.excerpt) {
				isQuillUpdating = true;
				quillInstance.clipboard.dangerouslyPasteHTML(activeNote.excerpt);
				isQuillUpdating = false;
			}
		})();

		return {
			destroy() {
				isDestroyed = true;
				quillInstance = null;
			}
		};
	}

	$effect(() => {
		// Sincronizar contenido cuando cambia activeNoteId
		if (quillInstance && activeNote) {
			if (quillInstance.root.innerHTML !== activeNote.excerpt) {
				isQuillUpdating = true;
				quillInstance.clipboard.dangerouslyPasteHTML(activeNote.excerpt || '');
				isQuillUpdating = false;
			}
		} else if (quillInstance && !activeNote) {
			isQuillUpdating = true;
			quillInstance.setContents([]);
			isQuillUpdating = false;
		}
	});

	async function loadContacts() {
		if (!supabase) return;
		
		let rowsResult = await supabase
			.from('contacts')
			.select('id, nickname, contact_user_id')
			.order('created_at', { ascending: false });

		if (rowsResult.error && /nickname/i.test(rowsResult.error.message)) {
			rowsResult = (await supabase
				.from('contacts')
				.select('id, contact_user_id')
				.order('created_at', { ascending: false })) as any;
		}

		if (rowsResult.error) return;
		const rows = rowsResult.data ?? [];
		if (rows.length === 0) return;

		const ids = rows.map((row) => row.contact_user_id);
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, email, display_name')
			.in('id', ids);

		const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
		
		appContacts = rows.map((row, index) => {
			const profile = profileMap.get(row.contact_user_id);
			const fallbackEmail = 'Contacto';
			const emailValue = profile?.email ?? fallbackEmail;
			const displayName = (profile?.display_name || '').trim() || (profile?.email ? profile.email.split('@')[0] : 'Contacto');
			
			return {
				id: row.contact_user_id,
				email: emailValue,
				nickname: ((row as any).nickname || '').trim(),
				display_name: displayName,
				selected: false,
				avatar: displayName.charAt(0).toUpperCase(),
				color: contactColors[index % contactColors.length]
			};
		});
	}

	let lastEditedText = $derived.by(() => {
		if (!activeNote || !activeNote.last_edited_at) return 'Sin editar';
		const diff = currentTime - activeNote.last_edited_at;
		if (diff < 60000) return 'Editada justo ahora';
		const min = Math.floor(diff / 60000);
		if (min < 60) return `Editada hace ${min} minuto${min !== 1 ? 's' : ''}`;
		const hr = Math.floor(min / 3600000);
		if (hr < 24) return `Editada hace ${hr} hora${hr !== 1 ? 's' : ''}`;
		return 'Editada hace mucho';
	});

	async function loadFolders() {
		if (!supabase) return;
		const { data, error } = await supabase
			.from('note_folders')
			.select('*')
			.order('created_at', { ascending: true });
			
		if (data) {
			folders = data;
		}
	}

	async function loadNotes() {
		if (!supabase) return;
		const { data, error } = await supabase
			.from('notes')
			.select('*, note_shares(shared_with)')
			.order('updated_at', { ascending: false });
			
		if (data) {
			notes = data.map(n => {
				const sharedUsers = (n.note_shares || []).map((share: any) => {
					const contact = appContacts.find(c => c.id === share.shared_with);
					return contact ? { avatar: contact.avatar, color: contact.color } : null;
				}).filter(Boolean);
				
				return {
					...n,
					excerpt: n.content || '',
					last_edited_at: new Date(n.updated_at).getTime(),
					date: new Date(n.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' }),
					sharedUsers
				};
			});
			if (notes.length > 0 && !activeNoteId) {
				activeNoteId = notes[0].id;
			}
		}
	}

	function openNewFolderModal() {
		showNewFolderModal = true;
		newFolderName = '';
	}

	async function createFolder() {
		if (!newFolderName || !newFolderName.trim()) return;
		isCreatingFolder = true;
		if (!supabase) { isCreatingFolder = false; return; }
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { isCreatingFolder = false; return; }
		
		const { data, error } = await supabase
			.from('note_folders')
			.insert({ user_id: session.user.id, name: newFolderName.trim() })
			.select()
			.single();
			
		if (data) {
			folders = [...folders, data];
			showNewFolderModal = false;
			newFolderName = '';
		}
		isCreatingFolder = false;
	}

	function openEditFolderModal(folder: {id: string, name: string}) {
		folderToEdit = folder;
		editFolderName = folder.name;
		showEditFolderModal = true;
	}

	async function updateFolder() {
		if (!folderToEdit || !editFolderName.trim() || !supabase) return;
		isEditingFolder = true;
		
		const { error } = await supabase
			.from('note_folders')
			.update({ name: editFolderName.trim() })
			.eq('id', folderToEdit!.id);
			
		if (!error) {
			const index = folders.findIndex(f => f.id === folderToEdit!.id);
			if (index !== -1) {
				folders[index].name = editFolderName.trim();
				if (activeFolderId === folderToEdit!.id) {
					activeFolderName = editFolderName.trim();
				}
			}
			showEditFolderModal = false;
		}
		isEditingFolder = false;
	}

	function confirmDeleteFolder(folder: {id: string, name: string}) {
		folderToDelete = folder;
		showDeleteFolderModal = true;
	}

	async function deleteFolder() {
		if (!folderToDelete || !supabase) return;
		isDeletingFolder = true;
		
		const { error } = await supabase
			.from('note_folders')
			.delete()
			.eq('id', folderToDelete!.id);
			
		if (!error) {
			folders = folders.filter(f => f.id !== folderToDelete!.id);
			if (activeFolderId === folderToDelete!.id) {
				activeFolderId = null;
				activeFolderName = 'Todas las Notas';
			}
			loadNotes();
			showDeleteFolderModal = false;
		}
		isDeletingFolder = false;
	}

	async function toggleActiveNotePinned() {
		if (!activeNote || !supabase) return;
		const index = notes.findIndex(n => n.id === activeNote.id);
		if (index !== -1) {
			const newValue = !notes[index].pinned;
			notes[index].pinned = newValue;
			await supabase.from('notes').update({ pinned: newValue }).eq('id', activeNote.id);
		}
	}

	function shareActiveNote() {
		if (!activeNote) return;
		showShareModal = true;
	}

	async function executeShare() {
		if (!activeNote || !supabase) return;
		
		const selectedContacts = appContacts.filter(c => c.selected);
		if (selectedContacts.length === 0) {
			showShareModal = false;
			return;
		}

		const sharesToInsert = selectedContacts.map(c => ({
			note_id: activeNote.id,
			shared_with: c.id
		}));

		const { error } = await supabase
			.from('note_shares')
			.upsert(sharesToInsert, { onConflict: 'note_id, shared_with' });

		if (!error) {
			showShareModal = false;
			showShareToast = true;
			setTimeout(() => showShareToast = false, 3000);
			appContacts.forEach(c => c.selected = false);
			shareSearchQuery = '';
			await loadNotes();
		} else {
			alert('Error al compartir la nota');
		}
	}

	async function saveActiveNote() {
		if (!activeNote || !supabase) return;
		
		const titleEl = document.getElementById('editor-title');
		const excerptEl = document.getElementById('editor-excerpt');
		
		const index = notes.findIndex(n => n.id === activeNote.id);
		if (index !== -1) {
			const newTitle = titleEl ? titleEl.textContent || 'Sin título' : activeNote.title;
			const newExcerpt = excerptEl ? excerptEl.innerHTML || '' : activeNote.excerpt;
			
			notes[index].title = newTitle;
			notes[index].excerpt = newExcerpt;
			notes[index].last_edited_at = Date.now();
			currentTime = Date.now();

			await supabase.from('notes').update({ 
				title: newTitle, 
				content: newExcerpt 
			}).eq('id', activeNote.id);
		}

		showSaveToast = true;
		setTimeout(() => showSaveToast = false, 3000);
	}

	function confirmDeleteNote() {
		if (!activeNote) return;
		showDeleteModal = true;
	}

	async function deleteActiveNote() {
		if (!activeNote || !supabase) return;
		const idToDelete = activeNote.id;
		notes = notes.filter(n => n.id !== idToDelete);
		activeNoteId = notes[0]?.id || null;
		showDeleteModal = false;
		await supabase.from('notes').delete().eq('id', idToDelete);
	}

	async function createNewNote() {
		if (!supabase) return;
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) return;

		const insertData = {
			title: 'Nueva Nota',
			content: 'Escribe aquí el contenido de tu nueva nota...',
			user_id: session.user.id,
			folder_id: activeFolderId,
			pinned: false
		};

		const { data, error } = await supabase.from('notes').insert(insertData).select().single();
		if (data) {
			const newNote = {
				...data,
				excerpt: data.content || '',
				last_edited_at: new Date(data.updated_at).getTime(),
				date: new Date(data.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric', year: 'numeric' })
			};
			notes = [newNote, ...notes];
			activeNoteId = newNote.id;
			currentTime = Date.now();
		}
	}


</script>

<svelte:head>
	<title>Notas · Fokuz</title>
</svelte:head>

<div class="flex-1 flex h-full overflow-hidden bg-[#070b0e] text-brand-text relative">
	
	<!-- Left Sidebar (Navegación) -->
	<aside class="w-64 shrink-0 bg-[#070b0e] border-r border-brand-divider flex-col h-full overflow-y-auto custom-scrollbar z-30 transition-transform duration-300 md:translate-x-0 md:flex {showMobileFolders ? 'absolute inset-y-0 left-0 translate-x-0 shadow-2xl flex' : 'absolute inset-y-0 left-0 -translate-x-full md:relative'}">
		<div class="p-6 pb-2 flex-1 relative">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-[10px] font-bold text-brand-text-muted tracking-widest uppercase">Carpetas</h2>
				<button class="md:hidden p-1 rounded-md text-brand-text-muted hover:text-brand-text transition-colors" onclick={() => showMobileFolders = false}>
					<X class="w-4 h-4" />
				</button>
			</div>
			<button class="hidden md:block absolute top-5 right-4 p-1 rounded-md text-brand-text-muted hover:text-brand-text transition-colors" onclick={openNewFolderModal}>
				<Plus class="w-4 h-4" />
			</button>
			<ul class="space-y-1 mt-4">
				<li>
					<button 
						class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-colors {activeFolderId === null && activeFolderName === 'Todas las Notas' ? 'bg-brand-surface-elevated text-brand-text border border-brand-divider' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface'}"
						onclick={() => { activeFolderId = null; activeFolderName = 'Todas las Notas'; showMobileFolders = false; }}
					>
						<div class="flex items-center gap-3">
							<Folder class="w-4 h-4 {activeFolderId === null && activeFolderName === 'Todas las Notas' ? 'text-brand-accent' : 'text-brand-text-muted'}" />
							<span class="truncate">Todas las Notas</span>
						</div>
					</button>
				</li>
				<li>
					<button 
						class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-colors {activeFolderId === null && activeFolderName === 'Favoritas' ? 'bg-brand-surface-elevated text-brand-text border border-brand-divider' : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-surface'}"
						onclick={() => { activeFolderId = null; activeFolderName = 'Favoritas'; showMobileFolders = false; }}
					>
						<div class="flex items-center gap-3">
							<Star class="w-4 h-4 {activeFolderId === null && activeFolderName === 'Favoritas' ? 'text-amber-400' : 'text-brand-text-muted'}" />
							<span class="truncate">Favoritas & Ancladas</span>
						</div>
					</button>
				</li>
				{#each folders as folder}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<li class="group flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition-colors {activeFolderId === folder.id ? 'bg-brand-surface-elevated text-brand-text border border-brand-divider' : 'text-brand-text-muted hover:bg-brand-surface'} cursor-pointer" onclick={() => { activeFolderId = folder.id; activeFolderName = folder.name; showMobileFolders = false; }}>
						<div class="flex items-center gap-3 truncate">
							<Folder class="w-4 h-4 shrink-0 {activeFolderId === folder.id ? 'text-brand-accent' : 'text-brand-text-muted'}" />
							<span class="truncate {activeFolderId === folder.id ? 'text-brand-text' : 'group-hover:text-brand-text'}">{folder.name}</span>
						</div>
						<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
							<button class="p-1 rounded text-brand-text-muted hover:text-brand-text hover:bg-brand-divider transition-colors" title="Editar carpeta" onclick={(e) => { e.stopPropagation(); openEditFolderModal(folder); }}>
								<Edit2 class="w-3.5 h-3.5" />
							</button>
							<button class="p-1 rounded text-brand-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar carpeta" onclick={(e) => { e.stopPropagation(); confirmDeleteFolder(folder); }}>
								<Trash2 class="w-3.5 h-3.5" />
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</div>

		<div class="p-6 border-t border-brand-divider bg-[#070b0e] sticky bottom-0">
			<button class="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-divider border-dashed text-brand-text-muted hover:text-brand-text hover:border-brand-accent transition-colors text-xs font-bold shadow-inner bg-brand-surface/30" onclick={openNewFolderModal}>
				<Plus class="w-4 h-4" /> Nueva Carpeta
			</button>
		</div>
	</aside>

	<!-- Middle Column (Lista de Notas) -->
	<section class="w-full md:w-[380px] shrink-0 bg-[#0d1216] border-r border-brand-divider flex-col h-full z-20 transition-transform duration-300 md:translate-x-0 md:flex shadow-xl {showMobileList ? 'absolute inset-y-0 left-0 translate-x-0 flex' : 'absolute inset-y-0 left-0 -translate-x-full md:relative'}">
		<!-- Header -->
		<div class="p-6 pb-4 shrink-0 bg-[#0d1216] z-10 sticky top-0">
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center gap-3 truncate">
					<button class="md:hidden p-1.5 rounded-md text-brand-text-muted hover:text-brand-text hover:bg-brand-surface transition-colors shrink-0" onclick={() => showMobileFolders = true}>
						<Menu class="w-4 h-4" />
					</button>
					<h2 class="text-xl font-bold text-brand-text flex items-center gap-2 truncate">
						{activeFolderName}
					</h2>
				</div>
				<div class="flex items-center gap-2 shrink-0">
					<div class="flex items-center gap-1 bg-[#070b0e] p-1 rounded-lg border border-brand-divider">
						<button class="p-1 rounded-md transition-colors {viewMode === 'list' ? 'bg-brand-surface-elevated text-brand-accent border border-brand-divider shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}" onclick={() => viewMode = 'list'}><List class="w-4 h-4" /></button>
						<button class="p-1 rounded-md transition-colors {viewMode === 'grid' ? 'bg-brand-surface-elevated text-brand-accent border border-brand-divider shadow-sm' : 'text-brand-text-muted hover:text-brand-text'}" onclick={() => viewMode = 'grid'}><LayoutGrid class="w-4 h-4" /></button>
					</div>
					<button class="md:hidden p-1.5 rounded-md text-brand-text-muted hover:text-brand-text transition-colors" onclick={() => showMobileList = false}>
						<X class="w-5 h-5" />
					</button>
				</div>
			</div>
			
			<div class="relative flex gap-2">
				<div class="relative flex-1">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<Search class="w-4 h-4 text-brand-text-muted" />
					</div>
					<input 
						type="text" 
						bind:value={searchQuery}
						placeholder="Filtrar notas de esta lista..." 
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner"
					/>
				</div>
				<button class="px-3 py-2.5 bg-brand-accent hover:brightness-110 text-brand-bg rounded-xl font-bold transition-all shadow-[0_0_15px_var(--color-brand-accent-muted)] flex items-center justify-center shrink-0" onclick={createNewNote} title="Crear nueva nota">
					<Plus class="w-4 h-4" />
				</button>
			</div>
		</div>

		<!-- Lista de Notas -->
		<div class="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6">
			<!-- Pinned Section -->
			{#if filteredNotes.filter(n => n.pinned).length > 0}
				<h3 class="flex items-center gap-2 text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-3 px-2">
					<Star class="w-3 h-3 text-amber-400" fill="currentColor" /> ANCLADAS
				</h3>
				<div class="space-y-3 mb-8">
					{#each filteredNotes.filter(n => n.pinned) as note}
					<button 
						class="w-full text-left bg-[#070b0e] rounded-xl {viewMode === 'grid' ? 'p-4' : 'p-3'} border transition-colors group {note.id === activeNoteId ? 'border-brand-accent shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'border-brand-divider hover:border-brand-accent/50'}"
						onclick={() => { activeNoteId = note.id; showMobileList = false; }}
					>
						<div class="flex items-start justify-between {viewMode === 'grid' ? 'mb-2' : ''}">
							<h4 class="text-sm font-bold truncate pr-4 {note.id === activeNoteId ? 'text-brand-text' : 'text-brand-text group-hover:text-brand-accent'}">
								{note.isLocked ? '🔒 ' : ''}{note.title}
							</h4>
							<Star class="w-3.5 h-3.5 {note.pinned ? 'text-amber-400' : 'text-brand-text-muted opacity-0 group-hover:opacity-100'} shrink-0" fill={note.pinned ? 'currentColor' : 'none'} />
						</div>
						
						{#if viewMode === 'grid'}
							<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-2 mb-3">
								{note.excerpt}
							</p>
							<div class="flex items-center justify-between text-[10px] font-bold">
								<div class="flex items-center gap-3">
									<span class="text-brand-accent">{note.date}</span>
									{#if note.status}
										<span class="{note.statusColor || 'text-brand-text'}">{note.status}</span>
									{/if}
								</div>
								{#if note.sharedUsers && note.sharedUsers.length > 0}
									<div class="flex items-center -space-x-1.5 shrink-0">
										{#each note.sharedUsers.slice(0, 3) as user}
											<div class="w-5 h-5 rounded-full {user.color} flex items-center justify-center text-white text-[8px] font-bold border border-[#0d1216] shadow-sm relative z-10" title="Compartido">
												{user.avatar}
											</div>
										{/each}
										{#if note.sharedUsers.length > 3}
											<div class="w-5 h-5 rounded-full bg-brand-surface border border-brand-divider flex items-center justify-center text-brand-text-muted text-[8px] font-bold z-0">
												+{note.sharedUsers.length - 3}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex items-center justify-between text-[10px] font-medium mt-1">
								<span class="text-brand-text-muted">{note.date}</span>
								<div class="flex gap-2 items-center">
									{#if note.sharedUsers && note.sharedUsers.length > 0}
										<div class="flex items-center -space-x-1.5 mr-1">
											{#each note.sharedUsers.slice(0, 3) as user}
												<div class="w-5 h-5 rounded-full {user.color} flex items-center justify-center text-white text-[8px] font-bold border border-[#0d1216] shadow-sm relative z-10" title="Compartido">
													{user.avatar}
												</div>
											{/each}
											{#if note.sharedUsers.length > 3}
												<div class="w-5 h-5 rounded-full bg-brand-surface border border-brand-divider flex items-center justify-center text-brand-text-muted text-[8px] font-bold z-0">
													+{note.sharedUsers.length - 3}
												</div>
											{/if}
										</div>
									{/if}
									{#if note.status}
										<span class="{note.statusColor || 'text-brand-text'} font-bold">{note.status}</span>
									{/if}
								</div>
							</div>
						{/if}
					</button>
				{/each}
				</div>
			{/if}

			<!-- Normal Section -->
			{#if filteredNotes.filter(n => !n.pinned).length > 0}
				<h3 class="flex items-center gap-2 text-[10px] font-bold text-brand-text-muted tracking-widest uppercase mb-3 px-2">
					SEPTIEMBRE & AGOSTO 2026
				</h3>
				<div class="space-y-3">
					{#each filteredNotes.filter(n => !n.pinned) as note}
					<button 
						class="w-full text-left bg-[#070b0e] rounded-xl {viewMode === 'grid' ? 'p-4' : 'p-3'} border transition-colors group {note.id === activeNoteId ? 'border-brand-accent shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'border-brand-divider hover:border-brand-accent/50 shadow-sm'}"
						onclick={() => { activeNoteId = note.id; showMobileList = false; }}
					>
						<div class="flex items-start justify-between {viewMode === 'grid' ? 'mb-2' : ''}">
							<div class="min-w-0 pr-4">
								<h4 class="text-sm font-bold truncate {note.id === activeNoteId ? 'text-brand-text' : 'text-brand-text group-hover:text-brand-accent'}">
									{#if note.isLocked}<Lock class="w-3 h-3 inline-block mr-1 text-orange-400" />{/if}{note.title}
								</h4>
							</div>
							{#if note.status && viewMode === 'grid'}
								<span class="text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap {note.statusColor ? `${note.statusColor.replace('text-', 'bg-')}/10 border-${note.statusColor.replace('text-', '')}/20 ${note.statusColor}` : 'bg-brand-surface border-brand-divider text-brand-text'}">{note.status}</span>
							{/if}
						</div>
						
						{#if viewMode === 'grid'}
							<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-2 mb-3">
								{note.excerpt}
							</p>
							<div class="flex items-center justify-between text-[10px] font-bold">
								<span class="text-brand-text-muted">{note.date}</span>
								{#if note.sharedUsers && note.sharedUsers.length > 0}
									<div class="flex items-center -space-x-1.5 shrink-0">
										{#each note.sharedUsers.slice(0, 3) as user}
											<div class="w-5 h-5 rounded-full {user.color} flex items-center justify-center text-white text-[8px] font-bold border border-[#0d1216] shadow-sm relative z-10" title="Compartido">
												{user.avatar}
											</div>
										{/each}
										{#if note.sharedUsers.length > 3}
											<div class="w-5 h-5 rounded-full bg-brand-surface border border-brand-divider flex items-center justify-center text-brand-text-muted text-[8px] font-bold z-0">
												+{note.sharedUsers.length - 3}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex items-center justify-between text-[10px] font-medium mt-1">
								<span class="text-brand-text-muted">{note.date}</span>
								<div class="flex gap-2 items-center">
									{#if note.sharedUsers && note.sharedUsers.length > 0}
										<div class="flex items-center -space-x-1.5 mr-1">
											{#each note.sharedUsers.slice(0, 3) as user}
												<div class="w-5 h-5 rounded-full {user.color} flex items-center justify-center text-white text-[8px] font-bold border border-[#0d1216] shadow-sm relative z-10" title="Compartido">
													{user.avatar}
												</div>
											{/each}
											{#if note.sharedUsers.length > 3}
												<div class="w-5 h-5 rounded-full bg-brand-surface border border-brand-divider flex items-center justify-center text-brand-text-muted text-[8px] font-bold z-0">
													+{note.sharedUsers.length - 3}
												</div>
											{/if}
										</div>
									{/if}
									{#if note.status}
										<span class="font-bold {note.statusColor || 'text-brand-text'}">{note.status}</span>
									{/if}
								</div>
							</div>
						{/if}
					</button>
				{/each}
				</div>
			{/if}
			
			{#if filteredNotes.length === 0}
				<div class="text-center py-10 text-brand-text-muted text-sm font-medium">
					No se encontraron notas
				</div>
			{/if}
		</div>

		<!-- Footer Info -->
		<div class="p-3 bg-[#0d1216] border-t border-brand-divider text-[10px] font-medium text-brand-text-muted flex items-center justify-between z-10 sticky bottom-0">
			<span>Mostrando {filteredNotes.length} de {notes.length} notas</span>
			<span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Sincronizado 12:42</span>
		</div>
	</section>

	<!-- Right Column (Editor / Visor) -->
	<main class="flex-1 flex flex-col bg-[#070b0e] h-full relative z-0">
		
		<!-- Editor Topbar -->
		<header class="shrink-0 h-16 border-b border-brand-divider px-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<button class="p-2 rounded-lg text-brand-text hover:bg-brand-surface border border-brand-divider transition-colors md:hidden" onclick={() => showMobileList = true}>
					<List class="w-4 h-4" />
				</button>
				
				<div class="hidden sm:flex items-center gap-2 text-xs font-bold text-brand-accent bg-brand-accent/5 px-3 py-1.5 rounded-lg border border-brand-accent/20">
					<Folder class="w-4 h-4" /> {activeFolderName}
				</div>
				
				<div class="h-4 w-px bg-brand-divider mx-2 hidden sm:block"></div>
				<span class="flex items-center gap-1.5 text-[10px] font-semibold text-brand-text-muted">
					<span class="w-1.5 h-1.5 rounded-full bg-brand-text-muted/50"></span> {lastEditedText}
				</span>
			</div>

			<div class="flex items-center gap-3">
				<button class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-divider bg-[#0d1216] text-[11px] font-bold text-brand-text hover:border-brand-accent transition-colors shadow-inner" onclick={() => goto('/pomodoro')}>
					<Timer class="w-3.5 h-3.5 text-brand-accent" /> Foco Pomodoro
				</button>
				{#if activeNote}
					<button class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-brand-bg bg-brand-accent hover:brightness-110 transition-colors shadow-[0_0_15px_var(--color-brand-accent-muted)] flex items-center gap-2" onclick={saveActiveNote}>
						<Check class="w-3.5 h-3.5" strokeWidth={3} /> Guardar
					</button>
					<button class="p-2 rounded-lg transition-colors shadow-sm {activeNote.pinned ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20 hover:bg-amber-400/20' : 'text-brand-text-muted bg-[#0d1216] border border-brand-divider hover:text-brand-text'}" onclick={toggleActiveNotePinned} title={activeNote.pinned ? "Desanclar nota" : "Anclar nota"}>
						<Star class="w-4 h-4" fill={activeNote.pinned ? "currentColor" : "none"} />
					</button>
					<button class="p-2 rounded-lg text-brand-text-muted bg-[#0d1216] border border-brand-divider hover:text-brand-text transition-colors shadow-sm" onclick={shareActiveNote} title="Compartir nota">
						<Share2 class="w-4 h-4" />
					</button>
					<button class="p-2 rounded-lg text-red-400/70 bg-[#0d1216] border border-brand-divider hover:text-red-400 hover:bg-red-400/10 transition-colors shadow-sm" onclick={confirmDeleteNote} title="Eliminar nota">
						<Trash2 class="w-4 h-4" />
					</button>
				{/if}
			</div>
		</header>

		<!-- Editor Canvas -->
		<div class="flex-1 overflow-y-auto custom-scrollbar">
			{#if activeNote}
			<div class="max-w-3xl mx-auto px-8 py-12 pb-32">
				
				<!-- Titulo -->
				<h1 id="editor-title" class="text-4xl font-black text-brand-text tracking-tight mb-4 outline-none" contenteditable="true" spellcheck="false" onblur={(e) => {
					const index = notes.findIndex(n => n.id === activeNote.id);
					if (index !== -1) notes[index].title = e.currentTarget.textContent || 'Sin título';
				}} oninput={(e) => {
					const index = notes.findIndex(n => n.id === activeNote.id);
					if (index !== -1) notes[index].title = e.currentTarget.textContent || 'Sin título';
				}}>{activeNote.title}</h1>
				
				<!-- Metadatos de la nota -->
				<div class="flex flex-wrap items-center gap-3 mb-8 text-[11px] font-bold">
					<div class="flex items-center gap-2 text-brand-accent">
						<CalendarDays class="w-4 h-4" /> {activeNote.date}
					</div>
				</div>

				<!-- Toolbar Enriquecida -->
				<div id="toolbar-container" class="flex flex-wrap items-center gap-1 p-1 bg-[#0d1216] border border-brand-divider rounded-xl mb-8 w-fit shadow-lg sticky top-0 z-10 backdrop-blur-md fokuz-quill-toolbar">
					<div class="flex items-center gap-1 pr-2 border-r border-brand-divider">
						<button class="ql-bold p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" title="Negrita"><Bold class="w-4 h-4" /></button>
						<button class="ql-italic p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" title="Cursiva"><Italic class="w-4 h-4" /></button>
						<button class="ql-underline p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" title="Subrayado"><Underline class="w-4 h-4" /></button>
					</div>
					<div class="flex items-center gap-1 pl-2 pr-2 border-r border-brand-divider">
						<button class="ql-header p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" value="1" title="Título 1"><Heading1 class="w-4 h-4" /></button>
						<button class="ql-header p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" value="2" title="Título 2"><Heading2 class="w-4 h-4" /></button>
						<button class="ql-header p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" value="3" title="Título 3"><Heading3 class="w-4 h-4" /></button>
					</div>
					<div class="flex items-center gap-1 pl-2 pr-2 border-r border-brand-divider">
						<button class="ql-list px-3 py-1.5 flex items-center gap-2 rounded-lg bg-brand-surface-elevated text-brand-accent text-xs font-bold shadow-sm border border-brand-divider focus:outline-none" value="check" title="Lista de tareas"><CheckSquare class="w-4 h-4" /> Checklist</button>
						<button class="ql-align p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" value="center" title="Alineación Centro"><AlignLeft class="w-4 h-4" /></button>
						<button class="ql-code-block p-2 rounded-lg text-brand-text hover:bg-brand-surface transition-colors focus:outline-none" title="Código"><Code class="w-4 h-4" /></button>
					</div>
					<div class="flex items-center gap-1 pl-2">
						<button class="ql-blockquote px-3 py-1.5 flex items-center gap-2 rounded-lg text-amber-400 hover:bg-amber-400/10 text-xs font-bold transition-colors focus:outline-none" title="Destacado"><Target class="w-4 h-4" /> Idea clave</button>
					</div>
				</div>

				<!-- Contenido Enriquecido -->
				<div class="space-y-6 text-[15px] leading-relaxed text-brand-text prose prose-invert prose-brand max-w-none">
					<div use:quillAction class="min-h-[300px] pb-10"></div>
				</div>
			</div>
			{:else}
			<div class="flex items-center justify-center h-full">
				<div class="text-center">
					<div class="w-16 h-16 rounded-2xl bg-brand-surface border border-brand-divider flex items-center justify-center mx-auto mb-4 shadow-sm text-brand-text-muted">
						<Folder class="w-8 h-8" />
					</div>
					<h3 class="text-lg font-bold text-brand-text mb-2">Ninguna nota seleccionada</h3>
					<p class="text-sm font-medium text-brand-text-muted">Selecciona una nota de la lista para ver su contenido.</p>
				</div>
			</div>
			{/if}
	</main>
</div>

<!-- Modal Nueva Carpeta -->
{#if showNewFolderModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) showNewFolderModal = false }}>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-black">
			<div class="p-6">
				<h3 class="text-lg font-bold text-brand-text mb-4">Nueva Carpeta</h3>
				<input 
					type="text" 
					bind:value={newFolderName}
					placeholder="Nombre de la carpeta"
					class="w-full bg-[#070b0e] border border-brand-divider rounded-xl px-4 py-3 text-sm font-semibold text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner"
					onkeydown={(e) => { if(e.key === 'Enter') createFolder(); if(e.key === 'Escape') showNewFolderModal = false; }}
					autofocus
				/>
			</div>
			<div class="px-6 py-4 bg-brand-surface/30 border-t border-brand-divider flex justify-end gap-3">
				<button 
					class="px-4 py-2 rounded-xl text-sm font-bold text-brand-text-muted hover:text-brand-text transition-colors"
					onclick={() => showNewFolderModal = false}
					disabled={isCreatingFolder}
				>
					Cancelar
				</button>
				<button 
					class="px-4 py-2 rounded-xl text-sm font-bold bg-brand-accent text-brand-bg hover:brightness-110 transition-colors shadow-[0_0_15px_var(--color-brand-accent-muted)] disabled:opacity-50"
					onclick={createFolder}
					disabled={isCreatingFolder || !newFolderName.trim()}
				>
					{isCreatingFolder ? 'Creando...' : 'Crear Carpeta'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Toast Notification -->
{#if showShareToast}
	<div class="fixed top-24 right-10 bg-brand-accent text-brand-bg px-6 py-3 rounded-xl shadow-[0_0_20px_var(--color-brand-accent-muted)] z-50 flex items-center gap-3 font-bold text-sm transition-all duration-300">
		<Check class="w-5 h-5" strokeWidth={3} /> Compartida con éxito
	</div>
{/if}

<!-- Modal Eliminar Nota -->
{#if showDeleteModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) showDeleteModal = false }}>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-black">
			<div class="p-6">
				<div class="w-12 h-12 rounded-full bg-red-400/10 flex items-center justify-center mb-4">
					<Trash2 class="w-6 h-6 text-red-400" />
				</div>
				<h3 class="text-lg font-bold text-brand-text mb-2">Eliminar nota</h3>
				<p class="text-sm font-medium text-brand-text-muted">
					¿Estás seguro de que deseas eliminar la nota <span class="text-brand-text font-bold">"{activeNote?.title}"</span>? Esta acción no se puede deshacer.
				</p>
			</div>
			<div class="px-6 py-4 bg-brand-surface/30 border-t border-brand-divider flex justify-end gap-3">
				<button 
					class="px-4 py-2 rounded-xl text-sm font-bold text-brand-text-muted hover:text-brand-text transition-colors"
					onclick={() => showDeleteModal = false}
				>
					Cancelar
				</button>
				<button 
					class="px-4 py-2 rounded-xl text-sm font-bold bg-red-400 text-white hover:brightness-110 transition-colors shadow-[0_0_15px_rgba(248,113,113,0.4)]"
					onclick={deleteActiveNote}
				>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Save Toast Notification -->
{#if showSaveToast}
	<div class="fixed top-10 right-10 bg-brand-accent text-brand-bg px-6 py-3 rounded-xl shadow-[0_0_20px_var(--color-brand-accent-muted)] z-50 flex items-center gap-3 font-bold text-sm transition-all duration-300">
		<Check class="w-5 h-5" strokeWidth={3} /> Nota guardada correctamente
	</div>
{/if}

<!-- Modal Compartir Nota -->
{#if showShareModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onclick={(e) => { if (e.target === e.currentTarget) showShareModal = false }}>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-black">
			<div class="p-6 pb-4 border-b border-brand-divider">
				<div class="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center mb-4">
					<Share2 class="w-6 h-6 text-brand-accent" />
				</div>
				<h3 class="text-lg font-bold text-brand-text mb-1">Compartir nota</h3>
				<p class="text-sm font-medium text-brand-text-muted">
					Selecciona con quién deseas compartir "{activeNote?.title}".
				</p>
			</div>
			
			<div class="p-4 bg-brand-surface/30 border-b border-brand-divider">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
					<input 
						type="text" 
						bind:value={shareSearchQuery}
						placeholder="Buscar contactos de Fokuz..." 
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors shadow-inner"
					/>
				</div>
			</div>

			<div class="max-h-60 overflow-y-auto custom-scrollbar p-2">
				{#each filteredContacts as contact}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="flex items-center justify-between p-3 rounded-xl hover:bg-brand-surface cursor-pointer transition-colors" onclick={() => contact.selected = !contact.selected}>
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-full {contact.color} text-white font-bold flex items-center justify-center shadow-sm">
								{contact.avatar}
							</div>
							<div>
								<h4 class="text-sm font-bold text-brand-text">{contact.display_name}</h4>
								<p class="text-[10px] text-brand-text-muted font-medium">{contact.email}</p>
							</div>
						</div>
						<div class="w-5 h-5 rounded border {contact.selected ? 'bg-brand-accent border-brand-accent' : 'bg-transparent border-brand-divider'} flex items-center justify-center transition-colors">
							{#if contact.selected}
								<Check class="w-3.5 h-3.5 text-brand-bg" strokeWidth={3} />
							{/if}
						</div>
					</div>
				{/each}
				
				{#if filteredContacts.length === 0}
					<div class="text-center py-6 text-brand-text-muted text-sm font-medium">
						No se encontraron contactos.
					</div>
				{/if}
			</div>

			<div class="px-6 py-4 bg-brand-surface/30 border-t border-brand-divider flex justify-between items-center">
				<span class="text-xs font-bold text-brand-text-muted">
					{appContacts.filter(c => c.selected).length} seleccionado(s)
				</span>
				<div class="flex gap-3">
					<button 
						class="px-4 py-2 rounded-xl text-sm font-bold text-brand-text-muted hover:text-brand-text transition-colors"
						onclick={() => showShareModal = false}
					>
						Cancelar
					</button>
					<button 
						class="px-4 py-2 rounded-xl text-sm font-bold text-brand-bg transition-colors shadow-sm {appContacts.some(c => c.selected) ? 'bg-brand-accent hover:brightness-110 shadow-[0_0_15px_var(--color-brand-accent-muted)]' : 'bg-[#070b0e] border border-brand-divider text-brand-text-muted cursor-not-allowed'}"
						disabled={!appContacts.some(c => c.selected)}
						onclick={executeShare}
					>
						Compartir
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Editar Carpeta -->
{#if showEditFolderModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
		<div class="bg-[#070b0e] border border-brand-divider rounded-2xl p-6 w-full max-w-sm shadow-2xl">
			<h3 class="text-xl font-bold text-brand-text mb-4">Renombrar Carpeta</h3>
			<input 
				type="text" 
				bind:value={editFolderName}
				placeholder="Nuevo nombre..." 
				class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-sm font-semibold text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors mb-6 shadow-inner"
				onkeydown={(e) => e.key === 'Enter' && updateFolder()}
				autofocus
			/>
			<div class="flex gap-3">
				<button 
					class="flex-1 py-3 rounded-xl font-bold text-sm text-brand-text-muted hover:text-brand-text transition-colors"
					onclick={() => showEditFolderModal = false}
					disabled={isEditingFolder}
				>
					Cancelar
				</button>
				<button 
					class="flex-1 py-3 rounded-xl font-bold text-sm text-brand-bg bg-brand-accent hover:brightness-110 transition-colors shadow-[0_0_15px_var(--color-brand-accent-muted)] disabled:opacity-50 flex items-center justify-center gap-2"
					onclick={updateFolder}
					disabled={!editFolderName.trim() || isEditingFolder}
				>
					{#if isEditingFolder}
						<span class="w-4 h-4 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin"></span>
					{:else}
						Guardar
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Eliminar Carpeta -->
{#if showDeleteFolderModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
		<div class="bg-[#070b0e] border border-brand-divider rounded-2xl p-6 w-full max-w-sm shadow-2xl">
			<h3 class="text-xl font-bold text-brand-text mb-2">¿Eliminar carpeta?</h3>
			<p class="text-sm text-brand-text-muted mb-6">
				Las notas dentro de "{folderToDelete?.name}" no se eliminarán, pero dejarán de pertenecer a esta carpeta.
			</p>
			<div class="flex gap-3">
				<button 
					class="flex-1 py-3 rounded-xl font-bold text-sm text-brand-text-muted hover:text-brand-text transition-colors"
					onclick={() => showDeleteFolderModal = false}
					disabled={isDeletingFolder}
				>
					Cancelar
				</button>
				<button 
					class="flex-1 py-3 rounded-xl font-bold text-sm text-red-400 bg-red-400/10 border border-red-400/20 hover:bg-red-400/20 transition-colors flex items-center justify-center gap-2"
					onclick={deleteFolder}
					disabled={isDeletingFolder}
				>
					{#if isDeletingFolder}
						<span class="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></span>
					{:else}
						Eliminar
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
