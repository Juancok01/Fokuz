// Utilidades y tipos del módulo de Finanzas (tableros reales en Supabase)

export type TxType = 'income' | 'expense';
export type PaymentMethod = 'efectivo' | 'digital' | 'tarjeta';

export interface FinanceBoard {
	id: number;
	title: string;
	description: string | null;
	color: string;
	initial_balance: number;
	user_id: string;
	is_owner: boolean;
	created_at: string;
	balance: number;
	month_income: number;
	month_expense: number;
	tx_count: number;
	shared_count: number;
}

export interface FinanceCategory {
	id: number;
	board_id: number;
	name: string;
	type: TxType;
	color: string | null;
	icon: string | null;
	sort_order: number;
}

export interface FinanceTransaction {
	id: number;
	board_id: number;
	category_id: number | null;
	amount: number;
	type: TxType;
	description: string | null;
	date: string; // YYYY-MM-DD
	payment_method: PaymentMethod | null;
	created_by: string | null;
	created_at: string;
}

export interface BoardMember {
	user_id: string;
	email: string;
	display_name: string;
	is_owner: boolean;
}

export const BOARD_COLORS = ['#00DF81', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
	{ id: 'efectivo', label: 'Efectivo', icon: '💵' },
	{ id: 'digital', label: 'Digital', icon: '📱' },
	{ id: 'tarjeta', label: 'Tarjeta', icon: '💳' }
];

export const DEFAULT_CATEGORIES: { name: string; type: TxType; icon: string }[] = [
	{ name: 'Mercado', type: 'expense', icon: '🛒' },
	{ name: 'Comida', type: 'expense', icon: '🍔' },
	{ name: 'Transporte', type: 'expense', icon: '🚌' },
	{ name: 'Servicios', type: 'expense', icon: '💡' },
	{ name: 'Hogar', type: 'expense', icon: '🏠' },
	{ name: 'Salud', type: 'expense', icon: '💊' },
	{ name: 'Ocio', type: 'expense', icon: '🎬' },
	{ name: 'Compras', type: 'expense', icon: '🛍️' },
	{ name: 'Educación', type: 'expense', icon: '📚' },
	{ name: 'Deudas', type: 'expense', icon: '🏦' },
	{ name: 'Otros', type: 'expense', icon: '📦' },
	{ name: 'Salario', type: 'income', icon: '💼' },
	{ name: 'Extra', type: 'income', icon: '✨' },
	{ name: 'Ventas', type: 'income', icon: '🏷️' },
	{ name: 'Regalo', type: 'income', icon: '🎁' },
	{ name: 'Otros', type: 'income', icon: '📥' }
];

export const MONTHS = [
	'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
	'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const copFormatter = new Intl.NumberFormat('es-CO', {
	style: 'currency',
	currency: 'COP',
	maximumFractionDigits: 0
});

export function formatCOP(amount: number | string): string {
	return copFormatter.format(Number(amount) || 0);
}

/** "45000" → "45.000" (para mostrar mientras se escribe) */
export function formatDigits(digits: string): string {
	if (!digits) return '0';
	return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(digits));
}

/** Fecha local YYYY-MM-DD (no UTC, para que de noche no salte al día siguiente) */
export function todayISO(base = new Date()): string {
	const y = base.getFullYear();
	const m = String(base.getMonth() + 1).padStart(2, '0');
	const d = String(base.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	return todayISO(new Date(y, m - 1, d + days));
}

export function monthStartISO(year: number, month: number): string {
	return todayISO(new Date(year, month, 1));
}

/** "Hoy", "Ayer" o "lun 28 oct" */
export function dayLabel(iso: string): string {
	const today = todayISO();
	if (iso === today) return 'Hoy';
	if (iso === addDaysISO(today, -1)) return 'Ayer';
	const [y, m, d] = iso.split('-').map(Number);
	const date = new Date(y, m - 1, d);
	const label = date.toLocaleDateString('es-CO', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(y !== new Date().getFullYear() ? { year: 'numeric' } : {})
	});
	return label.charAt(0).toUpperCase() + label.slice(1);
}
