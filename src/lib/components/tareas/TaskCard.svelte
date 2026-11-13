<script lang="ts">
	import type { Contact } from "./types";
	import { AlertTriangle, CheckCircle2, Circle, ListChecks, Timer } from "@lucide/svelte";
	import { formatLocalDate, getDeadlineStyles } from "$lib/boardUtils";
	import { hasDeadline, taskRangeLabel } from "$lib/taskTime";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		contacts,
		openTaskUpdate,
		task,
		toggleTask
	}: {
		contacts: Contact[];
		openTaskUpdate: (...args: any[]) => any;
		task: any;
		toggleTask: (...args: any[]) => any;
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="bg-[#070b0e] border border-brand-divider rounded-xl p-4 shadow-sm hover:border-brand-accent/50 transition-colors group cursor-grab active:cursor-grabbing relative overflow-hidden"
	onclick={() => openTaskUpdate(task)}
>
	<!-- Mock Tag & Priority -->
	<div
		class="flex items-center justify-between mb-3"
	>
		{#if task.tags}
			<span
				class="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase"
				style="background: {task.tags
					.color}15; color: {task.tags
					.color}; border: 1px solid {task
					.tags.color}30"
			>
				{task.tags.name}
			</span>
		{:else}
			<span
				class="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase bg-brand-surface-elevated text-brand-text-muted border border-brand-divider"
			>
				General
			</span>
		{/if}

		<div class="flex items-center gap-2">
			{#if task.parent_task_id}
				<span
					class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/20"
				>
					<ListChecks
						class="w-3 h-3"
					/> Subtarea
				</span>
			{/if}
			<!-- Deadline -->
			{#if hasDeadline(task)}
				{@const dStyles =
					getDeadlineStyles(
						task.end_date,
					)}
				<span
					class="flex items-center gap-1 text-[9px] font-bold border px-1.5 py-0.5 rounded-md {dStyles.badge}"
				>
					<Timer class="w-3 h-3" />
					{formatLocalDate(
						task.end_date,
					)}
				</span>
			{/if}

			{#if task.novedad}
				<div
					class="w-5 h-5 flex items-center justify-center rounded bg-amber-500 text-brand-bg shadow-[0_0_8px_var(--color-amber-500-muted)] tooltip tooltip-left"
					data-tip="Tarea bloqueada"
				>
					<AlertTriangle
						class="w-3.5 h-3.5"
						strokeWidth="3"
					/>
				</div>
			{/if}
		</div>
	</div>

	<!-- Title & Completion -->
	<div class="flex items-start gap-2 mb-2">
		<button
			class="mt-0.5 shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors"
			onclick={(e) => {
				e.stopPropagation();
				toggleTask(task.id);
			}}
		>
			{#if task.is_completed}
				<CheckCircle2
					class="w-4 h-4 text-brand-accent"
				/>
			{:else}
				<Circle class="w-4 h-4" />
			{/if}
		</button>
		<h4
			class="text-[13px] font-bold text-brand-text leading-snug group-hover:text-brand-accent transition-colors {task.is_completed
				? 'line-through opacity-50'
				: ''}"
		>
			{task.title}
		</h4>
	</div>
	{#if taskRangeLabel(task)}
		<p class="text-[10px] font-black text-brand-accent tabular-nums mb-2 pl-6">
			{taskRangeLabel(task)}
		</p>
	{/if}

	<!-- Description -->
	{#if task.description}
		<p
			class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-3 mb-3 border-l-2 border-brand-divider pl-2"
		>
			{task.description.replace(
				/<[^>]*>?/gm,
				"",
			)}
		</p>
	{/if}

	<!-- Footer Icons & Avatars -->
	<div
		class="flex items-center justify-between pt-1"
	>
		<div
			class="flex items-center gap-3 text-[10px] font-medium text-brand-text-muted"
		>
			<!-- Future: add comment count or attachments here -->
		</div>
		<div
			class="flex items-center -space-x-2"
		>
			<div
				class="w-6 h-6 rounded-full bg-brand-accent/20 border border-brand-accent/50 flex items-center justify-center text-[9px] font-bold text-brand-accent relative z-10"
				title="Propietario"
			>
				JN
			</div>
			{#if task.is_shared || task.is_shared_with_me}
				{#each contacts.slice(0, 1) as contact, i}
					<div
						class="w-6 h-6 rounded-full bg-brand-surface-elevated border border-brand-divider flex items-center justify-center text-[9px] font-bold text-brand-text-muted relative"
						style="z-index: {9 - i}"
						title={contact.display_name}
					>
						{contact.nickname
							? contact.nickname
									.substring(
										0,
										2,
									)
									.toUpperCase()
							: contact.display_name
									.substring(
										0,
										2,
									)
									.toUpperCase()}
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
