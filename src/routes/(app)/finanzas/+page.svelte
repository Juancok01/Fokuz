<script lang="ts">
	import { 
		LineChart, Download, ChevronLeft, ChevronRight, TrendingUp, Plus,
		CreditCard, Home, Cloud, ShoppingCart, Zap, ShieldCheck, CheckCircle2,
		Info, Lock, Smartphone, RefreshCw, Wallet, PiggyBank, CalendarDays
	} from 'lucide-svelte';

	// Mock Data for Cash Flow Chart
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

	// Mock Transactions
	const transactions = [
		{
			title: 'Nómina Quincenal Tech Corp',
			type: 'Ingreso',
			date: '15 Septiembre',
			method: 'Transferencia directa SPEI / ACH',
			amount: '+$2,100.00',
			status: 'Completado',
			isIncome: true,
			icon: Plus,
			iconBg: 'bg-brand-accent/20 text-brand-accent'
		},
		{
			title: 'Alquiler Apartamento Septiembre',
			type: 'Vivienda',
			date: '05 Septiembre',
			method: 'Débito Cuenta Corriente',
			amount: '-$850.00',
			status: 'Recurrente mensual',
			isIncome: false,
			icon: Home,
			iconBg: 'bg-red-500/10 text-red-400'
		},
		{
			title: 'Suscripción Cloud AWS & GitHub Copilot',
			type: 'Tech & Dev',
			date: '10 Septiembre',
			method: 'Tarjeta Visa Fokuz Platinum',
			amount: '-$67.00',
			status: 'Automático',
			isIncome: false,
			icon: Cloud,
			iconBg: 'bg-blue-500/10 text-blue-400'
		},
		{
			title: 'Supermercado Orgánico & Víveres',
			type: 'Alimentación',
			date: '12 Septiembre',
			method: 'Tarjeta Débito Contactless',
			amount: '-$145.20',
			status: 'Comprobante #941',
			isIncome: false,
			icon: ShoppingCart,
			iconBg: 'bg-emerald-500/10 text-emerald-400'
		},
		{
			title: 'Freelance UI Design - Entrega Fase 1',
			type: 'Ingreso Extra',
			date: '14 Septiembre',
			method: 'Factura #042 pagada',
			amount: '+$450.00',
			status: 'Stripe Payout',
			isIncome: true,
			icon: Zap,
			iconBg: 'bg-brand-accent/20 text-brand-accent'
		},
		{
			title: 'Pago Cuota 14/36 - Préstamo Coche',
			type: 'Crédito',
			date: '02 Septiembre',
			method: 'Débito Directo Automático',
			amount: '-$280.00',
			status: 'Restan 22 cuotas',
			isIncome: false,
			icon: ShieldCheck,
			iconBg: 'bg-amber-500/10 text-amber-400'
		}
	];
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
				<div class="flex items-center gap-3">
					<h1 class="text-xl font-bold text-brand-text">Finanzas & Control Patrimonial</h1>
					<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/30">Septiembre 2026</span>
				</div>
				<p class="text-xs text-brand-text-muted mt-1 font-medium">Visión unificada de liquidez, flujos de caja y estado de créditos</p>
			</div>
		</div>

		<div class="flex items-center gap-3">
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
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 shadow-sm">
			<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">Balance Neto Total</p>
			<p class="text-2xl font-black text-brand-text mb-2">$8,450.00 <span class="text-xs text-brand-text-muted font-bold">USD</span></p>
			<p class="text-[10px] font-bold text-brand-accent flex items-center gap-1"><TrendingUp class="w-3 h-3" /> +12.4% vs mes anterior</p>
		</div>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 shadow-sm relative overflow-hidden">
			<div class="absolute inset-0 bg-brand-accent/5"></div>
			<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-widest mb-2 relative z-10">Ingresos del mes</p>
			<p class="text-2xl font-black text-brand-accent mb-2 relative z-10">+$4,200.00 <span class="text-xs text-brand-text-muted font-bold">USD</span></p>
			<p class="text-[10px] font-bold text-brand-text-muted relative z-10">Meta: $4,500 <span class="text-brand-accent">(93%)</span></p>
		</div>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 shadow-sm">
			<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">Gastos Acumulados</p>
			<p class="text-2xl font-black text-red-400 mb-2">-$2,180.00 <span class="text-xs text-brand-text-muted font-bold">USD</span></p>
			<p class="text-[10px] font-bold text-brand-text-muted">Presupuesto rest.: <span class="text-brand-text">$820.00</span></p>
		</div>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 shadow-sm">
			<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">Tasa de Ahorro</p>
			<p class="text-2xl font-black text-brand-text mb-2">48.1%</p>
			<p class="text-[10px] font-bold text-brand-text-muted flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Ritmo saludable > 35%</p>
		</div>
		<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-5 shadow-sm">
			<p class="text-[9px] font-bold text-brand-text-muted uppercase tracking-widest mb-2">Total Créditos / Deuda</p>
			<p class="text-2xl font-black text-amber-400 mb-2">$12,850.00 <span class="text-xs text-brand-text-muted font-bold">USD</span></p>
			<p class="text-[10px] font-bold text-brand-text-muted">3 compromisos vigentes</p>
		</div>
	</div>

	<!-- Main Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
		
		<!-- Left Column: Charts & Transactions -->
		<div class="lg:col-span-8 flex flex-col gap-6">
			
			<!-- Chart Card -->
			<div class="bg-[#0d1216] border border-brand-divider rounded-2xl p-6 shadow-sm">
				<div class="flex items-center justify-between mb-8">
					<div>
						<h2 class="text-sm font-bold text-brand-text mb-1 flex items-center gap-2">Flujo de Dinero & Distribución de Gastos <span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span></h2>
						<p class="text-[10px] text-brand-text-muted font-medium">Comparativa de ingresos diarios versus gastos ejecutados en septiembre</p>
					</div>
					<div class="flex items-center gap-3 text-[10px] font-bold">
						<span class="flex items-center gap-1.5 text-brand-text"><span class="w-2 h-2 rounded-full bg-brand-accent"></span> Ingresos</span>
						<span class="flex items-center gap-1.5 text-brand-text"><span class="w-2 h-2 rounded-full bg-red-400"></span> Gastos</span>
					</div>
				</div>

				<!-- Pure CSS Mock Chart -->
				<div class="h-48 w-full flex items-end justify-between px-2 mb-8 relative border-b border-brand-divider/50">
					<!-- Helper grid lines -->
					<div class="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
						<div class="w-full h-px bg-brand-text"></div>
						<div class="w-full h-px bg-brand-text"></div>
						<div class="w-full h-px bg-brand-text"></div>
						<div class="w-full h-px bg-brand-text"></div>
					</div>
					
					{#each cashFlowDays as p}
						<div class="flex flex-col items-center gap-2 h-full justify-end z-10 w-8">
							<div class="flex items-end gap-1 h-full w-full justify-center group relative">
								<!-- In -->
								<div class="w-1.5 bg-brand-accent rounded-t-sm shadow-[0_0_5px_var(--color-brand-accent-muted)] transition-all group-hover:w-2" style="height: {p.in}%"></div>
								<!-- Out -->
								<div class="w-1.5 bg-red-400 rounded-t-sm shadow-[0_0_5px_rgba(248,113,113,0.3)] transition-all group-hover:w-2" style="height: {p.out}%"></div>
								
								<!-- Tooltip on hover -->
								<div class="absolute -top-10 bg-brand-surface border border-brand-divider rounded p-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col gap-0.5 text-[8px] font-bold whitespace-nowrap z-20">
									<span class="text-brand-accent">In: +${p.in * 20}</span>
									<span class="text-red-400">Out: -${p.out * 20}</span>
								</div>
							</div>
							<span class="text-[9px] font-bold {p.isToday ? 'text-brand-accent' : 'text-brand-text-muted'}">{p.day}{p.isToday ? ' (Hoy)' : ''}</span>
						</div>
					{/each}
				</div>

				<!-- Categories Breakdown -->
				<div class="mb-4">
					<div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest mb-3">
						<span class="text-brand-text">Desglose por categorías de gasto</span>
						<span class="text-brand-text-muted">Total: $2,180.00 USD</span>
					</div>
					
					<!-- Segmented Bar -->
					<div class="h-2 w-full flex rounded-full overflow-hidden mb-4">
						<div class="h-full bg-brand-accent" style="width: 39%"></div>
						<div class="h-full bg-emerald-400" style="width: 19%"></div>
						<div class="h-full bg-blue-400" style="width: 10%"></div>
						<div class="h-full bg-amber-400" style="width: 8%"></div>
						<div class="h-full bg-pink-400" style="width: 24%"></div>
					</div>

					<!-- Legend -->
					<div class="flex items-start justify-between flex-wrap gap-2 text-[10px]">
						<div>
							<span class="flex items-center gap-1.5 font-bold text-brand-text mb-1"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent"></span> Vivienda</span>
							<p class="font-black text-sm">$850 <span class="font-normal text-brand-text-muted text-[9px]">(39%)</span></p>
						</div>
						<div>
							<span class="flex items-center gap-1.5 font-bold text-brand-text mb-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Alimentación</span>
							<p class="font-black text-sm">$420 <span class="font-normal text-brand-text-muted text-[9px]">(19%)</span></p>
						</div>
						<div>
							<span class="flex items-center gap-1.5 font-bold text-brand-text mb-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Servicios Tech</span>
							<p class="font-black text-sm">$210 <span class="font-normal text-brand-text-muted text-[9px]">(10%)</span></p>
						</div>
						<div>
							<span class="flex items-center gap-1.5 font-bold text-brand-text mb-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Transporte</span>
							<p class="font-black text-sm">$180 <span class="font-normal text-brand-text-muted text-[9px]">(8%)</span></p>
						</div>
						<div>
							<span class="flex items-center gap-1.5 font-bold text-brand-text mb-1"><span class="w-1.5 h-1.5 rounded-full bg-pink-400"></span> Ocio & Otros</span>
							<p class="font-black text-sm">$520 <span class="font-normal text-brand-text-muted text-[9px]">(24%)</span></p>
						</div>
					</div>
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
						<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-xl p-4 hover:border-brand-accent/30 transition-colors group">
							<div class="flex items-center gap-4">
								<div class="w-10 h-10 rounded-xl {t.iconBg} flex items-center justify-center shrink-0">
									<t.icon class="w-5 h-5" />
								</div>
								<div>
									<div class="flex items-center gap-2 mb-1">
										<h3 class="text-xs font-bold text-brand-text">{t.title}</h3>
										<span class="px-1.5 py-0.5 rounded text-[8px] font-bold border {t.isIncome ? 'bg-brand-accent/10 border-brand-accent/30 text-brand-accent' : 'bg-brand-surface border-brand-divider text-brand-text-muted'}">{t.type}</span>
									</div>
									<p class="text-[10px] text-brand-text-muted font-medium">
										{t.date} <span class="opacity-50 mx-1">•</span> {t.method}
									</p>
								</div>
							</div>
							<div class="text-right">
								<p class="text-sm font-black mb-1 {t.isIncome ? 'text-brand-accent' : 'text-red-400'}">{t.amount}</p>
								<p class="text-[9px] text-brand-text-muted font-bold">{t.status}</p>
							</div>
						</div>
					{/each}
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
	<button class="fixed bottom-10 right-10 w-14 h-14 bg-brand-accent hover:brightness-110 text-brand-bg font-bold rounded-full flex items-center justify-center shadow-[0_0_20px_var(--color-brand-accent-muted)] hover:scale-105 transition-all z-20">
		<Plus class="w-6 h-6" />
	</button>
</div>
