import {
	seedGoals,
	seedPockets,
	seedTransactions,
	isSameMonth,
	matchesSource,
	type Classification,
	type FinanceTab,
	type GoalTracker,
	type PaymentMethod,
	type Pocket,
	type Source,
	type SourceFilter,
	type Transaction,
	type TransactionType
} from './finanzas';

export const financeUI = $state({
	tab: 'dashboard' as FinanceTab,
	month: 8,
	year: 2026,
	sourceFilter: 'all' as SourceFilter,
	modalOpen: false,
	modalKind: 'expense' as 'expense' | 'saving' | 'loan'
});

export const financeData = $state({
	pockets: structuredClone(seedPockets) as Pocket[],
	transactions: seedTransactions.map((tx) => ({ ...tx, date: new Date(tx.date) })),
	goals: structuredClone(seedGoals) as GoalTracker[]
});

export function visibleTransactions(): Transaction[] {
	return financeData.transactions.filter(
		(tx) =>
			isSameMonth(tx.date, financeUI.month, financeUI.year) &&
			matchesSource(tx.source, financeUI.sourceFilter)
	);
}

export function pocketSpent(pocketId: string): number {
	return visibleTransactions()
		.filter((tx) => tx.type === 'expense' && tx.pocket_id === pocketId)
		.reduce((sum, tx) => sum + tx.amount, 0);
}

export function financeSummary() {
	const txs = visibleTransactions();
	const incomes = txs.filter((tx) => tx.type === 'income');
	const expenses = txs.filter((tx) => tx.type === 'expense');
	const totalIncome = incomes.reduce((sum, tx) => sum + tx.amount, 0);
	const totalSpent = expenses.reduce((sum, tx) => sum + tx.amount, 0);
	const need = expenses
		.filter((tx) => tx.classification === 'Need')
		.reduce((sum, tx) => sum + tx.amount, 0);
	const want = expenses
		.filter((tx) => tx.classification === 'Want')
		.reduce((sum, tx) => sum + tx.amount, 0);
	const allocated = financeData.pockets.reduce((sum, pocket) => sum + pocket.allocated_budget, 0);
	const savings = financeData.goals
		.filter((goal) => goal.type === 'saving')
		.reduce((sum, goal) => sum + goal.current_amount, 0);
	const loansOutstanding = financeData.goals
		.filter((goal) => goal.type === 'loan')
		.reduce((sum, goal) => sum + Math.max(0, goal.target_amount - goal.current_amount), 0);
	const net = totalIncome - totalSpent;
	const juanIncome = incomes.filter((tx) => tx.source === 'Juan').reduce((sum, tx) => sum + tx.amount, 0);
	const paoIncome = incomes.filter((tx) => tx.source === 'Pao').reduce((sum, tx) => sum + tx.amount, 0);
	const jointIncome = incomes.filter((tx) => tx.source === 'Joint').reduce((sum, tx) => sum + tx.amount, 0);

	return {
		incomes,
		expenses,
		totalIncome,
		totalSpent,
		need,
		want,
		allocated,
		savings,
		loansOutstanding,
		net,
		juanIncome,
		paoIncome,
		jointIncome,
		spentPct: totalIncome > 0 ? (totalSpent / totalIncome) * 100 : 0,
		savedPct: totalIncome > 0 ? (savings / (savings + totalIncome)) * 100 : 0,
		incomeCount: incomes.length
	};
}

export function addTransaction(input: {
	amount: number;
	type: TransactionType;
	pocket_id?: string;
	goal_id?: string;
	source: Source;
	classification: Classification;
	method: PaymentMethod;
	note: string;
}) {
	const tx: Transaction = {
		id: crypto.randomUUID(),
		amount: input.amount,
		date: new Date(financeUI.year, financeUI.month, new Date().getDate()),
		type: input.type,
		pocket_id: input.pocket_id,
		goal_id: input.goal_id,
		source: input.source,
		classification: input.classification,
		method: input.method,
		note: input.note,
		paid: true
	};
	financeData.transactions = [tx, ...financeData.transactions];

	if (input.goal_id && (input.type === 'transfer' || input.type === 'income')) {
		financeData.goals = financeData.goals.map((goal) =>
			goal.id === input.goal_id
				? { ...goal, current_amount: goal.current_amount + input.amount }
				: goal
		);
	}
}

export function togglePaid(id: string) {
	financeData.transactions = financeData.transactions.map((tx) =>
		tx.id === id ? { ...tx, paid: !tx.paid } : tx
	);
}

export function shiftMonth(delta: number) {
	const date = new Date(financeUI.year, financeUI.month + delta, 1);
	financeUI.month = date.getMonth();
	financeUI.year = date.getFullYear();
}

export function openFinanceModal(kind: 'expense' | 'saving' | 'loan' = 'expense') {
	financeUI.modalKind = kind;
	financeUI.modalOpen = true;
}
