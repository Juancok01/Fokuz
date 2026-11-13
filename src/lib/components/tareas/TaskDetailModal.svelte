<script lang="ts">
	import TaskLinks from "$lib/components/tareas/TaskLinks.svelte";
	import TaskMembers from "$lib/components/tareas/TaskMembers.svelte";
	import TaskDates from "$lib/components/tareas/TaskDates.svelte";
	import TaskComments from "$lib/components/tareas/TaskComments.svelte";
	import TaskSubtasks from "$lib/components/tareas/TaskSubtasks.svelte";
	import TaskChecklists from "$lib/components/tareas/TaskChecklists.svelte";
	import type { Contact, TaskTag } from "./types";
	import { AlertTriangle, AlignLeft, ArrowLeft, Check, CheckCircle2, Circle, Kanban, Share2, Tag, Trash2, X } from "@lucide/svelte";
	import RichTextEditor from "$lib/components/RichTextEditor.svelte";
	import TagSelect from "$lib/components/TagSelect.svelte";
	// Props: estado y acciones del tablero ($bindable = este componente las modifica)
	let {
		setTaskHasLists,
		addSubtask,
		boardLists,
		contactLabel,
		contacts,
		currentBoard,
		deleteTask,
		editingDate = $bindable(),
		editingDescription = $bindable(),
		editingEndDate = $bindable(),
		editingNovedad = $bindable(),
		editingTagId = $bindable(),
		focusOnSelectedTask,
		openLinkNoteModal,
		openTaskUpdate,
		saveNovedad,
		saveTaskDetails,
		selectedTask,
		selectedTaskLinkedNoteId,
		selectedTaskLinkedNoteTitle,
		selectedTaskTitle = $bindable(),
		shareBusyId,
		sharedWithIds,
		showTags = $bindable(),
		showTaskOptions = $bindable(),
		showTaskUpdate = $bindable(),
		subtaskTitle = $bindable(),
		subtasks,
		tags,
		taskActionError,
		taskActionSuccess,
		tasks,
		toggleShareWithContact,
		toggleTask,
		unlinkNoteFromTask
	}: {
		setTaskHasLists: (taskId: number, hasLists: boolean) => void;
		addSubtask: (...args: any[]) => any;
		boardLists: any[];
		contactLabel: (...args: any[]) => any;
		contacts: Contact[];
		currentBoard: any;
		deleteTask: (...args: any[]) => any;
		editingDate: string;
		editingDescription: string;
		editingEndDate: string;
		editingNovedad: string;
		editingTagId: number | null;
		focusOnSelectedTask: (...args: any[]) => any;
		openLinkNoteModal: (...args: any[]) => any;
		openTaskUpdate: (...args: any[]) => any;
		saveNovedad: (...args: any[]) => any;
		saveTaskDetails: (...args: any[]) => any;
		selectedTask: any;
		selectedTaskLinkedNoteId: string | null;
		selectedTaskLinkedNoteTitle: string | null;
		selectedTaskTitle: string;
		shareBusyId: string | null;
		sharedWithIds: Set<any>;
		showTags: boolean;
		showTaskOptions: boolean;
		showTaskUpdate: boolean;
		subtaskTitle: string;
		subtasks: any;
		tags: TaskTag[];
		taskActionError: string;
		taskActionSuccess: string;
		tasks: any[];
		toggleShareWithContact: (...args: any[]) => any;
		toggleTask: (...args: any[]) => any;
		unlinkNoteFromTask: (...args: any[]) => any;
	} = $props();
</script>

<!-- Overlay -->
<div
	class="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4 sm:p-6 overflow-y-auto"
>
	<!-- Modal Container -->
	<div
		class="bg-[#070b0e] border border-brand-divider rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh]"
	>
		<!-- Header -->
		<div
			class="flex flex-wrap items-center justify-between p-4 border-b border-brand-divider bg-[#0d1216] rounded-t-2xl gap-4"
		>
			<!-- Breadcrumbs -->
			<div
				class="flex items-center gap-2 text-xs font-semibold text-brand-text-muted"
			>
				<Kanban class="w-4 h-4" />
				<span
					>Tablero: {currentBoard
						? currentBoard.title
						: "Enfoque Semanal & Proyectos"}</span
				>
				<span class="px-2">/</span>
				<span
					class="px-2 py-0.5 rounded-full bg-brand-surface border border-brand-divider text-brand-text flex items-center gap-1"
				>
					{boardLists.find((l) => l.id === selectedTask.list_id)
						?.name ||
						boardLists[0]?.name ||
						"Lista"}
				</span>
			</div>

			<!-- Right actions -->
			<div class="flex items-center gap-3">
				<div class="w-px h-5 bg-brand-divider mx-1"></div>
				<button
					class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors"
					onclick={() => {
						showTaskOptions = false;
						showTaskUpdate = false;
					}}
				>
					<X class="w-5 h-5" />
				</button>
			</div>
		</div>

		<!-- Title Area & Actions -->
		<div class="p-6 border-b border-brand-divider bg-[#0b1014]">
			<div class="flex gap-4 items-start mb-5">
				<button
					class="mt-1 shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors"
					onclick={() => toggleTask(selectedTask.id)}
				>
					{#if selectedTask.is_completed}
						<CheckCircle2
							class="w-7 h-7 text-brand-accent fill-brand-accent/20"
						/>
					{:else}
						<Circle class="w-7 h-7" />
					{/if}
				</button>
				<input
					type="text"
					bind:value={selectedTaskTitle}
					class="w-full bg-transparent text-2xl md:text-3xl font-bold text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-0 border-none p-0"
					placeholder="Escribe el título de la tarea..."
				/>
			</div>

			<!-- Action Pills -->
			<div class="flex flex-wrap items-center gap-3">
				<button
					class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-divider bg-brand-surface text-brand-text-muted hover:text-brand-text text-xs font-bold transition-colors"
					onclick={() => (showTags = true)}
				>
					<Tag class="w-3.5 h-3.5 text-brand-accent" /> Etiquetas
					<span
						class="w-1.5 h-1.5 rounded-full bg-brand-accent ml-1"
					></span>
				</button>

				{#if !editingNovedad}
					<button
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition-colors"
						onclick={() => (editingNovedad = " ")}
					>
						<AlertTriangle class="w-3.5 h-3.5" /> Novedad / Bloqueo
					</button>
				{:else}
					<button
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition-colors ml-auto"
					>
						<span
							class="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_var(--color-amber-500)]"
						></span>
						<AlertTriangle class="w-3.5 h-3.5" /> Novedad Activa
						(Bloqueo)
					</button>
				{/if}

				{#if selectedTask.is_shared || selectedTask.is_shared_with_me}
					<div
						class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-accent/30 bg-brand-accent/10 text-brand-accent text-xs font-bold"
					>
						<Share2 class="w-3.5 h-3.5" />
						{selectedTask.is_shared_with_me
							? "Compartida contigo"
							: "Compartida"}
					</div>
				{/if}

				{#if selectedTask.parent_task_id}
					{@const parentTask = tasks.find(
						(t) => t.id === selectedTask.parent_task_id,
					)}
					{#if parentTask}
						<button
							class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-accent/30 bg-brand-surface-elevated text-brand-text hover:text-brand-accent hover:border-brand-accent/50 text-xs font-bold transition-colors"
							onclick={() => openTaskUpdate(parentTask)}
						>
							<ArrowLeft
								class="w-3.5 h-3.5 text-brand-text-muted"
							/> De: {parentTask.title}
						</button>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Body Layout -->
		<div
			class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-8"
		>
			<!-- Left Column (Main Content) -->
			<div class="lg:col-span-2 space-y-8">
				{#if editingNovedad}
					<!-- Mockup Alert Block (Novedad) -->
					<div
						class="rounded-xl border border-amber-500/30 bg-linear-to-r from-amber-500/10 to-transparent p-5 flex items-start gap-4"
					>
						<div
							class="w-10 h-10 rounded-full border border-amber-500/50 bg-amber-500/10 flex items-center justify-center shrink-0"
						>
							<AlertTriangle class="w-5 h-5 text-amber-500" />
						</div>
						<div class="flex-1">
							<div
								class="flex items-start justify-between gap-4 mb-2"
							>
								<div>
									<h4
										class="text-sm font-bold text-amber-500 uppercase tracking-wide"
									>
										TAREA BLOQUEADA / NOVEDAD EN ESPERA
									</h4>
									<p
										class="text-[10px] text-amber-500/70 mt-1"
									>
										• Define el motivo del bloqueo abajo
									</p>
								</div>
								<button
									class="px-4 py-2 rounded-lg bg-amber-500 text-brand-bg font-bold text-xs hover:brightness-110 transition-all shadow-[0_0_15px_var(--color-amber-500-muted)]"
									onclick={() => {
										editingNovedad = "";
										saveNovedad();
									}}
								>
									Resolver / Desmarcar
								</button>
							</div>
							<textarea
								bind:value={editingNovedad}
								placeholder="Escribe la novedad o motivo de bloqueo..."
								class="w-full bg-[#070b0e] border border-amber-500/30 rounded-lg text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-amber-500 transition-colors resize-none p-3 mt-2 custom-scrollbar min-h-20"
							></textarea>
						</div>
					</div>
				{/if}

				<!-- Descripción Rich Text Editor -->
				<div>
					<div class="flex items-center justify-between mb-4">
						<h4
							class="text-base font-bold text-brand-text flex items-center gap-2"
						>
							<AlignLeft class="w-5 h-5 text-brand-accent" /> Descripción
						</h4>
					</div>
					<RichTextEditor bind:value={editingDescription} />
				</div>

				<!-- Checklist & Subtareas -->
				<TaskChecklists taskId={selectedTask.id} onHasListsChange={setTaskHasLists} />

				<!-- Subtareas -->
				<TaskSubtasks {addSubtask} {openTaskUpdate} bind:subtaskTitle {subtasks} />

				<!-- Actividad & Comentarios -->
				<TaskComments taskId={selectedTask.id} {contacts} />
			</div>

			<!-- Right Column (Sidebar) -->
			<div class="space-y-6">
				<!-- Fechas & Horario -->
				<TaskDates bind:editingDate bind:editingEndDate />

				<!-- Miembros -->
				<TaskMembers
					{contactLabel}
					{contacts}
					{shareBusyId}
					{sharedWithIds}
					{toggleShareWithContact}
				/>

				<!-- Etiquetas -->
				<div
					class="rounded-xl border border-brand-divider bg-[#0d1216] p-5"
				>
					<div class="flex items-center justify-between mb-4">
						<h4
							class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2"
						>
							<Tag class="w-4 h-4 text-brand-accent" /> Etiquetas
						</h4>
					</div>
					<TagSelect
						{tags}
						bind:value={editingTagId}
						id="edit-task-tag"
					/>
				</div>

				<!-- Vinculaciones -->
				<TaskLinks
					{focusOnSelectedTask}
					{openLinkNoteModal}
					{selectedTaskLinkedNoteId}
					{selectedTaskLinkedNoteTitle}
					{unlinkNoteFromTask}
				/>
			</div>
		</div>

		<!-- Footer -->
		<div
			class="p-4 border-t border-brand-divider bg-[#070b0e] rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-between mt-auto gap-4"
		>
			<button
				class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold w-full sm:w-auto"
				onclick={deleteTask}
			>
				<Trash2 class="w-4 h-4" /> Eliminar tarea
			</button>

			<!-- Success/Error Messages injected in footer -->
			<div class="flex-1 flex justify-center">
				{#if taskActionError}
					<p class="text-sm text-red-400 font-bold">
						{taskActionError}
					</p>
				{/if}
				{#if taskActionSuccess}
					<div
						class="rounded-full bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-bold px-3 py-1.5"
					>
						{taskActionSuccess}
					</div>
				{/if}
			</div>

			<div
				class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto"
			>
				<button
					class="px-5 py-2.5 rounded-lg border border-brand-divider bg-[#0d1216] text-brand-text-muted hover:text-brand-text transition-colors text-xs font-bold w-full sm:w-auto flex justify-center items-center"
					onclick={() => (showTaskUpdate = false)}
				>
					Cancelar
				</button>
				<button
					class="flex justify-center items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-accent text-brand-bg hover:brightness-110 transition-all text-xs font-black shadow-[0_0_15px_var(--color-brand-accent-muted)] w-full sm:w-auto"
					onclick={saveTaskDetails}
				>
					<Check class="w-4 h-4" /> Guardar cambios
				</button>
			</div>
		</div>
	</div>
</div>
