<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		CalendarDays,
		Plus,
		Pencil,
		Tags,
		Trash2,
		LogOut,
		Users,
		MoreVertical,
		Download,
		TrendingUp,
		TrendingDown,
		ArrowDownLeft,
		ArrowUpRight,
		PiggyBank,
		BarChart3,
		PieChart,
		ShieldCheck,
		CircleCheck,
		CircleAlert,
		Search,
		Target
	} from '@lucide/svelte';
	import { supabase } from '$lib/supabaseClient';
	import { downloadXlsx, type CellValue } from '$lib/xlsx';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import QuickEntrySheet from '$lib/components/finanzas/QuickEntrySheet.svelte';
	import CategoriesSheet from '$lib/components/finanzas/CategoriesSheet.svelte';
	import BoardFormSheet from '$lib/components/finanzas/BoardFormSheet.svelte';
	import BudgetSheet from '$lib/components/finanzas/BudgetSheet.svelte';
	import WeeklyFlowChart from '$lib/components/finanzas/WeeklyFlowChart.svelte';
	import SpendingDonut from '$lib/components/finanzas/SpendingDonut.svelte';
	import {
		CHART,
		DEFAULT_SAVING_CATEGORIES,
		MONTHS,
		PAYMENT_METHODS,
		TX_TYPES,
		budgetTone as toneOf,
		formatCOP,
		monthStartISO,
		todayISO,
		type BoardMember,
		type FinanceCategory,
		type FinanceSubcategory,
		type FinanceTransaction,
		type SpendSlice,
		type TxType,
		type WeekBucket,
		balanceAt,
		signedAmount,
		balanceDeltaPct,
		pctChange,
		projectedMonthClose,
		savingsRatePct,
		sumByType,
		txInRange
	} from '$lib/finance';

	type Board = {
		id: number;
		title: string;
		description: string | null;
		color: string;
		initial_balance: number;
		monthly_budget: number;
		savings_goal_pct: number;
		user_id: string;
	};

	const PAGE_SIZE = 10;
	const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

	const boardId = $derived(Number(page.params.boardId));

	let board = $state<Board | null>(null);
	let categories = $state<FinanceCategory[]>([]);
	let subcategories = $state<FinanceSubcategory[]>([]);
	let transactions = $state<FinanceTransaction[]>([]);
	let members = $state<BoardMember[]>([]);
	let myId = $state<string | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let missing026 = $state(false);

	const now = new Date();
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth());

	// Movimientos: filtro, búsqueda y paginación
	let filter = $state<'all' | TxType>('all');
	let query = $state('');
	let pageIndex = $state(0);

	// Hojas / modales
	let entryOpen = $state(false);
	let entryType = $state<TxType>('expense');
	let editingTx = $state<FinanceTransaction | null>(null);
	let txToDelete = $state<FinanceTransaction | null>(null);
	let categoriesOpen = $state(false);
	let boardFormOpen = $state(false);
	let budgetOpen = $state(false);
	let menuOpen = $state(false);
	let confirmDeleteBoard = $state(false);
	let confirmLeave = $state(false);
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	// ---------- Derivados base ----------
	const isOwner = $derived(!!board && board.user_id === myId);
	const isShared = $derived(members.length > 1);
	const catMap = $derived(new Map(categories.map((c) => [c.id, c])));
	const subMap = $derived(new Map(subcategories.map((s) => [s.id, s])));
	const memberMap = $derived(new Map(members.map((m) => [m.user_id, m])));
	const methodMap = new Map(PAYMENT_METHODS.map((m) => [m.id, m]));

	// Cálculos de saldo en $lib/finance (probados en finance.test.ts)
	const sumType = sumByType;
	const balanceBefore = (iso: string) => balanceAt(board?.initial_balance, transactions, iso);

	const balance = $derived(balanceAt(board?.initial_balance, transactions));

	// ---------- Mes seleccionado ----------
	const today = todayISO();
	const monthStart = $derived(monthStartISO(year, month));
	const nextMonthStart = $derived(monthStartISO(year, month + 1));
	const prevMonthStart = $derived(monthStartISO(year, month - 1));
	const daysInMonth = $derived(new Date(year, month + 1, 0).getDate());
	const isCurrentMonth = $derived(year === now.getFullYear() && month === now.getMonth());
	const isFutureMonth = $derived(monthStart > today);
	const prevMonthName = $derived(MONTHS_SHORT[(month + 11) % 12]);

	const monthTx = $derived(txInRange(transactions, monthStart, nextMonthStart));
	const prevTx = $derived(txInRange(transactions, prevMonthStart, monthStart));

	const income = $derived(sumType(monthTx, 'income'));
	const expense = $derived(sumType(monthTx, 'expense'));
	const saved = $derived(sumType(monthTx, 'saving'));
	const prevIncome = $derived(sumType(prevTx, 'income'));
	const prevExpense = $derived(sumType(prevTx, 'expense'));
	const incomeCount = $derived(monthTx.filter((t) => t.type === 'income').length);
	const expenseCount = $derived(monthTx.filter((t) => t.type === 'expense').length);

	const startBalance = $derived(balanceBefore(monthStart));
	const endBalance = $derived(balanceBefore(nextMonthStart));
	const balanceDelta = $derived(balanceDeltaPct(startBalance, endBalance));

	// Cierre estimado: proyecta el gasto diario promedio a todo el mes
	const projectedClose = $derived(
		isCurrentMonth
			? projectedMonthClose({ startBalance, income, expense, saved, dayOfMonth: now.getDate(), daysInMonth })
			: endBalance
	);
	const closeLabel = $derived(
		isCurrentMonth ? 'Cierre estimado del mes' : isFutureMonth ? 'Saldo proyectado' : 'Saldo al cierre del mes'
	);

	const change = pctChange;
	// Un mes futuro aún no tiene movimientos: compararlo daría caídas falsas (−100 %)
	const incomeChange = $derived(isFutureMonth ? null : change(income, prevIncome));
	const expenseChange = $derived(isFutureMonth ? null : change(expense, prevExpense));

	const budget = $derived(Number(board?.monthly_budget ?? 0));
	const budgetPct = $derived(budget > 0 ? (expense / budget) * 100 : 0);
	const budgetTone = $derived(budgetPct >= 100 ? 'critical' : budgetPct >= 85 ? 'warning' : 'good');

	const goal = $derived(Number(board?.savings_goal_pct ?? 20));
	const savingsRate = $derived(savingsRatePct(income, expense));
	const onTarget = $derived(income > 0 && savingsRate >= goal);

	// ---------- Presupuestos por subcategoría ----------
	const subBudgets = $derived.by(() => {
		const spent = new Map<number, number>();
		for (const t of monthTx) {
			if (t.type === 'expense' && t.subcategory_id) {
				spent.set(t.subcategory_id, (spent.get(t.subcategory_id) ?? 0) + Number(t.amount));
			}
		}
		return subcategories
			.filter((s) => Number(s.monthly_budget) > 0)
			.map((s) => {
				const limit = Number(s.monthly_budget);
				const used = spent.get(s.id) ?? 0;
				const pct = (used / limit) * 100;
				return { sub: s, cat: catMap.get(s.category_id), limit, used, pct, tone: toneOf(pct) };
			})
			.sort((a, b) => b.pct - a.pct);
	});
	const subBudgetsOver = $derived(subBudgets.filter((b) => b.tone === 'critical').length);

	// ---------- Gráfica semanal ----------
	const weeks = $derived.by<WeekBucket[]>(() => {
		const ranges: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, 28]];
		if (daysInMonth > 28) ranges.push([29, daysInMonth]);
		const todayDay = now.getDate();
		return ranges.map(([from, to], i) => {
			const inWeek = monthTx.filter((t) => {
				const d = Number(t.date.slice(8, 10));
				return d >= from && d <= to;
			});
			return {
				label: `Sem ${i + 1}`,
				range: from === to ? `${from}` : `${from}-${to}`,
				income: sumType(inWeek, 'income'),
				expense: sumType(inWeek, 'expense'),
				current: isCurrentMonth && todayDay >= from && todayDay <= to,
				future: isFutureMonth || (isCurrentMonth && todayDay < from)
			};
		});
	});

	// ---------- Dona: gasto por categoría (top 5 + Otros) ----------
	const slices = $derived.by<SpendSlice[]>(() => {
		const byCat = new Map<string, { total: number; subs: Map<string, number> }>();
		for (const t of monthTx) {
			if (t.type !== 'expense') continue;
			const key = t.category_id ? String(t.category_id) : 'none';
			const entry = byCat.get(key) ?? { total: 0, subs: new Map() };
			entry.total += Number(t.amount);
			const subName = t.subcategory_id ? (subMap.get(t.subcategory_id)?.name ?? 'Otra') : 'General';
			entry.subs.set(subName, (entry.subs.get(subName) ?? 0) + Number(t.amount));
			byCat.set(key, entry);
		}
		const toSubs = (m: Map<string, number>) => {
			const list = [...m.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
			// si todo es "General" no hay desglose que mostrar
			return list.length === 1 && list[0].name === 'General' ? [] : list;
		};
		const sorted = [...byCat.entries()].sort((a, b) => b[1].total - a[1].total);
		const top = sorted.slice(0, 5).map(([key, v], i) => {
			const cat = key === 'none' ? undefined : catMap.get(Number(key));
			return {
				key,
				name: cat?.name ?? 'Sin categoría',
				icon: cat?.icon ?? '•',
				total: v.total,
				color: CHART.categories[i],
				subs: toSubs(v.subs)
			};
		});
		const rest = sorted.slice(5);
		if (rest.length) {
			top.push({
				key: 'other',
				name: 'Otros',
				icon: '📦',
				total: rest.reduce((s, [, v]) => s + v.total, 0),
				color: CHART.other,
				subs: rest.map(([key, v]) => ({
					name: key === 'none' ? 'Sin categoría' : (catMap.get(Number(key))?.name ?? 'Otra'),
					total: v.total
				}))
			});
		}
		return top;
	});

	// ---------- Tabla de movimientos ----------
	const catLabel = (t: FinanceTransaction) => {
		const cat = t.category_id ? catMap.get(t.category_id) : undefined;
		const sub = t.subcategory_id ? subMap.get(t.subcategory_id) : undefined;
		if (!cat) return 'Sin categoría';
		return sub ? `${cat.name} › ${sub.name}` : cat.name;
	};
	const txTitle = (t: FinanceTransaction) => {
		const cat = t.category_id ? catMap.get(t.category_id) : undefined;
		const sub = t.subcategory_id ? subMap.get(t.subcategory_id) : undefined;
		return t.description || sub?.name || cat?.name || 'Sin categoría';
	};
	const txIcon = (t: FinanceTransaction) =>
		(t.category_id ? catMap.get(t.category_id)?.icon : null) ?? (t.type === 'income' ? '📥' : t.type === 'saving' ? '🐷' : '•');
	const txDate = (t: FinanceTransaction) => {
		const [y, m, d] = t.date.split('-').map(Number);
		const created = new Date(t.created_at);
		const time = created.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
		return `${d} ${MONTHS_SHORT[m - 1]} ${y} · ${time}`;
	};
	const whoLabel = (t: FinanceTransaction) => {
		if (!isShared || !t.created_by) return '';
		const m = memberMap.get(t.created_by);
		return m ? (m.user_id === myId ? 'Tú' : m.display_name) : '';
	};

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return monthTx.filter((t) => {
			if (filter !== 'all' && t.type !== filter) return false;
			if (!q) return true;
			const haystack = [t.description ?? '', catLabel(t), String(Math.round(Number(t.amount)))].join(' ').toLowerCase();
			return haystack.includes(q.replace(/\./g, ''));
		});
	});
	const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const currentPage = $derived(Math.min(pageIndex, pageCount - 1));
	const pageRows = $derived(filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE));

	const usage = $derived.by(() => {
		const counts: Record<number, number> = {};
		for (const t of transactions.slice(0, 300)) {
			if (t.category_id) counts[t.category_id] = (counts[t.category_id] ?? 0) + 1;
		}
		return counts;
	});

	const typeMeta = (type: TxType) => TX_TYPES.find((t) => t.id === type)!;
	const amountClass = (type: TxType) =>
		type === 'income' ? 'text-brand-accent' : type === 'saving' ? 'text-[#7fb2f0]' : 'text-red-400';
	const pillClass = (type: TxType) =>
		type === 'income'
			? 'bg-brand-accent/10 text-brand-accent border-brand-accent/30'
			: type === 'saving'
				? 'bg-[#3987e5]/10 text-[#7fb2f0] border-[#3987e5]/30'
				: 'bg-red-500/10 text-red-300 border-red-400/30';

	// ---------- Carga ----------
	$effect(() => {
		if (boardId) loadAll(boardId);
	});

	async function loadAll(id: number) {
		if (!supabase) return;
		loading = true;
		loadError = '';
		const {
			data: { session }
		} = await supabase.auth.getSession();
		myId = session?.user?.id ?? null;

		let res: { data: unknown; error: { message: string } | null } = await supabase
			.from('finance_boards')
			.select('id, title, description, color, initial_balance, monthly_budget, savings_goal_pct, user_id')
			.eq('id', id)
			.maybeSingle();
		missing026 = false;
		if (res.error && /monthly_budget|savings_goal_pct/i.test(res.error.message)) {
			missing026 = true;
			res = await supabase
				.from('finance_boards')
				.select('id, title, description, color, initial_balance, user_id')
				.eq('id', id)
				.maybeSingle();
		}

		if (res.error || !res.data) {
			loadError = res.error
				? /color|initial_balance/i.test(res.error.message)
					? 'Falta ejecutar la migración 024_finance_boards_v2.sql en Supabase.'
					: res.error.message
				: 'Este tablero no existe o no tienes acceso.';
			board = null;
			loading = false;
			return;
		}
		board = { monthly_budget: 0, savings_goal_pct: 20, ...(res.data as any) } as Board;
		await Promise.all([loadCategories(), loadTransactions(), loadMembers()]);
		await ensureSavingCategories();
		loading = false;
	}

	async function loadCategories() {
		if (!supabase) return;
		const { data } = await supabase
			.from('finance_categories')
			.select('id, board_id, name, type, color, icon, sort_order')
			.eq('board_id', boardId)
			.order('sort_order');
		categories = (data ?? []) as FinanceCategory[];

		const ids = categories.map((c) => c.id);
		if (ids.length === 0) {
			subcategories = [];
			return;
		}
		let subsRes: { data: unknown; error: { message: string } | null } = await supabase
			.from('finance_subcategories')
			.select('id, category_id, name, monthly_budget')
			.in('category_id', ids);
		if (subsRes.error && /monthly_budget/i.test(subsRes.error.message)) {
			subsRes = await supabase.from('finance_subcategories').select('id, category_id, name').in('category_id', ids);
		}
		subcategories = ((subsRes.data as FinanceSubcategory[] | null) ?? []);
	}

	/** Tableros creados antes de existir "Ahorro" reciben sus categorías una sola vez */
	async function ensureSavingCategories() {
		if (!supabase || categories.length === 0 || categories.some((c) => c.type === 'saving')) return;
		const flag = `fokuz:saving-cats:${boardId}`;
		try {
			if (localStorage.getItem(flag)) return;
			localStorage.setItem(flag, '1');
		} catch {
			return;
		}
		const maxOrder = Math.max(0, ...categories.map((c) => c.sort_order));
		const { error } = await supabase.from('finance_categories').insert(
			DEFAULT_SAVING_CATEGORIES.map((c, i) => ({ board_id: boardId, name: c.name, type: c.type, icon: c.icon, sort_order: maxOrder + 1 + i }))
		);
		if (!error) await loadCategories();
	}

	/** Supabase devuelve como máximo 1000 filas por consulta: se pide por páginas hasta traerlas todas. */
	const TX_PAGE_SIZE = 1000;

	async function loadTransactions() {
		if (!supabase) return;
		const all: FinanceTransaction[] = [];
		for (let from = 0; ; from += TX_PAGE_SIZE) {
			const { data, error } = await supabase
				.from('finance_transactions')
				.select('id, board_id, category_id, subcategory_id, amount, type, description, date, payment_method, created_by, created_at')
				.eq('board_id', boardId)
				.order('date', { ascending: false })
				.order('created_at', { ascending: false })
				.order('id', { ascending: false })
				.range(from, from + TX_PAGE_SIZE - 1);
			if (error) {
				loadError = error.message;
				break;
			}
			const page = (data ?? []) as FinanceTransaction[];
			all.push(...page);
			if (page.length < TX_PAGE_SIZE) break;
		}
		transactions = all;
	}

	async function loadMembers() {
		if (!supabase) return;
		const { data } = await supabase.rpc('finance_board_members', { p_board_id: boardId });
		members = (data ?? []) as BoardMember[];
	}

	// ---------- Acciones ----------
	function shiftMonth(delta: number) {
		const d = new Date(year, month + delta, 1);
		year = d.getFullYear();
		month = d.getMonth();
		pageIndex = 0;
	}

	function setFilter(f: 'all' | TxType) {
		filter = f;
		pageIndex = 0;
	}

	function openNew(type: TxType = 'expense') {
		editingTx = null;
		entryType = type;
		entryOpen = true;
	}

	function openEdit(tx: FinanceTransaction) {
		editingTx = tx;
		entryOpen = true;
	}

	function showToast(message: string) {
		toast = message;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2500);
	}

	async function onEntrySaved(date: string | null, keepOpen = false) {
		const wasEdit = !!editingTx;
		if (!keepOpen) {
			entryOpen = false;
			editingTx = null;
			showToast(date === null ? 'Movimiento eliminado' : wasEdit ? 'Cambios guardados' : 'Movimiento registrado');
		}
		await loadTransactions();
		// si se registró en otro mes (ej. el día 1 con fecha de ayer), saltar a ese mes
		if (date && !(date >= monthStart && date < nextMonthStart)) {
			const [y, m] = date.split('-').map(Number);
			year = y;
			month = m - 1;
			pageIndex = 0;
		}
	}

	async function deleteTx() {
		const tx = txToDelete;
		txToDelete = null;
		if (!supabase || !tx) return;
		const { error } = await supabase.from('finance_transactions').delete().eq('id', tx.id);
		if (error) loadError = error.message;
		else transactions = transactions.filter((t) => t.id !== tx.id);
	}

	function exportExcel() {
		if (!board) return;
		const period = `${MONTHS[month]} ${year}`;
		const toDate = (iso: string) => {
			const [y, m, d] = iso.split('-').map(Number);
			return new Date(y, m - 1, d);
		};
		const sorted = [...monthTx].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

		// Hoja 1: movimientos del mes
		const columns = [
			{ header: 'Fecha', kind: 'date' as const, width: 12 },
			{ header: 'Tipo', width: 10 },
			{ header: 'Categoría', width: 20 },
			{ header: 'Subcategoría', width: 18 },
			{ header: 'Concepto', width: 34 },
			{ header: 'Método de pago', width: 15 },
			{ header: 'Monto', kind: 'money' as const, width: 16 },
			...(isShared ? [{ header: 'Registrado por', width: 16 }] : [])
		];
		const rows: CellValue[][] = sorted.map((t) => {
			const cat = t.category_id ? catMap.get(t.category_id) : undefined;
			const sub = t.subcategory_id ? subMap.get(t.subcategory_id) : undefined;
			const row: CellValue[] = [
				toDate(t.date),
				typeMeta(t.type).label,
				cat?.name ?? 'Sin categoría',
				sub?.name ?? '',
				t.description ?? '',
				t.payment_method ? (methodMap.get(t.payment_method)?.label ?? '') : '',
				signedAmount(t)
			];
			if (isShared) row.push(t.created_by ? (memberMap.get(t.created_by)?.display_name ?? '') : '');
			return row;
		});
		const totals: CellValue[] = ['Neto del mes', '', '', '', '', '', income - expense - saved];
		if (isShared) totals.push('');

		// Hoja 2: resumen
		const summaryRows: CellValue[][] = [
			['Saldo al inicio del mes', startBalance],
			['Ingresos', income],
			['Gastos', -expense],
			['Ahorros apartados', -saved],
			['Saldo al cierre del mes', endBalance],
			['Saldo actual total', balance]
		];
		if (budget > 0) {
			summaryRows.push(['Presupuesto mensual', budget], ['Disponible del presupuesto', budget - expense]);
		}

		// Hoja 3: por categoría y subcategoría
		const groups = new Map<string, { type: TxType; cat: string; sub: string; total: number }>();
		for (const t of monthTx) {
			const cat = t.category_id ? (catMap.get(t.category_id)?.name ?? 'Otra') : 'Sin categoría';
			const sub = t.subcategory_id ? (subMap.get(t.subcategory_id)?.name ?? '') : '';
			const key = `${t.type}|${cat}|${sub}`;
			const g = groups.get(key) ?? { type: t.type, cat, sub, total: 0 };
			g.total += Number(t.amount);
			groups.set(key, g);
		}
		const typeTotal = { income, expense, saving: saved } as Record<TxType, number>;
		const order: TxType[] = ['expense', 'income', 'saving'];
		const catRows: CellValue[][] = [...groups.values()]
			.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || b.total - a.total)
			.map((g) => [
				typeMeta(g.type).label,
				g.cat,
				g.sub,
				g.total,
				typeTotal[g.type] > 0 ? g.total / typeTotal[g.type] : 0
			]);

		const title = [`Fokuz · ${board.title}`, period];
		downloadXlsx(`Fokuz_${board.title.replace(/[^\w-]+/g, '_')}_${year}-${String(month + 1).padStart(2, '0')}`, [
			{ name: 'Movimientos', title, columns, rows, totals },
			{
				name: 'Resumen',
				title,
				columns: [
					{ header: 'Concepto', width: 28 },
					{ header: 'Valor', kind: 'money', width: 18 }
				],
				rows: summaryRows
			},
			{
				name: 'Por categoría',
				title,
				columns: [
					{ header: 'Tipo', width: 10 },
					{ header: 'Categoría', width: 22 },
					{ header: 'Subcategoría', width: 20 },
					{ header: 'Total', kind: 'money', width: 16 },
					{ header: '% del tipo', kind: 'percent', width: 12 }
				],
				rows: catRows
			}
		]);
	}

	async function deleteBoard() {
		confirmDeleteBoard = false;
		if (!supabase || !board) return;
		const { error } = await supabase.from('finance_boards').delete().eq('id', board.id);
		if (error) {
			loadError = error.message;
			return;
		}
		goto('/finanzas');
	}

	async function leaveBoard() {
		confirmLeave = false;
		if (!supabase || !board || !myId) return;
		const { error } = await supabase
			.from('finance_board_shares')
			.delete()
			.eq('board_id', board.id)
			.eq('shared_with', myId);
		if (error) {
			loadError = error.message;
			return;
		}
		goto('/finanzas');
	}

	const fmtDelta = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
</script>

<svelte:head>
	<title>{board?.title ?? 'Finanzas'} · Fokuz</title>
</svelte:head>

{#snippet monthPicker()}
	<div class="flex items-center gap-1 bg-brand-bg border border-brand-divider rounded-xl px-1 py-1">
		<button onclick={() => shiftMonth(-1)} class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface" aria-label="Mes anterior">
			<ChevronLeft class="w-4 h-4" />
		</button>
		<span class="flex items-center gap-2 px-2 text-sm font-bold text-brand-text min-w-36 justify-center">
			<CalendarDays class="w-4 h-4 text-brand-accent" />
			{MONTHS[month]} {year}
		</span>
		<button onclick={() => shiftMonth(1)} class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface" aria-label="Mes siguiente">
			<ChevronRight class="w-4 h-4" />
		</button>
	</div>
{/snippet}

<!-- Barra superior -->
<header class="sticky top-0 z-20 bg-brand-surface/95 backdrop-blur border-b border-brand-divider">
	<div class="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-3">
		<a href="/finanzas" class="p-2 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated" aria-label="Volver a tableros">
			<ArrowLeft class="w-5 h-5" />
		</a>
		<div class="flex-1 min-w-0 flex items-center gap-2">
			{#if board}
				<span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_10px_currentColor]" style="background-color: {board.color}; color: {board.color}"></span>
				<h1 class="text-base sm:text-lg font-bold text-brand-text truncate">{board.title}</h1>
				<span class="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-bg border border-brand-divider text-brand-text-muted shrink-0">
					{#if isShared}<Users class="w-3 h-3" /> Compartido · {members.length}{:else}Personal{/if}
				</span>
			{/if}
		</div>

		{#if board}
			<div class="hidden md:block">{@render monthPicker()}</div>
			<div class="flex-1 hidden md:block"></div>
			<button onclick={exportExcel} class="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-divider text-brand-text-muted hover:text-brand-text text-sm font-semibold">
				<Download class="w-4 h-4" /> Exportar Excel
			</button>
			<button onclick={() => openNew('expense')} class="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-accent text-brand-bg font-bold text-sm hover:brightness-105 shadow-[0_0_18px_var(--color-brand-accent-muted)]">
				<Plus class="w-4 h-4" /> Nuevo registro
			</button>
			<div class="relative">
				<button onclick={() => (menuOpen = !menuOpen)} class="p-2 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated" aria-label="Opciones del tablero">
					<MoreVertical class="w-5 h-5" />
				</button>
				{#if menuOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="fixed inset-0 z-20" onclick={() => (menuOpen = false)}></div>
					<div class="absolute right-0 mt-1 w-56 z-30 bg-brand-surface border border-brand-divider rounded-xl shadow-2xl py-1 text-sm">
						<button class="w-full flex items-center gap-3 px-4 py-3 text-left text-brand-text hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; categoriesOpen = true; }}>
							<Tags class="w-4 h-4 text-brand-accent shrink-0" /> Categorías
						</button>
						<button class="sm:hidden w-full flex items-center gap-3 px-4 py-3 text-left text-brand-text hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; exportExcel(); }}>
							<Download class="w-4 h-4 text-brand-accent shrink-0" /> Exportar a Excel
						</button>
						{#if isOwner}
							<button class="w-full flex items-center gap-3 px-4 py-3 text-left text-brand-text hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; boardFormOpen = true; }}>
								<Pencil class="w-4 h-4 text-brand-accent shrink-0" /> Editar y compartir
							</button>
							<button class="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; confirmDeleteBoard = true; }}>
								<Trash2 class="w-4 h-4" /> Eliminar tablero
							</button>
						{:else}
							<button class="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-brand-surface-elevated" onclick={() => { menuOpen = false; confirmLeave = true; }}>
								<LogOut class="w-4 h-4" /> Salir del tablero
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
	{#if board}
		<div class="md:hidden flex justify-center pb-3">{@render monthPicker()}</div>
	{/if}
</header>

<div class="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 pb-36 sm:pb-12 flex flex-col gap-4">
	{#if loading}
		<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
			{#each [1, 2, 3, 4] as _}<div class="h-32 rounded-2xl bg-brand-surface skeleton"></div>{/each}
		</div>
		<div class="h-72 rounded-2xl bg-brand-surface skeleton"></div>
	{:else if loadError && !board}
		<div class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-2xl p-4">
			{loadError}
			<a href="/finanzas" class="block mt-2 font-bold underline">Volver a mis tableros</a>
		</div>
	{:else if board}
		{#if loadError}
			<p class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-2xl p-3">{loadError}</p>
		{/if}
		{#if missing026}
			<p class="text-sm text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-2xl p-3">
				Para usar presupuesto y meta de ahorro, ejecuta la migración <b>026_finance_budget_savings.sql</b> en Supabase.
			</p>
		{/if}

		<!-- KPIs -->
		<section class="order-1 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
			<!-- Saldo -->
			<article class="col-span-2 lg:col-span-1 rounded-2xl border border-brand-accent/40 bg-brand-surface p-4 sm:p-5 shadow-[0_0_24px_-12px_var(--color-brand-accent)] flex flex-col">
				<div class="flex items-start justify-between gap-2">
					<p class="text-[11px] font-bold uppercase tracking-wider text-brand-accent">Saldo actual total</p>
					{#if balanceDelta !== null && !isFutureMonth}
						<span class="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border {balanceDelta >= 0 ? 'text-brand-accent border-brand-accent/40 bg-brand-accent/10' : 'text-red-400 border-red-400/40 bg-red-500/10'}">
							{#if balanceDelta >= 0}<TrendingUp class="w-3 h-3" />{:else}<TrendingDown class="w-3 h-3" />{/if}
							{fmtDelta(balanceDelta)}
						</span>
					{/if}
				</div>
				<p class="text-3xl font-black tabular-nums mt-2 {balance < 0 ? 'text-red-400' : 'text-brand-text'}">{formatCOP(balance)}</p>
				<div class="mt-auto pt-3 border-t border-brand-divider/60 flex items-center justify-between gap-2 text-xs">
					<span class="text-brand-text-muted">{closeLabel}:</span>
					<span class="font-bold text-brand-text tabular-nums">{formatCOP(isFutureMonth ? startBalance : projectedClose)}</span>
				</div>
			</article>

			<!-- Ingresos -->
			<article class="rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5 flex flex-col">
				<div class="flex items-start justify-between gap-2">
					<p class="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">Ingresos del mes</p>
					<span class="p-1.5 rounded-lg bg-brand-accent/10 text-brand-accent"><ArrowDownLeft class="w-3.5 h-3.5" /></span>
				</div>
				<p class="text-xl sm:text-2xl font-black tabular-nums mt-2 text-brand-accent">{formatCOP(income)}</p>
				<div class="mt-auto pt-3 border-t border-brand-divider/60 flex flex-wrap items-center justify-between gap-1 text-xs">
					<span class="text-brand-text-muted">{incomeCount} {incomeCount === 1 ? 'ingreso' : 'ingresos'}</span>
					{#if incomeChange !== null}
						<span class="font-bold {incomeChange >= 0 ? 'text-brand-accent' : 'text-red-400'}">{fmtDelta(incomeChange)} vs {prevMonthName}</span>
					{/if}
				</div>
			</article>

			<!-- Gastos -->
			<article class="rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5 flex flex-col">
				<div class="flex items-start justify-between gap-2">
					<p class="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">Gastos del mes</p>
					<span class="p-1.5 rounded-lg bg-red-500/10 text-red-400"><ArrowUpRight class="w-3.5 h-3.5" /></span>
				</div>
				<p class="text-xl sm:text-2xl font-black tabular-nums mt-2 text-red-400">{formatCOP(expense)}</p>
				<div class="mt-auto pt-3 border-t border-brand-divider/60 flex flex-wrap items-center justify-between gap-1 text-xs">
					<span class={budget > 0
						? budgetTone === 'critical'
							? 'font-bold text-red-400'
							: budgetTone === 'warning'
								? 'font-bold text-amber-400'
								: 'text-brand-text-muted'
						: 'text-brand-text-muted'}>
						{#if budget > 0}{budgetTone === 'critical' ? '⚠ ' : ''}{Math.round(budgetPct)}% del presupuesto{:else}{expenseCount} {expenseCount === 1 ? 'gasto' : 'gastos'}{/if}
					</span>
					{#if expenseChange !== null}
						<!-- en gastos, subir es malo -->
						<span class="font-bold {expenseChange <= 0 ? 'text-brand-accent' : 'text-red-400'}">{fmtDelta(expenseChange)} vs {prevMonthName}</span>
					{/if}
				</div>
			</article>

			<!-- Capacidad de ahorro -->
			<article class="col-span-2 lg:col-span-1 rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5 flex flex-col">
				<div class="flex items-start justify-between gap-2">
					<p class="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted">Capacidad de ahorro</p>
					<span class="p-1.5 rounded-lg bg-[#3987e5]/15 text-[#7fb2f0]"><PiggyBank class="w-3.5 h-3.5" /></span>
				</div>
				<p class="mt-2 flex items-baseline gap-2">
					<span class="text-2xl font-black tabular-nums {savingsRate < 0 ? 'text-red-400' : 'text-brand-text'}">{income > 0 ? `${savingsRate.toFixed(1)}%` : '—'}</span>
					<span class="text-xs text-brand-text-muted tabular-nums">({formatCOP(income - expense)})</span>
				</p>
				{#if saved > 0}
					<p class="text-[11px] text-[#7fb2f0] mt-0.5">Apartado como ahorro: {formatCOP(saved)}</p>
				{/if}
				<div class="mt-auto pt-3 border-t border-brand-divider/60 flex items-center justify-between gap-2 text-xs">
					<span class="text-brand-text-muted">Meta mínima: {goal}%</span>
					{#if income > 0}
						<span class="flex items-center gap-1 font-bold {onTarget ? 'text-brand-accent' : 'text-amber-400'}">
							{#if onTarget}<CircleCheck class="w-3.5 h-3.5" /> En objetivo{:else}<CircleAlert class="w-3.5 h-3.5" /> Por debajo{/if}
						</span>
					{/if}
				</div>
			</article>
		</section>

		<!-- Gráficas -->
		<section class="order-3 lg:order-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
			<article class="lg:col-span-2 rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5 flex flex-col">
				<div class="flex flex-wrap items-start justify-between gap-2 mb-5">
					<div>
						<h2 class="flex items-center gap-2 text-sm font-bold text-brand-text">
							<BarChart3 class="w-4 h-4 text-brand-accent" /> Flujo de ingresos vs. gastos
						</h2>
						<p class="text-xs text-brand-text-muted mt-0.5">Por semana de {MONTHS[month].toLowerCase()}</p>
					</div>
					<div class="flex items-center gap-3 text-xs text-brand-text-muted">
						<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background-color: {CHART.income}"></span>Ingresos</span>
						<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm" style="background-color: {CHART.expense}"></span>Gastos</span>
					</div>
				</div>

				<WeeklyFlowChart {weeks} />

				<!-- Presupuesto -->
				<div class="mt-5 rounded-xl border border-brand-divider bg-brand-bg/60 px-4 py-3">
					{#if budget > 0}
						<div class="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
							<span class="flex items-center gap-1.5 text-brand-text-muted">
								<ShieldCheck class="w-3.5 h-3.5" /> Límite de presupuesto mensual:
								<b class="text-brand-text tabular-nums">{formatCOP(budget)}</b>
								{#if isOwner}
									<button onclick={() => (budgetOpen = true)} class="ml-1 p-1 rounded text-brand-text-muted hover:text-brand-accent" aria-label="Editar presupuesto"><Pencil class="w-3 h-3" /></button>
								{/if}
							</span>
							<span class="font-bold {budgetTone === 'critical' ? 'text-red-400' : budgetTone === 'warning' ? 'text-amber-400' : 'text-brand-accent'}">
								{budgetTone === 'critical' ? '⚠ ' : ''}{budgetPct.toFixed(1)}% consumido ({formatCOP(expense)})
							</span>
						</div>
						<div class="h-2 rounded-full bg-brand-bg overflow-hidden" role="progressbar" aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Presupuesto consumido">
							<div
								class="h-full rounded-full transition-[width] duration-500 {budgetTone === 'critical' ? 'bg-red-500' : budgetTone === 'warning' ? 'bg-amber-400' : 'bg-gradient-to-r from-brand-accent to-amber-400'}"
								style="width: {Math.min(100, budgetPct)}%"
							></div>
						</div>
						{#if budgetPct < 100}
							<p class="text-[11px] text-brand-text-muted mt-1.5">Te quedan {formatCOP(budget - expense)} este mes.</p>
						{:else}
							<p class="text-[11px] text-red-400 mt-1.5">Te pasaste por {formatCOP(expense - budget)}.</p>
						{/if}
					{:else}
						<div class="flex flex-wrap items-center justify-between gap-2 text-xs">
							<span class="flex items-center gap-1.5 text-brand-text-muted"><ShieldCheck class="w-3.5 h-3.5" /> Sin presupuesto mensual definido.</span>
							{#if isOwner && !missing026}
								<button onclick={() => (budgetOpen = true)} class="font-bold text-brand-accent hover:underline">Definir presupuesto</button>
							{/if}
						</div>
					{/if}
				</div>
			</article>

			<article class="rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5">
				<div class="flex items-center justify-between mb-4">
					<h2 class="flex items-center gap-2 text-sm font-bold text-brand-text">
						<PieChart class="w-4 h-4 text-brand-accent" /> ¿En qué más gastas?
					</h2>
					<span class="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted">Top 5</span>
				</div>
				<SpendingDonut {slices} total={expense} />
				{#if slices.some((s) => s.subs.length)}
					<p class="text-[11px] text-brand-text-muted mt-3 text-center">Toca una categoría para ver sus subcategorías.</p>
				{/if}
			</article>
		</section>

		<!-- Presupuestos por subcategoría -->
		{#if subBudgets.length > 0}
			<section class="order-4 lg:order-3 rounded-2xl border border-brand-divider bg-brand-surface p-4 sm:p-5">
				<div class="flex flex-wrap items-center justify-between gap-2 mb-4">
					<div>
						<h2 class="flex items-center gap-2 text-sm font-bold text-brand-text">
							<Target class="w-4 h-4 text-brand-accent" /> Presupuestos por subcategoría
						</h2>
						<p class="text-xs text-brand-text-muted mt-0.5">Gastado en {MONTHS[month].toLowerCase()} frente al límite de cada una</p>
					</div>
					{#if subBudgetsOver > 0}
						<span class="flex items-center gap-1 text-xs font-bold text-red-400">
							<CircleAlert class="w-3.5 h-3.5" /> {subBudgetsOver} {subBudgetsOver === 1 ? 'excedido' : 'excedidos'}
						</span>
					{/if}
				</div>
				<ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{#each subBudgets as b (b.sub.id)}
						<li class="rounded-xl bg-brand-bg/60 border border-brand-divider/60 p-3">
							<div class="flex items-center justify-between gap-2 text-sm mb-1">
								<span class="min-w-0 truncate text-brand-text">
									{b.cat?.icon ?? '•'} <span class="text-brand-text-muted">{b.cat?.name ?? ''} ›</span> {b.sub.name}
								</span>
								<span class="text-xs font-bold shrink-0 {b.tone === 'critical' ? 'text-red-400' : b.tone === 'warning' ? 'text-amber-400' : 'text-brand-accent'}">
									{Math.round(b.pct)}%
								</span>
							</div>
							<div class="h-1.5 rounded-full bg-brand-bg overflow-hidden mb-1.5" role="progressbar" aria-valuenow={Math.round(b.pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Presupuesto de {b.sub.name}">
								<div
									class="h-full rounded-full {b.tone === 'critical' ? 'bg-red-500' : b.tone === 'warning' ? 'bg-amber-400' : 'bg-brand-accent'}"
									style="width: {Math.min(100, b.pct)}%"
								></div>
							</div>
							<div class="flex items-center justify-between gap-2 text-[11px] tabular-nums">
								<span class="text-brand-text-muted">{formatCOP(b.used)} de {formatCOP(b.limit)}</span>
								{#if b.used <= b.limit}
									<span class="text-brand-text-muted">Quedan {formatCOP(b.limit - b.used)}</span>
								{:else}
									<span class="text-red-400 font-semibold">⚠ +{formatCOP(b.used - b.limit)}</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<!-- Movimientos (en el celular van justo después del resumen) -->
		<section class="order-2 lg:order-4 rounded-2xl border border-brand-divider bg-brand-surface overflow-hidden">
			<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 sm:p-5 border-b border-brand-divider/60">
				<div>
					<h2 class="text-sm font-bold text-brand-text">Movimientos</h2>
					<p class="text-xs text-brand-text-muted mt-0.5">Ingresos, gastos y ahorros de {MONTHS[month].toLowerCase()}</p>
				</div>
				<div class="flex flex-col sm:flex-row gap-2">
					<label class="flex items-center gap-2 bg-brand-bg border border-brand-divider rounded-xl px-3 focus-within:border-brand-accent sm:w-64">
						<Search class="w-4 h-4 text-brand-text-muted shrink-0" />
						<input
							type="search"
							bind:value={query}
							oninput={() => (pageIndex = 0)}
							placeholder="Buscar concepto o categoría…"
							class="flex-1 min-w-0 bg-transparent py-2 text-sm text-brand-text placeholder-brand-text-muted/60 focus:outline-none"
						/>
					</label>
					<div class="flex bg-brand-bg border border-brand-divider rounded-xl p-1 text-xs font-bold overflow-x-auto">
						<button onclick={() => setFilter('all')} class="flex-1 px-3 py-1.5 rounded-lg whitespace-nowrap {filter === 'all' ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted hover:text-brand-text'}">Todos</button>
						{#each TX_TYPES as t}
							<button onclick={() => setFilter(t.id)} class="flex-1 px-3 py-1.5 rounded-lg whitespace-nowrap {filter === t.id ? 'bg-brand-accent text-brand-bg' : 'text-brand-text-muted hover:text-brand-text'}">{t.short}</button>
						{/each}
					</div>
				</div>
			</div>

			{#if filtered.length === 0}
				<div class="px-6 py-12 text-center">
					{#if monthTx.length === 0}
						<p class="text-brand-text font-semibold mb-1">Sin movimientos en {MONTHS[month].toLowerCase()}</p>
						<p class="text-sm text-brand-text-muted mb-4">Registra tu primer gasto, ingreso o ahorro.</p>
						<button onclick={() => openNew('expense')} class="inline-flex items-center gap-2 bg-brand-accent text-brand-bg px-4 py-2.5 rounded-xl font-bold text-sm">
							<Plus class="w-4 h-4" /> Nuevo registro
						</button>
					{:else}
						<p class="text-sm text-brand-text-muted">Ningún movimiento coincide con la búsqueda.</p>
					{/if}
				</div>
			{:else}
				<!-- Tabla (escritorio) -->
				<div class="hidden md:block overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="text-[11px] font-bold uppercase tracking-wider text-brand-text-muted border-b border-brand-divider/60">
								<th class="text-left font-bold px-5 py-3">Concepto y fecha</th>
								<th class="text-left font-bold px-3 py-3">Categoría</th>
								<th class="text-left font-bold px-3 py-3">Método de pago</th>
								<th class="text-right font-bold px-3 py-3">Monto</th>
								<th class="text-right font-bold px-5 py-3">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-brand-divider/40">
							{#each pageRows as tx (tx.id)}
								{@const pm = tx.payment_method ? methodMap.get(tx.payment_method) : undefined}
								{@const who = whoLabel(tx)}
								<tr class="hover:bg-brand-bg/40 group">
									<td class="px-5 py-3">
										<div class="flex items-center gap-3">
											<span class="w-9 h-9 rounded-xl border flex items-center justify-center text-base shrink-0 {pillClass(tx.type)}">{txIcon(tx)}</span>
											<div class="min-w-0">
												<p class="font-semibold text-brand-text truncate max-w-72">{txTitle(tx)}</p>
												<p class="text-xs text-brand-text-muted">{txDate(tx)}{who ? ` · ${who}` : ''}</p>
											</div>
										</div>
									</td>
									<td class="px-3 py-3">
										<span class="inline-block text-xs font-semibold px-2 py-1 rounded-md border max-w-52 truncate align-middle {pillClass(tx.type)}">{catLabel(tx)}</span>
									</td>
									<td class="px-3 py-3 text-brand-text-muted text-xs">
										{#if pm}{pm.icon} {pm.label}{:else}—{/if}
									</td>
									<td class="px-3 py-3 text-right font-bold tabular-nums whitespace-nowrap {amountClass(tx.type)}">
										{typeMeta(tx.type).sign}{formatCOP(tx.amount)}
									</td>
									<td class="px-5 py-3">
										<div class="flex justify-end gap-1 opacity-60 group-hover:opacity-100">
											<button onclick={() => openEdit(tx)} class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-bg" aria-label="Editar"><Pencil class="w-4 h-4" /></button>
											<button onclick={() => (txToDelete = tx)} class="p-1.5 rounded-lg text-brand-text-muted hover:text-red-400 hover:bg-brand-bg" aria-label="Eliminar"><Trash2 class="w-4 h-4" /></button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Lista (móvil) -->
				<ul class="md:hidden divide-y divide-brand-divider/40">
					{#each pageRows as tx (tx.id)}
						{@const pm = tx.payment_method ? methodMap.get(tx.payment_method) : undefined}
						{@const who = whoLabel(tx)}
						<li>
							<button onclick={() => openEdit(tx)} class="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-brand-bg/60">
								<span class="w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0 {pillClass(tx.type)}">{txIcon(tx)}</span>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold text-brand-text truncate">{txTitle(tx)}</p>
									<p class="text-xs text-brand-text-muted truncate">
										{catLabel(tx)}{pm ? ` · ${pm.icon}` : ''}{who ? ` · ${who}` : ''}
									</p>
									<p class="text-[11px] text-brand-text-muted/80">{txDate(tx)}</p>
								</div>
								<span class="text-sm font-bold tabular-nums shrink-0 {amountClass(tx.type)}">{typeMeta(tx.type).sign}{formatCOP(tx.amount)}</span>
							</button>
						</li>
					{/each}
				</ul>

				<!-- Paginación -->
				<div class="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-brand-divider/60 text-xs">
					<span class="text-brand-text-muted">
						Mostrando {pageRows.length} de {filtered.length} {filtered.length === 1 ? 'movimiento' : 'movimientos'}
					</span>
					{#if pageCount > 1}
						<div class="flex gap-2">
							<button onclick={() => (pageIndex = currentPage - 1)} disabled={currentPage === 0} class="px-3 py-1.5 rounded-lg border border-brand-divider text-brand-text disabled:opacity-40">Anterior</button>
							<button onclick={() => (pageIndex = currentPage + 1)} disabled={currentPage >= pageCount - 1} class="px-3 py-1.5 rounded-lg border border-brand-divider text-brand-text disabled:opacity-40">Siguiente</button>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</div>

{#if board}
	<!-- Barra de registro rápido (móvil): un toque elige el tipo -->
	<nav
		class="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-brand-surface/95 backdrop-blur border-t border-brand-divider px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
		aria-label="Registrar movimiento"
	>
		<div class="grid grid-cols-3 gap-2">
			<button onclick={() => openNew('expense')} class="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-red-500 text-white font-bold text-sm active:scale-95 transition-transform">
				<ArrowUpRight class="w-4 h-4" /> Gasto
			</button>
			<button onclick={() => openNew('income')} class="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-brand-accent text-brand-bg font-bold text-sm active:scale-95 transition-transform">
				<ArrowDownLeft class="w-4 h-4" /> Ingreso
			</button>
			<button onclick={() => openNew('saving')} class="flex items-center justify-center gap-1.5 h-12 rounded-xl bg-[#3987e5] text-white font-bold text-sm active:scale-95 transition-transform">
				<PiggyBank class="w-4 h-4" /> Ahorro
			</button>
		</div>
	</nav>

	{#if toast}
		<div class="fixed left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 z-40 px-4 py-2.5 rounded-xl bg-brand-bg border border-brand-accent/50 text-sm font-semibold text-brand-text shadow-2xl" role="status">
			✓ {toast}
		</div>
	{/if}

	<QuickEntrySheet
		open={entryOpen}
		boardId={board.id}
		{categories}
		{subcategories}
		{transactions}
		{usage}
		initialType={entryType}
		transaction={editingTx}
		onclose={() => { entryOpen = false; editingTx = null; }}
		onsaved={onEntrySaved}
	/>

	<CategoriesSheet
		open={categoriesOpen}
		boardId={board.id}
		{categories}
		{subcategories}
		onclose={() => (categoriesOpen = false)}
		onchanged={() => { loadCategories(); loadTransactions(); }}
	/>

	<BudgetSheet
		open={budgetOpen}
		{board}
		onclose={() => (budgetOpen = false)}
		onsaved={() => { budgetOpen = false; loadAll(board!.id); }}
	/>

	<BoardFormSheet
		open={boardFormOpen}
		{board}
		onclose={() => (boardFormOpen = false)}
		onsaved={() => { boardFormOpen = false; loadAll(board!.id); }}
	/>
{/if}

<ConfirmModal
	isOpen={!!txToDelete}
	title="Eliminar movimiento"
	message={txToDelete ? `¿Eliminar "${txTitle(txToDelete)}" por ${formatCOP(txToDelete.amount)}?` : ''}
	confirmText="Eliminar"
	onConfirm={deleteTx}
	onCancel={() => (txToDelete = null)}
/>

<ConfirmModal
	isOpen={confirmDeleteBoard}
	title="Eliminar tablero"
	message="Se eliminarán el tablero, sus categorías y todos sus movimientos. Esta acción no se puede deshacer."
	confirmText="Eliminar"
	onConfirm={deleteBoard}
	onCancel={() => (confirmDeleteBoard = false)}
/>

<ConfirmModal
	isOpen={confirmLeave}
	title="Salir del tablero"
	message="Dejarás de ver este tablero. El dueño puede volver a compartirlo contigo."
	confirmText="Salir"
	onConfirm={leaveBoard}
	onCancel={() => (confirmLeave = false)}
/>
