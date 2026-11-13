<script lang="ts">
	import type { TaskList, TaskListItem } from "./types";
	import { Check, CheckCircle2, CheckSquare, Edit2, Plus, X } from "@lucide/svelte";
	import { supabase } from "$lib/supabaseClient";

	// Checklists de una tarea: carga, crea, edita, marca y borra por su cuenta.
	// onHasListsChange avisa al tablero para mostrar/ocultar el ícono de checklist en la tarjeta.
	let {
		taskId,
		onHasListsChange
	}: {
		taskId: number | null | undefined;
		onHasListsChange?: (taskId: number, hasLists: boolean) => void;
	} = $props();

	let taskLists = $state<TaskList[]>([]);
	let selectedList = $state<TaskList | null>(null);
	let selectedListItems = $state<TaskListItem[]>([]);
	let listsLoading = $state(false);
	let listDetailLoading = $state(false);
	let listaError = $state("");
	let showNewChecklistForm = $state(false);
	let newChecklistName = $state("");
	let newListItemTitle = $state("");
	let editChecklistId = $state<number | null>(null);
	let editChecklistName = $state("");
	let editListItemId = $state<number | null>(null);
	let editListItemTitle = $state("");

	// Al abrir otra tarea, se reinicia todo y se cargan sus checklists
	$effect(() => {
		const id = taskId;
		selectedList = null;
		selectedListItems = [];
		showNewChecklistForm = false;
		newChecklistName = "";
		newListItemTitle = "";
		editChecklistId = null;
		editListItemId = null;
		listaError = "";
		if (id) loadTaskLists(id);
		else taskLists = [];
	});

	const createChecklist = async () => {
		const name = newChecklistName.trim();
		if (!name || !taskId || !supabase) return;
		listaError = "";
		const { error } = await supabase.from("task_lists").insert({ task_id: taskId, name });
		if (error) {
			listaError = "No se pudo crear la checklist: " + error.message;
			return;
		}
		showNewChecklistForm = false;
		newChecklistName = "";
		await loadTaskLists(taskId);
		onHasListsChange?.(taskId, true);
	};

	const loadTaskLists = async (taskId: number) => {
		taskLists = [];
		if (!supabase) return;

		listsLoading = true;
		listaError = "";

		const { data, error } = await supabase
			.from("task_lists")
			.select("id, task_id, name")
			.eq("task_id", taskId)
			.order("created_at", { ascending: false });

		if (error) {
			listsLoading = false;
			listaError = /task_lists|task_list_items|schema cache|does not exist/i.test(error.message)
				? "Falta crear las tablas de listas en Supabase. Ejecuta el SQL 007_task_lists.sql"
				: error.message;
			return;
		}

		taskLists = data ?? [];

		const listIds = taskLists.map((l) => l.id);
		if (listIds.length === 0) {
			selectedListItems = [];
			listsLoading = false;
			return;
		}

		const { data: itemsData, error: itemsError } = await supabase
			.from("task_list_items")
			.select("id, list_id, title, is_completed, order_index")
			.in("list_id", listIds)
			.order("order_index", { ascending: true });

		if (itemsError) {
			console.warn("Error cargando list items:", itemsError.message);
		} else if (itemsData) {
			const itemsByList: Record<string, any[]> = {};
			itemsData.forEach((it) => {
				if (!itemsByList[it.list_id]) itemsByList[it.list_id] = [];
				itemsByList[it.list_id].push(it);
			});
			taskLists = taskLists.map((l) => {
				const items = itemsByList[l.id] || [];
				return {
					...l,
					item_count: items.length,
					done_count: items.filter((i: any) => i.is_completed).length,
				};
			});
		}

		listsLoading = false;
	};

	const loadListItems = async (list: TaskList) => {
		selectedList = list;
		selectedListItems = [];
		if (!supabase) return;

		listDetailLoading = true;
		listaError = "";
		const { data, error } = await supabase
			.from("task_list_items")
			.select("id, list_id, title, is_completed, order_index")
			.eq("list_id", list.id)
			.order("order_index", { ascending: true });

		listDetailLoading = false;
		if (error) {
			listaError = error.message;
			return;
		}
		selectedListItems = data ?? [];
	};

	const addItemToSelectedList = async () => {
		if (!supabase || !selectedList) return;
		const title = newListItemTitle.trim();
		if (!title) return;

		listaError = "";
		const { data, error } = await supabase
			.from("task_list_items")
			.insert({
				list_id: selectedList.id,
				title,
				is_completed: false,
				order_index: selectedListItems.length,
			})
			.select("id, list_id, title, is_completed, order_index")
			.single();

		if (error) {
			listaError = error.message;
			return;
		}

		if (data) {
			selectedListItems = [...selectedListItems, data];
			newListItemTitle = "";
			taskLists = taskLists.map((list) =>
				list.id === selectedList?.id
					? {
							...list,
							item_count: selectedListItems.length,
							done_count: selectedListItems.filter(
								(i) => i.is_completed,
							).length,
						}
					: list,
			);
		}
	};

	const startEditChecklist = (list: TaskList) => {
		editChecklistId = list.id;
		editChecklistName = list.name;
	};

	const cancelEditChecklist = () => {
		editChecklistId = null;
		editChecklistName = "";
	};

	const saveEditChecklist = async () => {
		if (!editChecklistId || !editChecklistName.trim() || !supabase) return;
		const id = editChecklistId;
		const newName = editChecklistName.trim();
		const { error } = await supabase
			.from("task_lists")
			.update({ name: newName })
			.eq("id", id);
		if (error) {
			listaError = "Error al actualizar checklist: " + error.message;
			return;
		}
		taskLists = taskLists.map((list) =>
			list.id === id ? { ...list, name: newName } : list,
		);
		cancelEditChecklist();
	};

	const startEditListItem = (item: TaskListItem) => {
		editListItemId = item.id;
		editListItemTitle = item.title;
	};

	const cancelEditListItem = () => {
		editListItemId = null;
		editListItemTitle = "";
	};

	const saveEditListItem = async () => {
		if (!editListItemId || !editListItemTitle.trim() || !supabase) return;
		const id = editListItemId;
		const newTitle = editListItemTitle.trim();
		const { error } = await supabase
			.from("task_list_items")
			.update({ title: newTitle })
			.eq("id", id);
		if (error) {
			listaError = "Error al actualizar ítem: " + error.message;
			return;
		}
		selectedListItems = selectedListItems.map((item) =>
			item.id === id ? { ...item, title: newTitle } : item,
		);
		cancelEditListItem();
	};

	const toggleListItem = async (item: TaskListItem) => {
		if (!supabase) return;
		const nextValue = !item.is_completed;
		selectedListItems = selectedListItems.map((row) =>
			row.id === item.id ? { ...row, is_completed: nextValue } : row,
		);

		const { error } = await supabase
			.from("task_list_items")
			.update({ is_completed: nextValue })
			.eq("id", item.id);

		if (error) {
			selectedListItems = selectedListItems.map((row) =>
				row.id === item.id ? { ...row, is_completed: !nextValue } : row,
			);
			listaError = error.message;
			return;
		}

		if (selectedList) {
			taskLists = taskLists.map((list) =>
				list.id === selectedList?.id
					? {
							...list,
							done_count: selectedListItems.filter(
								(i) => i.is_completed,
							).length,
							item_count: selectedListItems.length,
						}
					: list,
			);
		}
	};

	const deleteListItem = async (itemId: number) => {
		if (!supabase) return;
		const previous = selectedListItems;
		selectedListItems = selectedListItems.filter(
			(row) => row.id !== itemId,
		);

		const { error } = await supabase
			.from("task_list_items")
			.delete()
			.eq("id", itemId);
		if (error) {
			selectedListItems = previous;
			listaError = error.message;
			return;
		}

		if (selectedList) {
			taskLists = taskLists.map((list) =>
				list.id === selectedList?.id
					? {
							...list,
							item_count: selectedListItems.length,
							done_count: selectedListItems.filter(
								(i) => i.is_completed,
							).length,
						}
					: list,
			);
		}
	};
</script>

<div>
	{#if listaError}
		<p class="mb-3 text-xs font-bold text-red-400" role="alert">{listaError}</p>
	{/if}
	<div class="flex items-center justify-between mb-3">
		<h4
			class="text-base font-bold text-brand-text flex items-center gap-2"
		>
			<CheckCircle2
				class="w-5 h-5 text-brand-accent"
			/> Checklist
		</h4>
		{#if taskLists.length > 0}
			{@const totalItems = taskLists.reduce(
				(a, l) => a + (l.item_count ?? 0),
				0,
			)}
			{@const doneItems = taskLists.reduce(
				(a, l) => a + (l.done_count ?? 0),
				0,
			)}
			<span
				class="text-xs font-bold text-brand-accent"
				>{doneItems} de {totalItems} completadas ({totalItems >
				0
					? Math.round(
							(doneItems / totalItems) * 100,
						)
					: 0}%)</span
			>
		{/if}
	</div>

	{#if listsLoading}
		<div
			class="text-xs text-brand-text-muted py-4 text-center"
		>
			Cargando...
		</div>
	{:else}
		<!-- Mostrar checklists existentes -->
		{#each taskLists as list}
			{@const pct = list.item_count
				? Math.round(
						((list.done_count ?? 0) /
							list.item_count) *
							100,
					)
				: 0}
			<div class="mb-4">
				<div
					class="flex items-center justify-between mb-2 group/checklist"
				>
					{#if editChecklistId === list.id}
						<div
							class="flex-1 flex items-center gap-2 mr-2"
						>
							<input
								type="text"
								bind:value={
									editChecklistName
								}
								class="flex-1 bg-brand-surface border border-brand-divider rounded-lg px-2 py-1 text-sm font-bold text-brand-text focus:outline-none focus:border-brand-accent"
								onkeydown={(e) => {
									if (e.key === "Enter")
										saveEditChecklist();
									if (e.key === "Escape")
										cancelEditChecklist();
								}}
							/>
							<button
								type="button"
								class="p-1 text-brand-text-muted hover:text-brand-accent transition-colors"
								onclick={saveEditChecklist}
								title="Guardar"
								><Check
									class="w-4 h-4"
								/></button
							>
							<button
								type="button"
								class="p-1 text-brand-text-muted hover:text-red-400 transition-colors"
								onclick={cancelEditChecklist}
								title="Cancelar"
								><X
									class="w-4 h-4"
								/></button
							>
						</div>
					{:else}
						<div
							class="flex items-center gap-2"
						>
							<button
								type="button"
								class="text-sm font-bold text-brand-text hover:text-brand-accent transition-colors"
								onclick={() =>
									loadListItems(list)}
							>
								{list.name}
							</button>
							<button
								type="button"
								class="opacity-0 group-hover/checklist:opacity-100 transition-opacity p-1 text-brand-text-muted hover:text-brand-text"
								onclick={() =>
									startEditChecklist(
										list,
									)}
								title="Editar nombre"
							>
								<Edit2
									class="w-3.5 h-3.5"
								/>
							</button>
						</div>
						<span
							class="text-[10px] text-brand-text-muted"
							>{list.done_count ??
								0}/{list.item_count ??
								0}</span
						>
					{/if}
				</div>
				<div
					class="h-1.5 w-full bg-brand-surface rounded-full overflow-hidden mb-3"
				>
					<div
						class="h-full bg-brand-accent rounded-full shadow-[0_0_8px_var(--color-brand-accent)] transition-all"
						style="width:{pct}%"
					></div>
				</div>
				{#if selectedList?.id === list.id}
					{#if listDetailLoading}
						<div
							class="text-xs text-brand-text-muted py-2 text-center"
						>
							Cargando ítems...
						</div>
					{:else}
						<div class="space-y-1 mb-3">
							{#each selectedListItems as item}
								<div
									class="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-brand-surface transition-colors"
								>
									{#if editListItemId === item.id}
										<input
											type="text"
											bind:value={
												editListItemTitle
											}
											class="flex-1 bg-brand-surface border border-brand-divider rounded-lg px-2 py-1 text-sm text-brand-text focus:outline-none focus:border-brand-accent"
											onkeydown={(
												e,
											) => {
												if (
													e.key ===
													"Enter"
												)
													saveEditListItem();
												if (
													e.key ===
													"Escape"
												)
													cancelEditListItem();
											}}
										/>
										<button
											type="button"
											class="p-1 text-brand-text-muted hover:text-brand-accent transition-colors"
											onclick={saveEditListItem}
											title="Guardar"
											><Check
												class="w-4 h-4"
											/></button
										>
										<button
											type="button"
											class="p-1 text-brand-text-muted hover:text-red-400 transition-colors"
											onclick={cancelEditListItem}
											title="Cancelar"
											><X
												class="w-4 h-4"
											/></button
										>
									{:else}
										<button
											type="button"
											class="shrink-0"
											onclick={() =>
												toggleListItem(
													item,
												)}
										>
											{#if item.is_completed}
												<CheckSquare
													class="w-5 h-5 text-brand-accent"
												/>
											{:else}
												<div
													class="w-5 h-5 rounded-md border-2 border-brand-text-muted group-hover:border-brand-accent transition-colors"
												></div>
											{/if}
										</button>
										<span
											class="flex-1 text-sm font-semibold {item.is_completed
												? 'line-through text-brand-text-muted'
												: 'text-brand-text'}"
											>{item.title}</span
										>
										<div
											class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
										>
											<button
												type="button"
												class="p-1 text-brand-text-muted hover:text-brand-text"
												onclick={() =>
													startEditListItem(
														item,
													)}
												title="Editar ítem"
											>
												<Edit2
													class="w-3.5 h-3.5"
												/>
											</button>
											<button
												type="button"
												class="p-1 text-brand-text-muted hover:text-red-400"
												onclick={() =>
													deleteListItem(
														item.id,
													)}
												title="Eliminar ítem"
											>
												<X
													class="w-3.5 h-3.5"
												/>
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={
									newListItemTitle
								}
								placeholder="Nuevo ítem..."
								class="flex-1 bg-brand-surface border border-brand-divider rounded-lg px-3 py-2 text-xs text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
								onkeydown={(e) =>
									e.key === "Enter" &&
									addItemToSelectedList()}
							/>
							<button
								type="button"
								class="px-3 py-2 bg-brand-accent text-brand-bg text-xs font-bold rounded-lg hover:brightness-105 transition-all"
								onclick={addItemToSelectedList}
							>
								<Plus class="w-3.5 h-3.5" />
							</button>
						</div>
					{/if}
				{/if}
			</div>
		{/each}

		<!-- Formulario Inline / Empty State -->
		{#if showNewChecklistForm}
			<div
				class="mt-3 rounded-xl border border-brand-accent/30 bg-brand-surface p-4"
			>
				<p
					class="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2"
				>
					Nueva Checklist
				</p>
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={newChecklistName}
						placeholder="Nombre de la checklist..."
						class="flex-1 bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
						onkeydown={(e) => {
							if (e.key === "Enter") createChecklist();
						}}
					/>
					<button
						type="button"
						class="px-3 py-2 bg-brand-accent text-brand-bg text-xs font-bold rounded-lg hover:brightness-105 transition-all"
						onclick={createChecklist}>Crear</button
					>
					<button
						type="button"
						class="px-3 py-2 text-brand-text-muted hover:text-brand-text text-xs rounded-lg border border-brand-divider transition-colors"
						onclick={() => {
							showNewChecklistForm = false;
							newChecklistName = "";
						}}>Cancelar</button
					>
				</div>
			</div>
		{:else if taskLists.length === 0}
			<div
				class="rounded-xl border border-dashed border-brand-divider p-6 text-center"
			>
				<p
					class="text-sm text-brand-text-muted mb-3"
				>
					No hay checklists todavía.
				</p>
				<button
					type="button"
					class="flex items-center gap-2 text-xs font-bold text-brand-accent hover:text-brand-accent/80 transition-colors mx-auto"
					onclick={() => {
						showNewChecklistForm = true;
						newChecklistName = "";
					}}
				>
					<Plus class="w-4 h-4" /> Crear primer checklist
				</button>
			</div>
		{:else}
			<button
				type="button"
				class="mt-3 flex items-center gap-2 text-xs font-bold text-brand-accent hover:text-brand-accent/80 transition-colors"
				onclick={() => {
					showNewChecklistForm = true;
					newChecklistName = "";
				}}
			>
				<Plus class="w-4 h-4" /> Añadir nueva checklist
			</button>
		{/if}
	{/if}
</div>
