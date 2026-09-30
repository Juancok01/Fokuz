export type TransactionType = 'income' | 'expense' | 'transfer';
export type Source = 'Juan' | 'Pao' | 'Joint';
export type Classification = 'Need' | 'Want' | 'None';
export type PaymentMethod = 'Digital' | 'Efectivo';
export type SourceFilter = 'all' | Source;
export type FinanceTab = 'dashboard' | 'pockets' | 'savings' | 'loans';
export type GoalType = 'saving' | 'loan';

export interface Transaction {
	id: string;
	amount: number;
	date: Date;
	type: TransactionType;
	pocket_id?: string;
	goal_id?: string;
	source: Source;
	classification: Classification;
	method: PaymentMethod;
	note: string;
	paid?: boolean;
}

export interface Pocket {
	id: string;
	name: string;
	allocated_budget: number;
	color_hex: string;
}

export interface GoalTracker {
	id: string;
	type: GoalType;
	name: string;
	target_amount: number;
	current_amount: number;
	deadline?: Date;
	subtitle?: string;
}

export const MONTHS_ES = [
	'Enero',
	'Febrero',
	'Marzo',
	'Abril',
	'Mayo',
	'Junio',
	'Julio',
	'Agosto',
	'Septiembre',
	'Octubre',
	'Noviembre',
	'Diciembre'
];

export function formatCOP(amount: number, compact = false): string {
	if (compact && Math.abs(amount) >= 1_000_000) {
		const millions = amount / 1_000_000;
		return `$${millions.toLocaleString('es-CO', { maximumFractionDigits: 3 })}M`;
	}
	return new Intl.NumberFormat('es-CO', {
		style: 'currency',
		currency: 'COP',
		maximumFractionDigits: 0
	}).format(amount);
}

export function formatCOPPlain(amount: number): string {
	return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount);
}

export function pct(part: number, total: number): number {
	if (total <= 0) return 0;
	return Math.round((part / total) * 1000) / 10;
}

export function clampPct(value: number): number {
	return Math.min(100, Math.max(0, value));
}

export function matchesSource(source: Source, filter: SourceFilter): boolean {
	if (filter === 'all') return true;
	return source === filter || source === 'Joint';
}

export function isSameMonth(date: Date, month: number, year: number): boolean {
	return date.getMonth() === month && date.getFullYear() === year;
}

export const seedPockets: Pocket[] = [
	{ id: 'hogar', name: 'Hogar & Servicios', allocated_budget: 2_647_500, color_hex: '#00DF81' },
	{ id: 'mercado', name: 'Mercado & Despensa', allocated_budget: 250_000, color_hex: '#2CC295' },
	{ id: 'general', name: 'General / Varios', allocated_budget: 250_000, color_hex: '#5EEAD4' },
	{ id: 'creditos', name: 'Créditos & Educación', allocated_budget: 1_161_000, color_hex: '#34D399' },
	{ id: 'familia', name: 'Familia & Movilidad', allocated_budget: 690_000, color_hex: '#A3E635' },
	{ id: 'salud', name: 'Salud & Cuidado', allocated_budget: 400_000, color_hex: '#FBBF24' },
	{ id: 'gustos', name: 'Gustos & Extra', allocated_budget: 388_000, color_hex: '#F59E0B' }
];

const d = (day: number) => new Date(2026, 8, day);

export const seedTransactions: Transaction[] = [
	{ id: 'i1', amount: 3_600_000, date: d(1), type: 'income', source: 'Juan', classification: 'None', method: 'Digital', note: 'Salary Juan · Nómina 1' },
	{ id: 'i2', amount: 4_000_000, date: d(2), type: 'income', source: 'Juan', classification: 'None', method: 'Digital', note: 'Liquidación Juan · Extraordinario' },
	{ id: 'i3', amount: 2_800_000, date: d(3), type: 'income', source: 'Juan', classification: 'None', method: 'Digital', note: 'Cesaritar Juan · Fondo precavido' },
	{ id: 'i4', amount: 5_712_000, date: d(1), type: 'income', source: 'Pao', classification: 'None', method: 'Digital', note: 'Salary Paola · Nómina 1' },
	{ id: 'i5', amount: 6_667_000, date: d(5), type: 'income', source: 'Joint', classification: 'None', method: 'Digital', note: 'CDT Fondo Financiero · Rendimiento' },
	{ id: 'i6', amount: 58_135_000, date: d(6), type: 'income', source: 'Joint', classification: 'None', method: 'Digital', note: 'MPF Invest · Rendimiento de capital' },
	{ id: 'i7', amount: 2_427_623, date: d(4), type: 'income', source: 'Pao', classification: 'None', method: 'Digital', note: 'Bolsillos Paola · Asignado' },

	{ id: 'e1', amount: 344_000, date: d(5), type: 'expense', pocket_id: 'hogar', source: 'Juan', classification: 'Need', method: 'Digital', note: 'Administración Juan', paid: true },
	{ id: 'e2', amount: 60_000, date: d(6), type: 'expense', pocket_id: 'hogar', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Agua', paid: true },
	{ id: 'e3', amount: 100_000, date: d(7), type: 'expense', pocket_id: 'hogar', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Celulares', paid: true },
	{ id: 'e4', amount: 1_008_300, date: d(8), type: 'expense', pocket_id: 'hogar', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Remodelación', paid: false },
	{ id: 'e5', amount: 85_200, date: d(9), type: 'expense', pocket_id: 'hogar', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Luz', paid: true },
	{ id: 'e6', amount: 120_000, date: d(10), type: 'expense', pocket_id: 'hogar', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Internet', paid: true },
	{ id: 'e7', amount: 930_000, date: d(11), type: 'expense', pocket_id: 'hogar', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Skandia Hogar', paid: false },

	{ id: 'e8', amount: 250_000, date: d(4), type: 'expense', pocket_id: 'mercado', source: 'Pao', classification: 'Need', method: 'Efectivo', note: 'Mercado semanal', paid: true },
	{ id: 'e9', amount: 250_000, date: d(12), type: 'expense', pocket_id: 'general', source: 'Juan', classification: 'Need', method: 'Digital', note: 'Gastos generales', paid: true },

	{ id: 'e10', amount: 636_000, date: d(3), type: 'expense', pocket_id: 'creditos', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Crédito hipotecario', paid: true },
	{ id: 'e11', amount: 525_000, date: d(3), type: 'expense', pocket_id: 'creditos', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Universidad', paid: true },

	{ id: 'e12', amount: 70_000, date: d(14), type: 'expense', pocket_id: 'familia', source: 'Juan', classification: 'Need', method: 'Efectivo', note: 'Gasolina carro / moto', paid: true },
	{ id: 'e13', amount: 500_000, date: d(1), type: 'expense', pocket_id: 'familia', source: 'Joint', classification: 'Need', method: 'Efectivo', note: 'Mesada familiar', paid: true },
	{ id: 'e14', amount: 120_000, date: d(15), type: 'expense', pocket_id: 'familia', source: 'Pao', classification: 'Want', method: 'Digital', note: 'Suscripciones premium', paid: true },

	{ id: 'e15', amount: 400_000, date: d(16), type: 'expense', pocket_id: 'salud', source: 'Joint', classification: 'Need', method: 'Digital', note: 'Salud y medicamentos', paid: true },
	{ id: 'e16', amount: 388_000, date: d(18), type: 'expense', pocket_id: 'gustos', source: 'Pao', classification: 'Want', method: 'Digital', note: 'Restaurantes y extras', paid: false }
];

export const seedGoals: GoalTracker[] = [
	{
		id: 'skandia',
		type: 'saving',
		name: 'Portafolio Skandia',
		target_amount: 4_360_000,
		current_amount: 3_970_000,
		subtitle: '10 depósitos · programado mensual'
	},
	{
		id: 'mpf',
		type: 'saving',
		name: 'Inversión MPF',
		target_amount: 12_240_300,
		current_amount: 1_020_025,
		subtitle: 'Patrimonial · cash al alza'
	},
	{
		id: 'patrimonio',
		type: 'saving',
		name: 'Patrimonio acumulado',
		target_amount: 38_000_000,
		current_amount: 35_006_975,
		subtitle: 'Meta anual 2026'
	},
	{
		id: 'paola-loan',
		type: 'loan',
		name: 'Paola · Crédito',
		target_amount: 7_000_000,
		current_amount: 0,
		subtitle: 'Interés generado · $1.500.000',
		deadline: new Date(2027, 2, 1)
	},
	{
		id: 'kevin-loan',
		type: 'loan',
		name: 'Kevin',
		target_amount: 500_000,
		current_amount: 143_500,
		subtitle: 'Préstamo personal'
	},
	{
		id: 'daniel-loan',
		type: 'loan',
		name: 'Daniel & Pau',
		target_amount: 1_000_000,
		current_amount: 0,
		subtitle: 'Vence 1 dic 2026',
		deadline: new Date(2026, 11, 1)
	},
	{
		id: 'jessica-loan',
		type: 'loan',
		name: 'Jessica',
		target_amount: 250_000,
		current_amount: 0,
		subtitle: 'Artículos'
	}
];
