<script lang="ts">
	import { Plus, Trash2, Edit2, Columns, AlertTriangle, LineChart } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabaseClient';
	import { onMount } from 'svelte';

	type FinanceBoard = {
		id: number;
		title: string;
		description: string;
		created_at: string;
	};

	let boards = $state<FinanceBoard[]>([]);
	let loading = $state(true);
	let showModal = $state(false);
	let editBoardId = $state<number | null>(null);
	
	let boardTitle = $state('');
	let boardDescription = $state('');

	async function fetchBoards() {
		loading = true;
		if (!supabase) return;
		
		const { data, error } = await supabase
			.from('finance_boards')
			.select('*')
			.order('created_at', { ascending: true });
			
		if (error) {
			console.error('Error fetching finance boards:', error);
		} else {
			boards = data || [];
		}
		loading = false;
	}

	onMount(() => {
		fetchBoards();
	});

	function openCreateModal() {
		boardTitle = '';
		boardDescription = '';
		editBoardId = null;
		showModal = true;
	}

	function openEditModal(board: FinanceBoard) {
		boardTitle = board.title;
		boardDescription = board.description || '';
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
				.from('finance_boards')
				.update({ title: boardTitle.trim(), description: boardDescription.trim() })
				.eq('id', editBoardId);
				
			if (error) {
				alert('Error al actualizar tablero: ' + error.message);
			} else {
				fetchBoards();
				showModal = false;
			}
		} else {
			// Create
			const { error } = await supabase
				.from('finance_boards')
				.insert([{ title: boardTitle.trim(), description: boardDescription.trim(), user_id: session.user.id }]);
				
			if (error) {
				alert('Error al crear tablero: ' + error.message);
			} else {
				fetchBoards();
				showModal = false;
			}
		}
	}

	let boardToDelete = $state<number | null>(null);

	function requestDeleteBoard(id: number) {
		boardToDelete = id;
	}

	async function confirmDeleteBoard() {
		if (boardToDelete === null) return;
		const id = boardToDelete;
		boardToDelete = null;

		if (!supabase) return;
		const { error } = await supabase.from('finance_boards').delete().eq('id', id);
		if (error) {
			alert('Error al eliminar: ' + error.message);
		} else {
			fetchBoards();
		}
	}

	function goToBoard(id: number) {
		goto(`/finanzas/${id}`);
	}
</script>

<svelte:head>
	<title>Mis Finanzas · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden p-4 md:p-6">
	<header class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
		<div>
			<h1 class="text-2xl font-bold text-brand-text mb-1">Tableros de Finanzas</h1>
			<p class="text-sm text-brand-text-muted">Gestiona tus presupuestos, ingresos y gastos</p>
		</div>
		<div class="flex flex-wrap items-center gap-2 md:gap-3">
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
			<LineChart class="w-16 h-16 mb-4 opacity-50" />
			<h2 class="text-xl font-semibold mb-2 text-brand-text">Aún no tienes tableros financieros</h2>
			<p class="mb-6 max-w-md text-center">Crea tu primer tablero para llevar el control de tus ingresos, gastos y presupuestos mensuales.</p>
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
					<div class="flex items-start justify-between mb-2">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-lg bg-brand-accent/10 flex items-center justify-center text-brand-accent shrink-0">
								<LineChart class="w-5 h-5" />
							</div>
							<div>
								<h3 class="font-bold text-lg text-brand-text group-hover:text-brand-accent transition-colors">{board.title}</h3>
								<p class="text-xs text-brand-text-muted line-clamp-1">{board.description || 'Sin descripción'}</p>
							</div>
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
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onclick={() => showModal = false}>
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-md shadow-2xl p-6" onclick={e => e.stopPropagation()}>
			<h2 class="text-xl font-bold text-brand-text mb-6">{editBoardId ? 'Editar Tablero' : 'Nuevo Tablero Financiero'}</h2>
			
			<div class="space-y-5">
				<div>
					<label for="board-title" class="block text-sm font-semibold text-brand-text-muted mb-2">Nombre del Tablero</label>
					<input 
						id="board-title"
						type="text" 
						bind:value={boardTitle}
						placeholder="Ej. Finanzas Personales 2026..."
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-accent transition-colors"
						autofocus
					/>
				</div>
				<div>
					<label for="board-desc" class="block text-sm font-semibold text-brand-text-muted mb-2">Descripción (Opcional)</label>
					<textarea 
						id="board-desc"
						bind:value={boardDescription}
						placeholder="Ej. Presupuesto para la casa..."
						class="w-full bg-[#070b0e] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:outline-none focus:border-brand-accent transition-colors resize-none h-24"
					></textarea>
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
	<div class="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar Tablero?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Este tablero y todas sus transacciones serán eliminados permanentemente y no podrán recuperarse.</p>
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
