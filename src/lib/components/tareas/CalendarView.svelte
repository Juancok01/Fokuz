<script lang="ts">
	import { ChevronLeft, ChevronRight, Plus } from "@lucide/svelte";
	import { getDeadlineStyles } from "$lib/boardUtils";
	import { composeDateTime, localDayString } from "$lib/taskTime";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		boardCalendarDays,
		calendarCurrentMonth = $bindable(),
		getTasksForCalendarDate,
		newTaskStartDate = $bindable(),
		nextCalMonth,
		openTaskUpdate,
		prevCalMonth,
		showNewTask = $bindable()
	}: {
		boardCalendarDays: any;
		calendarCurrentMonth: any;
		getTasksForCalendarDate: (...args: any[]) => any;
		newTaskStartDate: any;
		nextCalMonth: (...args: any[]) => any;
		openTaskUpdate: (...args: any[]) => any;
		prevCalMonth: (...args: any[]) => any;
		showNewTask: boolean;
	} = $props();
</script>

<!-- Calendar View -->
<div
	class="flex-1 min-h-0 overflow-hidden p-2 md:p-6 bg-[#070b0e] flex flex-col"
>
	<div class="max-w-6xl mx-auto w-full h-full min-h-0 flex flex-col">
		<!-- Cabecera Mes -->
		<div
			class="flex items-center justify-between mb-3 bg-[#0d1216] border border-brand-divider p-3 rounded-2xl shadow-sm shrink-0"
		>
			<h2
				class="text-lg font-bold text-brand-text px-3 capitalize"
			>
				{calendarCurrentMonth.toLocaleDateString("es-ES", {
					month: "long",
					year: "numeric",
				})}
			</h2>
			<div class="flex items-center gap-2">
				<button
					class="p-2 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted transition-colors"
					onclick={prevCalMonth}
				>
					<ChevronLeft class="w-5 h-5" />
				</button>
				<button
					class="px-4 py-1.5 bg-brand-surface-elevated text-xs font-bold text-brand-accent rounded-lg border border-brand-divider"
					onclick={() => (calendarCurrentMonth = new Date())}
				>
					Hoy
				</button>
				<button
					class="p-2 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted transition-colors"
					onclick={nextCalMonth}
				>
					<ChevronRight class="w-5 h-5" />
				</button>
			</div>
		</div>

		<!-- Grid Calendario -->
		<div
			class="flex-1 min-h-0 bg-[#0d1216] border border-brand-divider rounded-2xl overflow-hidden flex flex-col shadow-lg"
		>
			<div
				class="grid grid-cols-7 border-b border-brand-divider bg-brand-surface shrink-0"
			>
				{#each ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as day}
					<div
						class="py-2.5 text-center text-xs font-bold text-brand-text-muted uppercase tracking-wider"
					>
						{day}
					</div>
				{/each}
			</div>

			<div
				class="grid grid-cols-7 flex-1 min-h-0"
				style="grid-template-rows: repeat({boardCalendarDays.length / 7}, minmax(0, 1fr))"
			>
				{#each boardCalendarDays as day, i}
					{@const lastRow = i >= boardCalendarDays.length - 7}
					<div
						class="min-h-0 h-full flex flex-col p-1.5 md:p-2 border-r border-b border-brand-divider/50 {i %
							7 ===
						6
							? 'border-r-0'
							: ''} {lastRow
							? 'border-b-0'
							: ''} {!day.currentMonth
							? 'bg-[#070b0e] opacity-50'
							: 'bg-[#0d1216]'} relative group transition-colors hover:bg-brand-surface-elevated/30"
					>
						<div
							class="flex justify-between items-start mb-1 shrink-0"
						>
							<span
								class="w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold {day.isToday
									? 'bg-brand-accent text-brand-bg shadow-[0_0_8px_var(--color-brand-accent-muted)]'
									: 'text-brand-text'}"
							>
								{day.date.getDate()}
							</span>
							<button
								class="w-6 h-6 rounded-md hover:bg-brand-surface-elevated text-brand-text-muted opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
								onclick={() => {
									newTaskStartDate = composeDateTime(
										localDayString(day.date),
									);
									showNewTask = true;
								}}
							>
								<Plus class="w-4 h-4" />
							</button>
						</div>

						<div
							class="flex-1 min-h-0 space-y-1 overflow-y-auto custom-scrollbar pr-0.5"
						>
							{#each getTasksForCalendarDate(day.date) as task}
								{@const dStyles = getDeadlineStyles(
									task.end_date || task.date,
								)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 truncate border cursor-pointer hover:brightness-110 transition-all {task.is_completed
										? 'bg-brand-surface/50 border-brand-divider text-brand-text-muted line-through'
										: `bg-brand-surface-elevated ${dStyles.border} text-brand-text shadow-sm`}"
									title={task.title}
									onclick={() => openTaskUpdate(task)}
								>
									<div
										class="w-1.5 h-1.5 rounded-full shrink-0 {task.is_completed
											? 'bg-brand-text-muted'
											: dStyles.bg}"
									></div>
									<span class="truncate"
										>{task.title}</span
									>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
