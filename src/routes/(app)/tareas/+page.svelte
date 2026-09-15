<script lang="ts">
	import { Plus, MoreVertical, Trash2, Edit2, Columns, Calendar, List as ListIcon, AlertTriangle, Clock } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';

	type Board = {
		id: number;
		title: string;
		color: string;
		created_at: string;
		shared_with_ids?: string[];
	};

	type Contact = {
		id: string;
		email: string;
		display_name: string;
		nickname: string;
	};

	let boards = $state<Board[]>([]);
	let contacts = $state<Contact[]>([]);
	let selectedContactIds = $state<string[]>([]);
	
	let loading = $state(true);
	let showModal = $state(false);
	let editBoardId = $state<number | null>(null);
	
	let boardTitle = $state('');
	let boardColor = $state('#0ea5e9'); // default color
	let isShared = $state(false);
	const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

	async function fetchBoards() {
		loading = true;
		if (!supabase) return;
		
		const { data, error } = await supabase
			.from('boards')
			.select('*')
			.order('created_at', { ascending: true });
			
		if (error) {
			console.error('Error fetching boards:', error);
		} else {
			const { data: shares } = await supabase
				.from('board_shares')
				.select('board_id, shared_with');
				
			const shareMap = new Map<number, string[]>();
			if (shares) {
				shares.forEach(s => {
					if (!shareMap.has(s.board_id)) shareMap.set(s.board_id, []);
					shareMap.get(s.board_id)!.push(s.shared_with);
				});
			}
			
			boards = (data || []).map(b => ({
				...b,
				shared_with_ids: shareMap.get(b.id) || []
			}));
		}
		loading = false;
	}

	async function loadContacts() {
		if (!supabase) return;
		let rowsResult = await supabase
			.from('contacts')
			.select('contact_user_id, nickname')
			.order('created_at', { ascending: false });

		if (rowsResult.error && /nickname/i.test(rowsResult.error.message)) {
			rowsResult = await supabase
				.from('contacts')
				.select('contact_user_id')
				.order('created_at', { ascending: false });
		}

		const rows = rowsResult.data || [];
		if (rows.length === 0) return;

		const ids = rows.map((r) => r.contact_user_id);
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, email, display_name')
			.in('id', ids);

		const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
		contacts = rows.map((row) => {
			const profile = profileMap.get(row.contact_user_id);
			return {
				id: row.contact_user_id,
				email: profile?.email || 'Contacto',
				nickname: (row as any).nickname || '',
				display_name: profile?.display_name || profile?.email?.split('@')[0] || 'Contacto'
			};
		});
	}

	$effect(() => {
		fetchBoards();
		loadContacts();
	});

	function openCreateModal() {
		boardTitle = '';
		boardColor = COLORS[0];
		isShared = false;
		selectedContactIds = [];
		editBoardId = null;
		showModal = true;
	}

	function openEditModal(board: Board) {
		boardTitle = board.title;
		boardColor = board.color;
		selectedContactIds = [...(board.shared_with_ids || [])];
		isShared = selectedContactIds.length > 0;
		editBoardId = board.id;
		showModal = true;
	}

	async function saveBoard() {
		if (!boardTitle.trim()) return;
		if (!supabase) return;

		const { data: { session } } = await supabase.auth.getSession();
		if (!session) return;

		if (editBoardId) {
			// Update
			const { error } = await supabase
				.from('boards')
				.update({ title: boardTitle.trim(), color: boardColor })
				.eq('id', editBoardId);
				
			if (error) {
				alert('Error al actualizar tablero: ' + error.message);
			} else {
				// Update shares
				await supabase.from('board_shares').delete().eq('board_id', editBoardId);
				if (isShared && selectedContactIds.length > 0) {
					const shares = selectedContactIds.map(id => ({ board_id: editBoardId, shared_with: id }));
					await supabase.from('board_shares').insert(shares);
				}
				
				fetchBoards();
				showModal = false;
			}
		} else {
			// Create
			const { data, error } = await supabase
				.from('boards')
				.insert([{ title: boardTitle.trim(), color: boardColor, user_id: session.user.id }])
				.select();
				
			if (error) {
				alert('Error al crear tablero: ' + error.message);
			} else if (data && data.length > 0) {
				if (isShared && selectedContactIds.length > 0) {
					const newBoardId = data[0].id;
					const shares = selectedContactIds.map(id => ({ board_id: newBoardId, shared_with: id }));
					await supabase.from('board_shares').insert(shares);
				}
				fetchBoards();
				showModal = false;
			}
		}
	}

	let boardToDelete = $state<number | null>(null);

	async function requestDeleteBoard(id: number) {
		boardToDelete = id;
	}

	async function confirmDeleteBoard() {
		if (boardToDelete === null) return;
		const id = boardToDelete;
		boardToDelete = null;

		if (!supabase) return;
		if (!supabase) return;
		const { error } = await supabase.from('boards').delete().eq('id', id);
		if (error) {
			alert('Error al eliminar: ' + error.message);
		} else {
			fetchBoards();
		}
	}

	function goToBoard(id: number) {
		goto(`/tareas/${id}`);
	}
</script>

<svelte:head>
	<title>Mis Tableros · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden p-4 md:p-6">
	<header class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
		<div>
			<h1 class="text-2xl font-bold text-brand-text mb-1">Mis Tableros</h1>
			<p class="text-sm text-brand-text-muted">Gestiona tus proyectos y áreas de enfoque</p>
		</div>
		<div class="flex flex-wrap items-center gap-2 md:gap-3">
			<button
				onclick={() => goto('/tareas/calendario')}
				class="flex items-center justify-center p-2 rounded-lg border border-brand-divider text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors"
				aria-label="Calendario Global"
				title="Calendario Global"
			>
				<Calendar class="w-5 h-5" />
			</button>
			<button
				onclick={() => goto('/tareas/hoy')}
				class="flex items-center gap-2 p-2 rounded-lg border border-brand-divider text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors"
				aria-label="Tareas de Hoy"
				title="Tareas de Hoy"
			>
				<Clock class="w-5 h-5" />
				<span class="text-sm font-bold pr-1">Hoy</span>
			</button>
			<button 
				onclick={openCreateModal}
				class="flex items-center gap-2 px-4 py-2 rounded-lg text-brand-bg bg-brand-accent hover:brightness-105 shadow-[0_0_10px_var(--color-brand-accent-muted)] font-bold transition-all"
			>
				<Plus class="w-5 h-5" /> Nuevo Tablero
			</button>
		</div>
	</header>

	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
		</div>
	{:else if boards.length === 0}
		<div class="flex-1 flex flex-col items-center justify-center text-brand-text-muted">
			<Columns class="w-16 h-16 mb-4 opacity-50" />
			<h2 class="text-xl font-semibold mb-2 text-brand-text">Aún no tienes tableros</h2>
			<p class="mb-6 max-w-md text-center">Crea tu primer tablero para organizar tus tareas por proyectos, áreas de vida o equipos.</p>
			<button 
				onclick={openCreateModal}
				class="flex items-center gap-2 px-6 py-3 rounded-lg text-brand-bg bg-brand-accent font-bold transition-all"
			>
				<Plus class="w-5 h-5" /> Crear mi primer tablero
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pb-8">
			{#each boards as board}
				<div 
					class="bg-brand-surface border border-brand-divider rounded-xl p-5 hover:border-brand-accent/50 transition-all group relative cursor-pointer shadow-lg hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
					onclick={() => goToBoard(board.id)}
				>
					<div class="flex items-start justify-between mb-4">
						<div class="flex items-center gap-3">
							<div class="w-4 h-4 rounded-full" style="background-color: {board.color}"></div>
							<h3 class="font-bold text-lg text-brand-text group-hover:text-brand-accent transition-colors">{board.title}</h3>
						</div>
						
						<div class="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div 
								class="p-2 hover:bg-brand-surface-elevated rounded-md text-brand-text-muted hover:text-brand-text transition-colors"
								onclick={(e) => { e.stopPropagation(); openEditModal(board); }}
								title="Editar tablero"
							>
								<Edit2 class="w-4 h-4" />
							</div>
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div 
								class="p-2 hover:bg-brand-surface-elevated rounded-md text-brand-text-muted hover:text-red-400 transition-colors"
								onclick={(e) => { e.stopPropagation(); requestDeleteBoard(board.id); }}
								title="Eliminar tablero"
							>
								<Trash2 class="w-4 h-4" />
							</div>
						</div>
					</div>
					
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4 text-xs font-semibold text-brand-text-muted">
							<span class="flex items-center gap-1.5"><Columns class="w-3.5 h-3.5" /> Kanban</span>
							<span class="flex items-center gap-1.5"><ListIcon class="w-3.5 h-3.5" /> Lista</span>
							<span class="flex items-center gap-1.5"><Calendar class="w-3.5 h-3.5" /> Calendario</span>
						</div>

						{#if board.shared_with_ids && board.shared_with_ids.length > 0}
							<div class="flex items-center -space-x-2">
								<div class="w-6 h-6 rounded-full bg-brand-accent/20 border border-[#070b0e] flex items-center justify-center text-[9px] font-bold text-brand-accent relative z-10" title="Propietario">
									Tú
								</div>
								{#each board.shared_with_ids.slice(0, 3) as contactId, i}
									{@const c = contacts.find(x => x.id === contactId)}
									{#if c}
										<div class="w-6 h-6 rounded-full bg-brand-surface-elevated border border-[#070b0e] flex items-center justify-center text-[9px] font-bold text-brand-text-muted relative" style="z-index: {9 - i}" title={c.display_name}>
											{c.nickname ? c.nickname.substring(0, 2).toUpperCase() : c.display_name.substring(0, 2).toUpperCase()}
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onclick={() => showModal = false}>
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-md shadow-2xl p-6" onclick={e => e.stopPropagation()}>
			<h2 class="text-xl font-bold text-brand-text mb-6">{editBoardId ? 'Editar Tablero' : 'Nuevo Tablero'}</h2>
			
			<div class="space-y-5">
				<div>
					<label for="board-title" class="block text-sm font-semibold text-brand-text-muted mb-2">Nombre del Tablero</label>
					<input 
						id="board-title"
						type="text" 
						bind:value={boardTitle}
						placeholder="Ej. Proyecto Fokuz, Finanzas..."
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-accent transition-colors"
						autofocus
					/>
				</div>
				
				<div>
					<label class="block text-sm font-semibold text-brand-text-muted mb-2">Color del Tablero</label>
					<div class="flex gap-3">
						{#each COLORS as color}
							<button 
								class="w-8 h-8 rounded-full border-2 transition-transform {boardColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}"
								style="background-color: {color}"
								onclick={() => boardColor = color}
								aria-label="Seleccionar color {color}"
							></button>
						{/each}
					</div>
				</div>

				<div>
					<label class="flex items-center gap-3 cursor-pointer p-3 border border-brand-divider rounded-xl hover:bg-brand-surface-elevated transition-colors">
						<input type="checkbox" bind:checked={isShared} class="w-4 h-4 rounded border-brand-divider text-brand-accent focus:ring-brand-accent bg-[#070b0e] cursor-pointer" />
						<div class="flex flex-col">
							<span class="text-sm font-bold text-brand-text">Tablero Colaborativo</span>
							<span class="text-[11px] text-brand-text-muted font-medium">Invita a otros a ver y editar tareas</span>
						</div>
					</label>
					
					{#if isShared}
						<div class="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
							<label class="block text-xs font-semibold text-brand-text-muted mb-2">Selecciona contactos para invitar</label>
							{#if contacts.length === 0}
								<div class="text-sm text-brand-text-muted p-3 bg-[#070b0e] border border-brand-divider rounded-xl">
									Aún no tienes contactos. <a href="/perfil" class="text-brand-accent hover:underline">Ir al perfil para agregar</a>.
								</div>
							{:else}
								<div class="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-1 pr-2">
									{#each contacts as contact}
										<label class="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-brand-surface-elevated transition-colors border border-transparent hover:border-brand-divider">
											<input 
												type="checkbox" 
												value={contact.id}
												bind:group={selectedContactIds}
												class="w-4 h-4 rounded border-brand-divider text-brand-accent focus:ring-brand-accent bg-[#070b0e]" 
											/>
											<div class="flex flex-col min-w-0">
												<span class="text-sm font-medium text-brand-text truncate">{contact.nickname || contact.display_name}</span>
												<span class="text-[11px] text-brand-text-muted truncate">{contact.email}</span>
											</div>
										</label>
									{/each}
								</div>
							{/if}
							<p class="text-[10px] text-brand-accent mt-2 font-medium ml-1">Próximamente: Las invitaciones se enviarán automáticamente al crear.</p>
						</div>
					{/if}
				</div>
			</div>
			
			<div class="flex justify-end gap-3 mt-8">
				<button 
					onclick={() => showModal = false}
					class="px-5 py-2.5 rounded-xl font-semibold text-brand-text-muted hover:bg-brand-surface-elevated transition-colors"
				>
					Cancelar
				</button>
				<button 
					onclick={saveBoard}
					disabled={!boardTitle.trim()}
					class="px-5 py-2.5 rounded-xl font-bold bg-brand-accent text-brand-bg hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
				>
					{editBoardId ? 'Guardar Cambios' : 'Crear Tablero'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Confirmar Eliminación de Tablero -->
{#if boardToDelete !== null}
	<div class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar Tablero?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Este tablero y todas sus tareas serán eliminados permanentemente y no podrán recuperarse.</p>
			<div class="flex justify-center gap-3 w-full">
				<button 
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" 
					onclick={() => boardToDelete = null}>
					Cancelar
				</button>
				<button 
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
					onclick={confirmDeleteBoard}>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}
