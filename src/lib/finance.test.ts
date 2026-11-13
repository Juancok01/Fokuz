import { describe, expect, it } from 'vitest';
import {
	addDaysISO,
	balanceAt,
	balanceDeltaPct,
	budgetTone,
	digitsOnly,
	formatCOP,
	formatDigits,
	monthStartISO,
	pctChange,
	projectedMonthClose,
	savingsRatePct,
	signedAmount,
	sumByType,
	txInRange,
	type TxType
} from './finance';

const tx = (type: TxType, amount: number | string, date = '2026-11-12') => ({ type, amount: amount as number, date });

// Caso real probado en producción durante la auditoría:
// saldo inicial 1.000.000, ingreso 2.000.000, gasto 300.000, ahorro 200.000
const MOVIMIENTOS = [tx('income', 2_000_000), tx('expense', 300_000), tx('saving', 200_000)];

describe('saldo', () => {
	it('ingreso suma; gasto y ahorro restan', () => {
		expect(signedAmount(tx('income', 100))).toBe(100);
		expect(signedAmount(tx('expense', 100))).toBe(-100);
		expect(signedAmount(tx('saving', 100))).toBe(-100);
	});

	it('1.000.000 + 2.000.000 − 300.000 − 200.000 = 2.500.000', () => {
		expect(balanceAt(1_000_000, MOVIMIENTOS)).toBe(2_500_000);
	});

	it('acepta saldo inicial negativo (deuda)', () => {
		expect(balanceAt(-500_000, [tx('income', 100_000), tx('expense', 60_000)])).toBe(-460_000);
	});

	it('Supabase devuelve montos numéricos como texto: igual suma bien', () => {
		expect(balanceAt('1000000', [tx('income', '2000000'), tx('expense', '300000.50')])).toBeCloseTo(2_699_999.5);
	});

	it('saldo inicial vacío cuenta como 0', () => {
		expect(balanceAt(null, [tx('income', 50)])).toBe(50);
		expect(balanceAt(undefined, [])).toBe(0);
	});

	it('balanceAt con fecha solo cuenta movimientos anteriores a ese día', () => {
		const list = [tx('income', 100, '2026-10-31'), tx('income', 50, '2026-11-01'), tx('expense', 30, '2026-11-15')];
		expect(balanceAt(0, list, '2026-11-01')).toBe(100); // saldo al inicio de noviembre
		expect(balanceAt(0, list, '2026-12-01')).toBe(120); // saldo al cierre de noviembre
	});

	it('maneja más de 1000 movimientos (ya no se cortan en la carga)', () => {
		const many = Array.from({ length: 1500 }, () => tx('income', 1000));
		expect(balanceAt(0, many)).toBe(1_500_000);
	});
});

describe('totales del mes', () => {
	it('suma por tipo', () => {
		expect(sumByType(MOVIMIENTOS, 'income')).toBe(2_000_000);
		expect(sumByType(MOVIMIENTOS, 'expense')).toBe(300_000);
		expect(sumByType(MOVIMIENTOS, 'saving')).toBe(200_000);
	});

	it('filtra por rango [inicio, fin) del mes', () => {
		const list = [tx('income', 1, '2026-10-31'), tx('income', 2, '2026-11-01'), tx('income', 3, '2026-11-30'), tx('income', 4, '2026-12-01')];
		const nov = txInRange(list, monthStartISO(2026, 10), monthStartISO(2026, 11));
		expect(nov.map((t) => t.amount)).toEqual([2, 3]);
	});

	it('capacidad de ahorro: (ingresos − gastos) / ingresos', () => {
		expect(savingsRatePct(2_000_000, 300_000)).toBe(85);
		expect(savingsRatePct(0, 300_000)).toBe(0); // sin ingresos no se divide por 0
		expect(savingsRatePct(100, 150)).toBe(-50);
	});

	it('cierre estimado proyecta el gasto diario promedio y descuenta lo ahorrado', () => {
		// día 12 de un mes de 30: 300.000 de gasto → 25.000/día → 750.000 en el mes
		expect(
			projectedMonthClose({ startBalance: 1_000_000, income: 2_000_000, expense: 300_000, saved: 200_000, dayOfMonth: 12, daysInMonth: 30 })
		).toBe(2_050_000);
	});

	it('cierre estimado el día 0 no divide por cero', () => {
		expect(Number.isFinite(projectedMonthClose({ startBalance: 0, income: 0, expense: 100, saved: 0, dayOfMonth: 0, daysInMonth: 30 }))).toBe(true);
	});
});

describe('comparaciones', () => {
	it('variación vs. mes anterior; sin base no se compara', () => {
		expect(pctChange(150, 100)).toBe(50);
		expect(pctChange(0, 100)).toBe(-100);
		expect(pctChange(100, 0)).toBeNull();
	});

	it('variación del saldo usa el valor absoluto del saldo inicial (sirve con deudas)', () => {
		expect(balanceDeltaPct(1_000_000, 2_500_000)).toBe(150);
		expect(balanceDeltaPct(-500_000, -460_000)).toBe(8); // la deuda bajó: mejora
		expect(balanceDeltaPct(0, 100)).toBeNull();
	});

	it('tono del presupuesto: <85 bien, 85–99 alerta, ≥100 excedido', () => {
		expect(budgetTone(84)).toBe('good');
		expect(budgetTone(85)).toBe('warning');
		expect(budgetTone(100)).toBe('critical');
		expect(budgetTone(133)).toBe('critical');
	});
});

describe('formato y entrada de montos', () => {
	it('formatea pesos colombianos sin decimales', () => {
		expect(formatCOP(2_500_000).replace(/\s/g, ' ')).toBe('$ 2.500.000');
		expect(formatCOP('abc').replace(/\s/g, ' ')).toBe('$ 0');
	});

	it('digitsOnly deja solo dígitos, sin ceros a la izquierda y con límite', () => {
		expect(digitsOnly('$ 1.200.000')).toBe('1200000');
		expect(digitsOnly('000450')).toBe('450');
		expect(digitsOnly('9'.repeat(20))).toHaveLength(12);
	});

	it('formatDigits muestra separadores de miles', () => {
		expect(formatDigits('1200000')).toBe('1.200.000');
		expect(formatDigits('')).toBe('0');
	});

	it('fechas locales: suma de días y primer día del mes (incluso con mes 12 o -1)', () => {
		expect(addDaysISO('2026-11-30', 1)).toBe('2026-12-01');
		expect(monthStartISO(2026, 12)).toBe('2027-01-01');
		expect(monthStartISO(2026, -1)).toBe('2025-12-01');
	});
});
