<script lang="ts">
	import { page } from '$app/stores';
	import { 
		LineChart, Download, ChevronLeft, ChevronRight, TrendingUp, Plus,
		CreditCard, Home, Cloud, ShoppingCart, Zap, ShieldCheck, CheckCircle2,
		Info, Lock, Smartphone, RefreshCw, Wallet, PiggyBank, CalendarDays, Edit2, Trash2, AlertTriangle
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';

	// Estado
	let boards = $state<any[]>([]);
	let selectedBoard = $state<any>(null);
	let accounts = $state<any[]>([]);
	let categories = $state<any[]>([]);
	let subcategories = $state<any[]>([]);
	let transactions = $state<any[]>([]);

	// Derived KPIs
	let totalIngresos = $derived(transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0));
	let totalGastos = $derived(transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0));
	let balanceNeto = $derived(totalIngresos - totalGastos);

	function formatCOP(amount: number) {
		return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
	}

	let loading = $state(true);

	// Transaction Modal State
	let showTransactionModal = $state(false);
	let newTxType = $state('expense'); // 'income' or 'expense'
	let newTxAmount = $state('');
	let newTxDate = $state(new Date().toISOString().split('T')[0]);
	let newTxDesc = $state('');
	let newTxCategoryId = $state<number | ''>('');
	let newTxSubcategoryId = $state<number | ''>('');
	let newTxAccountId = $state<number | ''>('');
	let isSavingTx = $state(false);

	// Category Modal State
	let showCategoryModal = $state(false);
	let newCatName = $state('');
	let newCatType = $state('expense'); // 'income' or 'expense'
	let newSubcatName = $state('');
	let selectedParentCategoryId = $state<number | ''>('');
	let isSavingCat = $state(false);

	// Custom Dialog States
	let categoryToDelete = $state<number | null>(null);
	let subcategoryToDelete = $state<number | null>(null);
	let itemToEdit = $state<{id: number, type: 'category' | 'subcategory', name: string} | null>(null);
	let editItemName = $state('');

	async function deleteCategory(id: number) {
		categoryToDelete = id;
	}

	async function confirmDeleteCategory() {
		if (categoryToDelete === null) return;
		const id = categoryToDelete;
		categoryToDelete = null;
		const { error } = await supabase.from('finance_categories').delete().eq('id', id);
		if (error) alert('Error: ' + error.message);
		else loadBoardData(selectedBoard.id);
	}

	async function deleteSubcategory(id: number) {
		subcategoryToDelete = id;
	}

	async function confirmDeleteSubcategory() {
		if (subcategoryToDelete === null) return;
		const id = subcategoryToDelete;
		subcategoryToDelete = null;
		const { error } = await supabase.from('finance_subcategories').delete().eq('id', id);
		if (error) alert('Error: ' + error.message);
		else loadBoardData(selectedBoard.id);
	}

	async function editCategory(id: number, currentName: string) {
		itemToEdit = { id, type: 'category', name: currentName };
		editItemName = currentName;
	}

	async function editSubcategory(id: number, currentName: string) {
		itemToEdit = { id, type: 'subcategory', name: currentName };
		editItemName = currentName;
	}

	async function saveEditItem() {
		if (!itemToEdit || !editItemName.trim()) return;
		const { id, type, name } = itemToEdit;
		if (editItemName.trim() === name) {
			itemToEdit = null;
			return;
		}
		const table = type === 'category' ? 'finance_categories' : 'finance_subcategories';
		const { error } = await supabase.from(table).update({ name: editItemName.trim() }).eq('id', id);
		if (error) alert('Error: ' + error.message);
		else {
			loadBoardData(selectedBoard.id);
			itemToEdit = null;
		}
	}

	// Load Initial Data
	onMount(async () => {
		const boardId = Number($page.params.boardId);
		if (!boardId) return;

		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return;

		// 1. Fetch Board
		const { data: boardData } = await supabase
			.from('finance_boards')
			.select('*')
			.eq('id', boardId)
			.single();
		
		if (boardData) {
			selectedBoard = boardData;
			await loadBoardData(selectedBoard.id);
		} else {
			loading = false;
		}
	});

	async function loadBoardData(boardId: number) {
		loading = true;
		
		const [accRes, catRes, subcatRes, transRes] = await Promise.all([
			supabase.from('finance_accounts').select('*').eq('board_id', boardId),
			supabase.from('finance_categories').select('*').eq('board_id', boardId),
			supabase.from('finance_subcategories').select('*, finance_categories!inner(board_id)')
				.eq('finance_categories.board_id', boardId),
			supabase.from('finance_transactions').select('*').eq('board_id', boardId).order('date', { ascending: false })
		]);

		if (accRes.data) accounts = accRes.data;
		if (catRes.data) categories = catRes.data;
		if (subcatRes.data) subcategories = subcatRes.data.map(sc => ({ id: sc.id, name: sc.name, category_id: sc.category_id }));
		if (transRes.data) transactions = transRes.data;

		loading = false;
	}

	// Mock Data for Cash Flow Chart (Pending dynamic logic)
	const cashFlowDays = [
		{ day: '01', in: 100, out: 60, isToday: false },
		{ day: '04', in: 10, out: 20, isToday: false },
		{ day: '07', in: 0, out: 40, isToday: false },
		{ day: '10', in: 25, out: 20, isToday: false },
		{ day: '13', in: 20, out: 20, isToday: false },
		{ day: '16', in: 95, out: 20, isToday: true },
		{ day: '19', in: 10, out: 10, isToday: false },
		{ day: '22', in: 5, out: 15, isToday: false },
		{ day: '25', in: 0, out: 30, isToday: false },
		{ day: '28', in: 5, out: 10, isToday: false },
		{ day: '30', in: 10, out: 0, isToday: false }
	];

	function getCategoryIcon(type: string) {
		if (type === 'income') return Plus;
		return ShoppingCart;
	}

	function getCategoryColor(type: string) {
		if (type === 'income') return 'bg-emerald-500/10 text-emerald-400';
		return 'bg-amber-500/10 text-amber-400';
	}
</script>

<svelte:head>
	<title>Finanzas · Fokuz</title>
</svelte:head>

<div class="flex-1 overflow-y-auto bg-[#070b0e] text-brand-text p-6 md:p-8 pb-32">
	
	<!-- Header -->
	<header class="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-8">
		<div class="flex items-center gap-4">
			<div class="w-12 h-12 bg-brand-accent/10 border border-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent">
				<LineChart class="w-6 h-6" />
			</div>
			<div>
				<h1 class="text-2xl font-bold text-brand-text mb-1 flex items-center gap-3">
					Finanzas & Control
					<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-accent/20 text-brand-accent border border-brand-accent/30">Septiembre 2026</span>
				</h1>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<!-- Botón de Categorías -->
			<button 
				onclick={() => showCategoryModal = true}
				class="flex items-center gap-2 px-4 py-2 bg-[#0d1216] border border-brand-divider text-brand-text-muted hover:text-brand-text rounded-xl text-[11px] font-bold transition-colors"
			>
				<ShoppingCart class="w-4 h-4" /> Categorías
			</button>

			<div class="flex items-center bg-[#0d1216] border border-brand-divider rounded-xl p-1">
				<button class="p-1.5 text-brand-text-muted hover:text-brand-text transition-colors"><ChevronLeft class="w-4 h-4" /></button>
				<button class="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-brand-text hover:bg-brand-surface-elevated rounded-lg transition-colors">
					<CalendarDays class="w-3.5 h-3.5 text-brand-accent" /> 01 Sep - 30 Sep, 2026
				</button>
				<button class="p-1.5 text-brand-text-muted hover:text-brand-text transition-colors"><ChevronRight class="w-4 h-4" /></button>
			</div>
			<button class="flex items-center gap-2 px-4 py-2 bg-[#0d1216] border border-brand-divider text-brand-text-muted hover:text-brand-text rounded-xl text-[11px] font-bold transition-colors">
				<Download class="w-4 h-4" /> Exportar
			</button>
		</div>
	</header>

	<!-- KPI Summary Row -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
			<div class="absolute inset-0 bg-gradient-to-br from-brand-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
			<div class="relative z-10">
				<h3 class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Balance Neto Total</h3>
				<div class="text-2xl font-black text-brand-text mb-1">{formatCOP(balanceNeto)} <span class="text-sm font-bold text-brand-text-muted">COP</span></div>
			</div>
		</div>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
			<div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
			<div class="relative z-10">
				<h3 class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Ingresos del Mes</h3>
				<div class="text-2xl font-black text-emerald-400 mb-1">+{formatCOP(totalIngresos)} <span class="text-sm font-bold opacity-60">COP</span></div>
			</div>
		</div>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden group">
			<div class="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
			<div class="relative z-10">
				<h3 class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Gastos Acumulados</h3>
				<div class="text-2xl font-black text-red-400 mb-1">-{formatCOP(totalGastos)} <span class="text-sm font-bold opacity-60">COP</span></div>
			</div>
		</div>
	</div>

	<!-- Main Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Left Column: Charts & Transactions -->
		<div class="lg:col-span-8 flex flex-col gap-6">
			
			<!-- Ingresos List -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 shadow-sm">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-sm font-bold text-brand-text mb-1 flex items-center gap-2">Ingresos <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span></h2>
						<p class="text-[10px] text-brand-text-muted font-medium">Todos los ingresos registrados durante el mes</p>
					</div>
				</div>

				<div class="space-y-3">
					{#each transactions.filter(t => t.type === 'income') as t}
						{@const IconComponent = getCategoryIcon(t.type)}
						<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-xl p-4 hover:border-emerald-500/30 transition-colors group">
							<div class="flex items-center gap-4">
								<div class="w-10 h-10 rounded-xl {getCategoryColor(t.type)} flex items-center justify-center shrink-0">
									<IconComponent class="w-5 h-5" />
								</div>
								<div>
									<div class="flex items-center gap-2 mb-1">
										<h3 class="text-xs font-bold text-brand-text">{t.description || 'Ingreso'}</h3>
										<span class="px-1.5 py-0.5 rounded text-[8px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
											{categories.find(c => c.id === t.category_id)?.name || 'Sin categoría'}
										</span>
									</div>
									<p class="text-[10px] text-brand-text-muted font-medium">
										{new Date(t.date).toLocaleDateString()} <span class="opacity-50 mx-1">•</span> 
										{accounts.find(a => a.id === t.account_id)?.name || 'Sin método'}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-sm font-black mb-1 text-emerald-400">
									+{formatCOP(Number(t.amount))}
								</p>
								<p class="text-[9px] text-brand-text-muted font-bold">
									{subcategories.find(sc => sc.id === t.subcategory_id)?.name || ''}
								</p>
							</div>
						</div>
					{:else}
						<div class="text-center text-brand-text-muted text-xs py-10">No hay ingresos registrados en este mes.</div>
					{/each}
				</div>
			</div>

			<!-- Transactions List -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 shadow-sm">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-sm font-bold text-brand-text mb-1">Últimas Transacciones Registradas</h2>
						<p class="text-[10px] text-brand-text-muted font-medium">Movimientos bancarios, cobros automáticos y depósitos recientes</p>
					</div>
					<div class="flex items-center gap-1 bg-[#070b0e] border border-brand-divider rounded-xl p-1 text-[10px] font-bold">
						<button class="px-3 py-1.5 rounded-lg bg-brand-surface-elevated text-brand-accent shadow-sm">Todos (28)</button>
						<button class="px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text">Gastos</button>
						<button class="px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text">Ingresos</button>
						<button class="px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text">Recurrentes</button>
					</div>
				</div>

				<div class="space-y-3">
					{#each transactions as t}
						{@const IconComponent = getCategoryIcon(t.type)}
						<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-xl p-4 hover:border-brand-accent/30 transition-colors group">
							<div class="flex items-center gap-4">
								<div class="w-10 h-10 rounded-xl {getCategoryColor(t.type)} flex items-center justify-center shrink-0">
									<IconComponent class="w-5 h-5" />
								</div>
								<div>
									<div class="flex items-center gap-2 mb-1">
										<h3 class="text-xs font-bold text-brand-text">{t.description || (t.type === 'income' ? 'Ingreso' : 'Egreso')}</h3>
										<span class="px-1.5 py-0.5 rounded text-[8px] font-bold border {t.type === 'income' ? 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent' : 'bg-brand-surface border-brand-divider text-brand-text-muted'}">
											{categories.find(c => c.id === t.category_id)?.name || 'Sin categoría'}
										</span>
									</div>
									<p class="text-[10px] text-brand-text-muted font-medium">
										{new Date(t.date).toLocaleDateString()} <span class="opacity-50 mx-1">•</span> 
										{accounts.find(a => a.id === t.account_id)?.name || 'Sin método'}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-sm font-black mb-1 {t.type === 'income' ? 'text-brand-accent' : 'text-red-400'}">
									{t.type === 'income' ? '+' : '-'}{formatCOP(Number(t.amount))}
								</p>
								<p class="text-[9px] text-brand-text-muted font-bold">
									{subcategories.find(sc => sc.id === t.subcategory_id)?.name || ''}
								</p>
							</div>
						</div>
					{/each}
					{#if transactions.length === 0}
						<div class="p-6 text-center text-sm font-bold text-brand-text-muted">
							No hay transacciones registradas.
						</div>
					{/if}
				</div>

				<button class="w-full mt-4 py-3 rounded-xl border border-transparent hover:border-brand-divider text-[11px] font-bold text-brand-accent hover:bg-[#070b0e] transition-colors flex items-center justify-center gap-2">
					Ver todas las 28 transacciones de Septiembre <ChevronRight class="w-3.5 h-3.5" />
				</button>
			</div>
		</div>

		<!-- Right Column: Credits & Accounts -->
		<div class="lg:col-span-4 flex flex-col gap-6">
			
			<!-- Credits Tracker -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 shadow-sm">
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center gap-2">
						<h2 class="text-sm font-bold text-brand-text">Créditos & Cuotas</h2>
						<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">3 Activos</span>
					</div>
					<button class="text-[10px] font-bold text-brand-accent hover:brightness-110 transition-colors">+ Simular</button>
				</div>

				<!-- Global Debt Progress -->
				<div class="mb-6 pb-6 border-b border-brand-divider">
					<div class="flex items-center justify-between text-[10px] font-bold mb-2">
						<span class="text-brand-text-muted">Reducción total de deuda</span>
						<span class="text-brand-text">68.5% Amortizado</span>
					</div>
					<div class="h-1.5 w-full bg-[#070b0e] rounded-full overflow-hidden border border-brand-divider">
						<div class="h-full bg-brand-accent" style="width: 68.5%"></div>
					</div>
				</div>

				<div class="space-y-6">
					<!-- Credit 1 -->
					<div>
						<div class="flex items-start justify-between mb-2">
							<div>
								<p class="text-[8px] font-bold text-brand-text-muted uppercase tracking-widest mb-0.5">Tarjeta Revolvente</p>
								<p class="text-xs font-bold text-brand-text">Visa Platinum Fokuz</p>
							</div>
							<span class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-accent/10 border border-brand-accent/30 text-brand-accent">Ratio 28% (Óptimo)</span>
						</div>
						<div class="flex items-end justify-between mb-1.5">
							<p class="text-[9px] font-medium text-brand-text-muted">Utilizado / Límite</p>
							<p class="text-[9px] font-medium text-brand-text-muted text-right">Próximo Corte</p>
						</div>
						<div class="flex items-end justify-between mb-3">
							<p class="text-xs font-black text-brand-text">$1,420 <span class="text-[9px] font-medium text-brand-text-muted">/ $5,000</span></p>
							<p class="text-[10px] font-bold text-amber-400">24 Sept (en 8 días)</p>
						</div>
						<div class="h-1 w-full bg-[#070b0e] rounded-full overflow-hidden mb-3">
							<div class="h-full bg-amber-400" style="width: 28%"></div>
						</div>
						<div class="flex items-center justify-between mt-3 p-2 bg-[#070b0e] border border-brand-divider rounded-lg">
							<div>
								<p class="text-[8px] font-medium text-brand-text-muted">Pago sin intereses:</p>
								<p class="text-[11px] font-bold text-brand-text">$1,420.00</p>
							</div>
							<button class="px-3 py-1.5 rounded-md bg-brand-accent/10 text-[10px] font-bold text-brand-accent border border-brand-accent/30 hover:bg-brand-accent/20 transition-colors">Pagar Tarjeta</button>
						</div>
					</div>

					<div class="h-px w-full bg-brand-divider border-dashed border-t"></div>

					<!-- Credit 2 -->
					<div>
						<div class="flex items-start justify-between mb-2">
							<div>
								<p class="text-[8px] font-bold text-brand-accent uppercase tracking-widest mb-0.5">Crédito Hipotecario</p>
								<p class="text-xs font-bold text-brand-text">Apartamento Central</p>
							</div>
							<p class="text-[9px] font-bold text-brand-text-muted">Tasa: 5.2% TEA</p>
						</div>
						<div class="flex items-center justify-between mb-2 mt-4">
							<p class="text-[10px] font-bold text-brand-text">Saldo rest.: <span class="font-black text-xs">$10,200</span></p>
							<p class="text-[9px] text-brand-text-muted font-medium">Original: $65,000</p>
						</div>
						<div class="h-1.5 w-full bg-[#070b0e] rounded-full overflow-hidden mb-3">
							<div class="h-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.5)]" style="width: 84%"></div>
						</div>
						<div class="flex items-center justify-between text-[10px] font-bold">
							<p class="text-brand-text-muted">Cuota: <span class="text-brand-text">$680.00</span> / mes</p>
							<p class="text-amber-400">Próx: 01 Octubre</p>
						</div>
					</div>

					<div class="h-px w-full bg-brand-divider border-dashed border-t"></div>

					<!-- Credit 3 -->
					<div>
						<div class="flex items-start justify-between mb-2">
							<div>
								<p class="text-[8px] font-bold text-amber-400 uppercase tracking-widest mb-0.5">Préstamo Automotriz</p>
								<p class="text-xs font-bold text-brand-text">Vehículo Híbrido</p>
							</div>
							<p class="text-[8px] font-bold bg-brand-surface border border-brand-divider px-1.5 py-0.5 rounded text-brand-text-muted">Cuota 14/36</p>
						</div>
						<div class="flex items-center justify-between mb-2 mt-3">
							<p class="text-[10px] font-bold text-brand-text">Saldo rest.: <span class="font-black text-xs">$1,230</span></p>
							<p class="text-[9px] text-brand-text-muted font-medium">$280.00 / mes</p>
						</div>
						<div class="h-1 w-full bg-[#070b0e] rounded-full overflow-hidden mb-3">
							<div class="h-full bg-amber-400" style="width: 38%"></div>
						</div>
					</div>
				</div>

				<button class="w-full mt-6 p-3 bg-[#070b0e] border border-brand-divider rounded-xl hover:border-brand-accent/50 transition-colors flex items-center justify-between group">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-lg bg-brand-accent/10 text-brand-accent flex items-center justify-center">
							<Info class="w-4 h-4" />
						</div>
						<div class="text-left">
							<p class="text-[11px] font-bold text-brand-text">Simulador de Amortización</p>
							<p class="text-[9px] text-brand-text-muted">Calcula ahorro con pagos anticipados</p>
						</div>
					</div>
					<span class="text-[10px] font-bold text-brand-accent group-hover:translate-x-1 transition-transform">Abrir &rarr;</span>
				</button>
			</div>

			<!-- Accounts -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 shadow-sm">
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-sm font-bold text-brand-text">Cuentas & Billeteras</h2>
					<span class="text-[10px] text-brand-text-muted font-medium">3 vinculadas</span>
				</div>
				
				<div class="space-y-3">
					<div class="flex items-center justify-between bg-[#070b0e] p-3 rounded-xl border border-brand-divider hover:border-brand-accent/30 transition-colors">
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold text-[10px] flex items-center justify-center border border-emerald-500/20">
								CH
							</div>
							<div>
								<p class="text-xs font-bold text-brand-text">Cuenta Cheques Principal</p>
								<p class="text-[9px] text-brand-text-muted">**4891 • Débito activa</p>
							</div>
						</div>
						<div class="text-right">
							<p class="text-xs font-black text-brand-text mb-0.5">$5,600.00</p>
							<p class="text-[8px] font-bold text-brand-accent flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Conectado</p>
						</div>
					</div>

					<div class="flex items-center justify-between bg-[#070b0e] p-3 rounded-xl border border-brand-divider hover:border-brand-accent/30 transition-colors">
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-[10px] flex items-center justify-center border border-blue-500/20">
								EM
							</div>
							<div>
								<p class="text-xs font-bold text-brand-text">Fondo de Emergencia (Ahorro)</p>
								<p class="text-[9px] text-brand-text-muted">**2034 • Rendimiento 4.5%</p>
							</div>
						</div>
						<div class="text-right">
							<p class="text-xs font-black text-brand-text mb-0.5">$2,400.00</p>
							<p class="text-[8px] font-bold text-brand-accent flex items-center justify-end gap-1"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Conectado</p>
						</div>
					</div>

					<div class="flex items-center justify-between bg-[#070b0e] p-3 rounded-xl border border-brand-divider hover:border-brand-accent/30 transition-colors">
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 font-bold text-[10px] flex items-center justify-center border border-purple-500/20">
								CR
							</div>
							<div>
								<p class="text-xs font-bold text-brand-text">Billetera Inversiones / Crypto</p>
								<p class="text-[9px] text-brand-text-muted">Ledger Cold Storage</p>
							</div>
						</div>
						<div class="text-right">
							<p class="text-xs font-black text-brand-text mb-0.5">$450.00</p>
							<p class="text-[8px] font-bold text-brand-text-muted">Sinc manual</p>
						</div>
					</div>
				</div>

				<button class="w-full mt-4 py-2.5 rounded-xl border border-brand-divider border-dashed text-[10px] font-bold text-brand-text-muted hover:text-brand-text hover:border-brand-accent transition-colors">
					+ Vincular nueva cuenta bancaria
				</button>
			</div>
		</div>
	</div>

	<!-- Floating Add Button -->
	<button 
		onclick={() => {
			newTxType = 'expense';
			newTxAmount = '';
			newTxDesc = '';
			newTxDate = new Date().toISOString().split('T')[0];
			newTxCategoryId = '';
			newTxSubcategoryId = '';
			newTxAccountId = accounts.length > 0 ? accounts[0].id : '';
			showTransactionModal = true;
		}}
		class="fixed bottom-10 right-10 w-14 h-14 bg-brand-accent hover:brightness-110 text-brand-bg font-bold rounded-full flex items-center justify-center shadow-[0_0_20px_var(--color-brand-accent-muted)] hover:scale-105 transition-all z-20"
	>
		<Plus class="w-6 h-6" />
	</button>
</div>

{#if showTransactionModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
			<div class="p-5 border-b border-brand-divider bg-[#0d1216] flex justify-between items-center">
				<h2 class="text-lg font-bold text-brand-text">Nueva Transacción</h2>
				<button onclick={() => showTransactionModal = false} class="text-brand-text-muted hover:text-brand-text transition-colors">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>
			
			<div class="p-6 overflow-y-auto custom-scrollbar space-y-5">
				<!-- Type Toggle -->
				<div class="flex rounded-xl bg-[#070b0e] border border-brand-divider p-1">
					<button 
						class="flex-1 py-2 text-xs font-bold rounded-lg transition-colors {newTxType === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-brand-text-muted hover:text-brand-text'}"
						onclick={() => newTxType = 'expense'}
					>
						Egreso
					</button>
					<button 
						class="flex-1 py-2 text-xs font-bold rounded-lg transition-colors {newTxType === 'income' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-brand-text-muted hover:text-brand-text'}"
						onclick={() => newTxType = 'income'}
					>
						Ingreso
					</button>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Monto</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted font-bold">$</span>
							<input type="number" step="0.01" bind:value={newTxAmount} placeholder="0.00" class="w-full bg-[#0d1216] border border-brand-divider rounded-xl pl-7 pr-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none font-bold" />
						</div>
					</div>
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Fecha</label>
						<input type="date" bind:value={newTxDate} class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none" />
					</div>
				</div>

				<div>
					<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Descripción</label>
					<input type="text" bind:value={newTxDesc} placeholder="¿De qué trata esta transacción?" class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none" />
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Categoría</label>
						<select bind:value={newTxCategoryId} class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm appearance-none">
							<option value="">-- Seleccionar --</option>
							{#each categories.filter(c => c.type === newTxType) as cat}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Cuenta / Método</label>
						<select bind:value={newTxAccountId} class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm appearance-none">
							<option value="">-- Seleccionar --</option>
							{#each accounts as acc}
								<option value={acc.id}>{acc.name}</option>
							{/each}
						</select>
					</div>
				</div>
				
				{#if newTxCategoryId}
					{@const matchingSubcats = subcategories.filter(sc => sc.category_id === newTxCategoryId)}
					{#if matchingSubcats.length > 0}
						<div>
							<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Subcategoría</label>
							<select bind:value={newTxSubcategoryId} class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm appearance-none">
								<option value="">-- Seleccionar --</option>
								{#each matchingSubcats as sc}
									<option value={sc.id}>{sc.name}</option>
								{/each}
							</select>
						</div>
					{/if}
				{/if}
			</div>

			<div class="p-5 border-t border-brand-divider bg-[#0d1216] flex justify-end gap-3">
				<button onclick={() => showTransactionModal = false} class="px-5 py-2.5 rounded-xl font-semibold text-brand-text-muted hover:bg-brand-surface-elevated transition-colors">
					Cancelar
				</button>
				<button 
					onclick={async () => {
						if (!newTxAmount || isNaN(Number(newTxAmount))) {
							alert('Monto inválido');
							return;
						}
						isSavingTx = true;
						const txData = {
							board_id: selectedBoard.id,
							amount: Number(newTxAmount),
							type: newTxType,
							date: newTxDate,
							description: newTxDesc,
							category_id: newTxCategoryId || null,
							subcategory_id: newTxSubcategoryId || null,
							account_id: newTxAccountId || null
						};
						const { error } = await supabase.from('finance_transactions').insert([txData]);
						isSavingTx = false;
						if (error) {
							alert('Error: ' + error.message);
						} else {
							showTransactionModal = false;
							loadBoardData(selectedBoard.id);
						}
					}}
					disabled={isSavingTx || !newTxAmount}
					class="px-6 py-2.5 rounded-xl font-bold bg-brand-accent text-brand-bg hover:brightness-105 transition-all shadow-[0_0_10px_var(--color-brand-accent-muted)] disabled:opacity-50 flex items-center gap-2"
				>
					{isSavingTx ? 'Guardando...' : 'Guardar'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCategoryModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
			<div class="p-5 border-b border-brand-divider bg-[#0d1216] flex justify-between items-center">
				<h2 class="text-lg font-bold text-brand-text">Gestionar Categorías</h2>
				<button onclick={() => showCategoryModal = false} class="text-brand-text-muted hover:text-brand-text transition-colors">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>
			
			<div class="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
				
				<!-- Columna 1: Crear Categoría Principal -->
				<div class="space-y-6">
					<div>
						<h3 class="text-sm font-bold text-brand-accent mb-4">Nueva Categoría Padre</h3>
						
						<!-- Type Toggle -->
						<div class="flex rounded-xl bg-[#070b0e] border border-brand-divider p-1 mb-4">
							<button 
								class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors {newCatType === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-brand-text-muted hover:text-brand-text'}"
								onclick={() => newCatType = 'expense'}
							>
								Egreso
							</button>
							<button 
								class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors {newCatType === 'income' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-brand-text-muted hover:text-brand-text'}"
								onclick={() => newCatType = 'income'}
							>
								Ingreso
							</button>
						</div>

						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Nombre de la Categoría</label>
						<div class="flex gap-2">
							<input type="text" bind:value={newCatName} placeholder="Ej: Hogar, Salario..." class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm font-medium" />
							<button 
								disabled={isSavingCat || !newCatName.trim()}
								class="px-4 bg-brand-accent hover:brightness-110 text-brand-bg rounded-xl font-bold disabled:opacity-50 transition-all flex items-center justify-center"
								onclick={async () => {
									if (!newCatName.trim() || !selectedBoard) return;
									isSavingCat = true;
									const { error } = await supabase.from('finance_categories').insert([{
										board_id: selectedBoard.id,
										name: newCatName.trim(),
										type: newCatType
									}]);
									isSavingCat = false;
									if (error) alert('Error: ' + error.message);
									else {
										newCatName = '';
										loadBoardData(selectedBoard.id);
									}
								}}
							>
								<Plus class="w-4 h-4" />
							</button>
						</div>
					</div>

					<hr class="border-brand-divider" />

					<!-- Crear Subcategoría -->
					<div>
						<h3 class="text-sm font-bold text-brand-text mb-4">Nueva Subcategoría (Hija)</h3>
						
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Categoría Padre</label>
						<select bind:value={selectedParentCategoryId} class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 mb-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm appearance-none">
							<option value="">-- Seleccionar --</option>
							<optgroup label="Ingresos" class="bg-[#070b0e] text-emerald-400">
								{#each categories.filter(c => c.type === 'income') as cat}
									<option value={cat.id} class="text-brand-text">{cat.name}</option>
								{/each}
							</optgroup>
							<optgroup label="Egresos" class="bg-[#070b0e] text-red-400">
								{#each categories.filter(c => c.type === 'expense') as cat}
									<option value={cat.id} class="text-brand-text">{cat.name}</option>
								{/each}
							</optgroup>
						</select>

						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Nombre de Subcategoría</label>
						<div class="flex gap-2">
							<input type="text" bind:value={newSubcatName} placeholder="Ej: Servicios, Supermercado..." class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm font-medium" />
							<button 
								disabled={isSavingCat || !newSubcatName.trim() || !selectedParentCategoryId}
								class="px-4 bg-brand-surface-elevated hover:bg-brand-accent text-brand-text hover:text-brand-bg border border-brand-divider hover:border-transparent rounded-xl font-bold disabled:opacity-50 transition-all flex items-center justify-center"
								onclick={async () => {
									if (!newSubcatName.trim() || !selectedParentCategoryId) return;
									isSavingCat = true;
									const { error } = await supabase.from('finance_subcategories').insert([{
										category_id: selectedParentCategoryId,
										name: newSubcatName.trim()
									}]);
									isSavingCat = false;
									if (error) alert('Error: ' + error.message);
									else {
										newSubcatName = '';
										loadBoardData(selectedBoard.id);
									}
								}}
							>
								<Plus class="w-4 h-4" />
							</button>
						</div>
					</div>
				</div>

				<!-- Columna 2: Lista de Categorías Existentes -->
				<div class="bg-[#070b0e] border border-brand-divider rounded-xl p-4 overflow-y-auto max-h-[50vh] custom-scrollbar">
					<h3 class="text-sm font-bold text-brand-text mb-4 sticky top-0 bg-[#070b0e] py-1">Categorías Actuales</h3>
					
					{#if categories.length === 0}
						<div class="text-center text-brand-text-muted text-xs py-8">No hay categorías configuradas.</div>
					{/if}

					<div class="space-y-4">
						<!-- Ingresos -->
						{#if categories.some(c => c.type === 'income')}
							<div>
								<h4 class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Ingresos</h4>
								<div class="space-y-2">
									{#each categories.filter(c => c.type === 'income') as cat}
										{@const subcats = subcategories.filter(s => s.category_id === cat.id)}
										<div class="pl-2 border-l-2 border-emerald-500/30">
											<div class="text-sm font-bold text-brand-text flex justify-between items-center group">
												<span>{cat.name}</span>
												<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<button onclick={() => editCategory(cat.id, cat.name)} class="p-1 text-brand-text-muted hover:text-brand-text transition-colors"><Edit2 class="w-3 h-3" /></button>
													<button onclick={() => deleteCategory(cat.id)} class="p-1 text-brand-text-muted hover:text-red-400 transition-colors"><Trash2 class="w-3 h-3" /></button>
												</div>
											</div>
											<!-- Subcategories -->
											{#if subcats.length > 0}
												<div class="mt-1 space-y-1 pl-3">
													{#each subcats as subcat}
														<div class="text-[11px] text-brand-text-muted flex items-center justify-between group/sub">
															<span class="flex items-center gap-1.5"><div class="w-1 h-1 rounded-full bg-brand-divider"></div> {subcat.name}</span>
															<div class="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
																<button onclick={() => editSubcategory(subcat.id, subcat.name)} class="p-1 text-brand-text-muted hover:text-brand-text transition-colors"><Edit2 class="w-2.5 h-2.5" /></button>
																<button onclick={() => deleteSubcategory(subcat.id)} class="p-1 text-brand-text-muted hover:text-red-400 transition-colors"><Trash2 class="w-2.5 h-2.5" /></button>
															</div>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Egresos -->
						{#if categories.some(c => c.type === 'expense')}
							<div>
								<h4 class="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Egresos</h4>
								<div class="space-y-2">
									{#each categories.filter(c => c.type === 'expense') as cat}
										{@const subcats = subcategories.filter(s => s.category_id === cat.id)}
										<div class="pl-2 border-l-2 border-red-500/30">
											<div class="text-sm font-bold text-brand-text flex justify-between items-center group">
												<span>{cat.name}</span>
												<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
													<button onclick={() => editCategory(cat.id, cat.name)} class="p-1 text-brand-text-muted hover:text-brand-text transition-colors"><Edit2 class="w-3 h-3" /></button>
													<button onclick={() => deleteCategory(cat.id)} class="p-1 text-brand-text-muted hover:text-red-400 transition-colors"><Trash2 class="w-3 h-3" /></button>
												</div>
											</div>
											<!-- Subcategories -->
											{#if subcats.length > 0}
												<div class="mt-1 space-y-1 pl-3">
													{#each subcats as subcat}
														<div class="text-[11px] text-brand-text-muted flex items-center justify-between group/sub">
															<span class="flex items-center gap-1.5"><div class="w-1 h-1 rounded-full bg-brand-divider"></div> {subcat.name}</span>
															<div class="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
																<button onclick={() => editSubcategory(subcat.id, subcat.name)} class="p-1 text-brand-text-muted hover:text-brand-text transition-colors"><Edit2 class="w-2.5 h-2.5" /></button>
																<button onclick={() => deleteSubcategory(subcat.id)} class="p-1 text-brand-text-muted hover:text-red-400 transition-colors"><Trash2 class="w-2.5 h-2.5" /></button>
															</div>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Modal de Edición de Categoría/Subcategoría -->
{#if itemToEdit}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl">
			<h3 class="text-lg font-bold text-brand-text mb-4">
				Editar {itemToEdit.type === 'category' ? 'Categoría' : 'Subcategoría'}
			</h3>
			<div>
				<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Nuevo Nombre</label>
				<input 
					type="text" 
					bind:value={editItemName} 
					onkeydown={(e) => e.key === 'Enter' && saveEditItem()}
					class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none text-sm font-medium mb-6" 
					autofocus 
				/>
			</div>
			<div class="flex justify-end gap-3">
				<button 
					onclick={() => itemToEdit = null}
					class="px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" 
				>
					Cancelar
				</button>
				<button 
					disabled={!editItemName.trim()}
					onclick={saveEditItem}
					class="px-4 py-2 bg-brand-accent text-brand-bg font-bold rounded-xl hover:brightness-105 transition-colors disabled:opacity-50" 
				>
					Guardar Cambios
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Confirmar Eliminación Categoría -->
{#if categoryToDelete !== null}
	<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar Categoría?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Esta categoría y <strong>todas sus subcategorías</strong> serán eliminadas permanentemente y se desvincularán de las transacciones.</p>
			<div class="flex justify-center gap-3 w-full">
				<button 
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" 
					onclick={() => categoryToDelete = null}>
					Cancelar
				</button>
				<button 
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
					onclick={confirmDeleteCategory}>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Confirmar Eliminación Subcategoría -->
{#if subcategoryToDelete !== null}
	<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar Subcategoría?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Esta subcategoría será eliminada permanentemente y se desvinculará de las transacciones.</p>
			<div class="flex justify-center gap-3 w-full">
				<button 
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" 
					onclick={() => subcategoryToDelete = null}>
					Cancelar
				</button>
				<button 
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
					onclick={confirmDeleteSubcategory}>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}
