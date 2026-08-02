<script lang="ts">
	import {
		Calendar,
		GripVertical,
		CheckCircle2,
		Circle,
		Plus,
		X,
		AlertTriangle,
		Trash2,
		Tag,
		StickyNote,
		Share2,
		ListChecks,
		List,
		MoreVertical,
		ArrowLeft,
		Settings
	} from 'lucide-svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dndzone } from 'svelte-dnd-action';
	import logo from '$lib/assets/favicon_logo.png';
	import TagSelect from '$lib/components/TagSelect.svelte';

	type TaskTag = { id: number; name: string; color: string };
	type Contact = {
		id: string;
		email: string;
		display_name: string;
		nickname: string;
	};
	type TaskList = {
		id: number;
		task_id: number;
		name: string;
		item_count?: number;
		done_count?: number;
	};
	type TaskListItem = {
		id: number;
		list_id: number;
		title: string;
		is_completed: boolean;
		order_index: number;
	};
	type TaskPanel = 'menu' | 'novedad' | 'share' | 'listas';
	
	// Estado de la aplicación usando las Runes de Svelte 5
	let tasks = $state<any[]>([]);
	let tags = $state<TaskTag[]>([]);
	let contacts = $state<Contact[]>([]);
	
	// Inicializar la fecha a las 00:00:00 sin mutaciones externas para evitar warnings en Svelte 5
	const initDate = new Date();
	initDate.setHours(0,0,0,0);
	let selectedDate = $state(initDate);

	let showNewTask = $state(false);
	let showTaskUpdate = $state(false);
	let showTaskOptions = $state(false);
	let showCalendar = $state(false);
	let calendarMode = $state<'navigate' | 'moveTask'>('navigate');
	let showTags = $state(false);
	let showCrearListaModal = $state(false);
	let showVerListasModal = $state(false);
	let showEditListModal = $state(false);
	let editListName = $state('');
	let newListItemTitle = $state('');
	let newTaskTitle = $state('');
	let selectedTagId = $state<number | null>(null);
	let newTagName = $state('');
	let newTagColor = $state('#feef4c');

	const TAG_COLORS = ['#feef4c', '#7dd3fc', '#f9a8d4', '#86efac', '#fdba74', '#c4b5fd'];
	
	// Estado para editar la tarea
	let selectedTaskId = $state<number | null>(null);
	let selectedTaskTitle = $state('');
	let editingNovedad = $state('');
	let editingTagId = $state<number | null>(null);
	let taskPanel = $state<TaskPanel>('menu');
	let taskLists = $state<TaskList[]>([]);
	let selectedList = $state<TaskList | null>(null);
	let selectedListItems = $state<TaskListItem[]>([]);
	let newListName = $state('');
	let draftListItems = $state<string[]>([]);
	let newDraftItem = $state('');
	let listsLoading = $state(false);
	let listDetailLoading = $state(false);
	let listaError = $state('');
	let listaSuccess = $state('');
	let listaSuccessTimer: ReturnType<typeof setTimeout> | null = null;
	let sharedWithIds = $state(new Set<string>());
	let shareBusyId = $state<string | null>(null);
	let taskActionError = $state('');
	let taskActionSuccess = $state('');

	const contactLabel = (contact: Contact) =>
		(contact.nickname || '').trim() || contact.display_name;

	// Variables para el calendario custom
	let calMonth = $state(initDate.getMonth());
	let calYear = $state(initDate.getFullYear());
	let daysWithActiveTasks = $state(new Set<string>());

	const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

	let calendarDays = $derived.by(() => {
		let days = [];
		const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
		const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday
		for (let i = 0; i < firstDay; i++) days.push(null);
		for (let i = 1; i <= totalDays; i++) days.push(i);
		return days;
	});

	const prevMonth = () => {
		if (calMonth === 0) { calMonth = 11; calYear--; }
		else calMonth--;
	};

	const nextMonth = () => {
		if (calMonth === 11) { calMonth = 0; calYear++; }
		else calMonth++;
	};

	const closeCalendar = () => {
		showCalendar = false;
		calendarMode = 'navigate';
	};

	const openMoveTaskCalendar = () => {
		if (selectedTaskId === null) return;
		showTaskOptions = false;
		calendarMode = 'moveTask';
		const task = tasks.find((t) => t.id === selectedTaskId);
		const dateStr = typeof task?.date === 'string' ? task.date : formatDateString(selectedDate);
		const [y, m, d] = dateStr.split('-').map(Number);
		if (y && m && d) {
			calMonth = m - 1;
			calYear = y;
		} else {
			calMonth = selectedDate.getMonth();
			calYear = selectedDate.getFullYear();
		}
		showCalendar = true;
	};

	const moveTaskToDate = async (date: Date) => {
		if (!supabase || selectedTaskId === null) return;

		const dateStr = formatDateString(date);
		const { error } = await supabase
			.from('tasks')
			.update({ date: dateStr })
			.eq('id', selectedTaskId);

		if (error) {
			closeCalendar();
			taskActionError = error.message;
			return;
		}

		tasks = tasks.filter((t) => t.id !== selectedTaskId);
		closeCalendar();
		showTaskOptions = false;
		showTaskUpdate = false;
		await fetchActiveTaskDays();
	};

	const selectCalendarDate = async (day: number) => {
		const d = new Date(calYear, calMonth, day);
		d.setHours(0, 0, 0, 0);

		if (calendarMode === 'moveTask') {
			await moveTaskToDate(d);
			return;
		}

		selectedDate = d;
		closeCalendar();
	};

	const formatDayKey = (year: number, month: number, day: number) => {
		const m = String(month + 1).padStart(2, '0');
		const d = String(day).padStart(2, '0');
		return `${year}-${m}-${d}`;
	};

	const fetchActiveTaskDays = async () => {
		if (!supabase) {
			daysWithActiveTasks = new Set();
			return;
		}

		const start = formatDayKey(calYear, calMonth, 1);
		const lastDay = new Date(calYear, calMonth + 1, 0).getDate();
		const end = formatDayKey(calYear, calMonth, lastDay);

		const { data, error } = await supabase
			.from('tasks')
			.select('date')
			.eq('is_completed', false)
			.gte('date', start)
			.lte('date', end);

		if (error) {
			console.warn('Error al cargar días con tareas activas:', error.message);
			return;
		}

		daysWithActiveTasks = new Set((data ?? []).map((t) => t.date));
	};

	// Sincronizar el calendario con la fecha seleccionada al abrir (solo navegación)
	$effect(() => {
		if (showCalendar && calendarMode === 'navigate') {
			calMonth = selectedDate.getMonth();
			calYear = selectedDate.getFullYear();
		}
	});

	// Marcar días del mes visible que tienen tareas sin completar
	$effect(() => {
		if (!showCalendar) return;
		void calMonth;
		void calYear;
		fetchActiveTaskDays();
	});

	// Funciones auxiliares
	const formatDateString = (d: Date) => {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const fetchTags = async () => {
		if (!supabase) {
			tags = [];
			return;
		}

		const { data, error } = await supabase
			.from('tags')
			.select('id, name, color')
			.order('name', { ascending: true });

		if (error) {
			console.warn('Error al cargar etiquetas:', error.message);
			return;
		}
		if (data) tags = data;
	};

	const fetchContacts = async () => {
		if (!supabase) {
			contacts = [];
			return;
		}

		let rowsResult = await supabase
			.from('contacts')
			.select('id, nickname, contact_user_id')
			.order('created_at', { ascending: false });

		if (rowsResult.error && /nickname/i.test(rowsResult.error.message)) {
			rowsResult = await supabase
				.from('contacts')
				.select('id, contact_user_id')
				.order('created_at', { ascending: false });
		}

		if (rowsResult.error) {
			console.warn('Error al cargar contactos:', rowsResult.error.message);
			contacts = [];
			return;
		}

		const rows = rowsResult.data ?? [];
		if (rows.length === 0) {
			contacts = [];
			return;
		}

		const ids = rows.map((row) => row.contact_user_id);
		const { data: profiles } = await supabase
			.from('profiles')
			.select('id, email, display_name')
			.in('id', ids);

		const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
		contacts = rows.map((row) => {
			const profile = profileMap.get(row.contact_user_id);
			return {
				id: row.contact_user_id,
				email: profile?.email ?? 'Contacto',
				nickname: ((row as any).nickname || '').trim(),
				display_name:
					(profile?.display_name || '').trim() ||
					(profile?.email ? profile.email.split('@')[0] : 'Contacto')
			};
		});
	};

	const normalizeSharedTasks = (sharedData: unknown): any[] => {
		if (Array.isArray(sharedData)) return sharedData;
		if (typeof sharedData === 'string') {
			try {
				const parsed = JSON.parse(sharedData);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return [];
	};

	const fetchSharedTasksFallback = async (dateStr: string) => {
		if (!supabase) return [] as any[];

		const {
			data: { session }
		} = await supabase.auth.getSession();
		const me = session?.user?.id;
		if (!me) return [];

		const { data: shares, error: sharesError } = await supabase
			.from('task_shares')
			.select('task_id')
			.eq('shared_with', me);

		if (sharesError) {
			console.warn('Error al cargar shares:', sharesError.message);
			return [];
		}

		const ids = [...new Set((shares ?? []).map((row) => row.task_id))];
		if (ids.length === 0) return [];

		const { data, error } = await supabase
			.from('tasks')
			.select('*, tags(id, name, color)')
			.in('id', ids)
			.eq('date', dateStr)
			.order('order_index', { ascending: true });

		if (error) {
			console.warn('Error al cargar tareas compartidas (fallback):', error.message);
			return [];
		}

		return data ?? [];
	};

	const fetchTasks = async () => {
		if (!supabase) {
			console.warn("Supabase no está configurado. Las tareas no se pueden cargar.");
			tasks = [];
			return;
		}

		const dateStr = formatDateString(selectedDate);

		const { data, error } = await supabase
			.from('tasks')
			.select('*, tags(id, name, color)')
			.eq('date', dateStr)
			.order('order_index', { ascending: true });
			
		if (error) alert("Error al cargar: " + error.message);

		let merged = data ?? [];

		const { data: sharedData, error: sharedError } = await supabase.rpc(
			'get_shared_tasks_for_date',
			{ target_date: dateStr }
		);

		let sharedList = normalizeSharedTasks(sharedData);
		if (sharedError) {
			console.warn('Error al cargar tareas compartidas:', sharedError.message);
			sharedList = await fetchSharedTasksFallback(dateStr);
		} else if (sharedList.length === 0) {
			// Si el RPC no trae nada, intenta por RLS directo (por si el SQL viejo falla)
			const fallback = await fetchSharedTasksFallback(dateStr);
			if (fallback.length > 0) sharedList = fallback;
		}

		const receivedSharedIds = new Set<number>();
		const existingIds = new Set(merged.map((t) => t.id));
		for (const shared of sharedList) {
			if (shared?.id == null) continue;
			receivedSharedIds.add(shared.id);
			if (!existingIds.has(shared.id)) {
				merged = [...merged, { ...shared, is_shared: true, is_shared_with_me: true }];
				existingIds.add(shared.id);
			} else {
				merged = merged.map((t) =>
					t.id === shared.id ? { ...t, is_shared: true, is_shared_with_me: true } : t
				);
			}
		}

		// Marcar tareas compartidas y resolver "Compartida con: alias"
		const taskIds = merged.map((t) => t.id);
		const taskIdsWithLists = new Set<number>();
		if (taskIds.length > 0) {
			const [{ data: shareRows }, { data: listRows }] = await Promise.all([
				supabase
					.from('task_shares')
					.select('task_id, shared_with')
					.in('task_id', taskIds),
				supabase.from('task_lists').select('task_id').in('task_id', taskIds)
			]);

			for (const row of listRows ?? []) {
				taskIdsWithLists.add(row.task_id);
			}

			const rows = shareRows ?? [];
			const sharedOutIds = new Set(rows.map((row) => row.task_id));
			const sharedUserIds = [...new Set(rows.map((row) => row.shared_with))];

			const nameByUserId = new Map<string, string>();
			if (sharedUserIds.length > 0) {
				const [{ data: contactRows }, { data: profiles }] = await Promise.all([
					supabase
						.from('contacts')
						.select('contact_user_id, nickname')
						.in('contact_user_id', sharedUserIds),
					supabase.from('profiles').select('id, email, display_name').in('id', sharedUserIds)
				]);

				for (const profile of profiles ?? []) {
					nameByUserId.set(
						profile.id,
						(profile.display_name || '').trim() || profile.email.split('@')[0]
					);
				}
				for (const contact of contactRows ?? []) {
					const nick = (contact.nickname || '').trim();
					if (nick) nameByUserId.set(contact.contact_user_id, nick);
				}
			}

			const labelsByTask = new Map<number, string[]>();
			for (const row of rows) {
				const list = labelsByTask.get(row.task_id) ?? [];
				list.push(nameByUserId.get(row.shared_with) || 'contacto');
				labelsByTask.set(row.task_id, list);
			}

			merged = merged.map((t) => {
				const labels = labelsByTask.get(t.id) ?? [];
				const isShared =
					Boolean(t.is_shared) || receivedSharedIds.has(t.id) || sharedOutIds.has(t.id);
				return {
					...t,
					is_shared: isShared,
					shared_with_labels: labels,
					has_lists: taskIdsWithLists.has(t.id)
				};
			});
		}

		tasks = merged;
	};

	const setTaskHasLists = (taskId: number, hasLists: boolean) => {
		tasks = tasks.map((t) => (t.id === taskId ? { ...t, has_lists: hasLists } : t));
	};

	const getTaskTag = (task: any): TaskTag | null => {
		if (task?.tags && !Array.isArray(task.tags)) return task.tags;
		if (task?.tag_id) return tags.find((t) => t.id === task.tag_id) ?? null;
		return null;
	};

	const sharedWithText = (task: any) => {
		if (task?.is_shared_with_me) return 'Compartida contigo';
		const labels = (task?.shared_with_labels ?? []) as string[];
		if (labels.length === 0) return task?.is_shared ? 'Compartida' : '';
		if (labels.length === 1) return `Compartida con: ${labels[0]}`;
		if (labels.length === 2) return `Compartida con: ${labels[0]} y ${labels[1]}`;
		return `Compartida con: ${labels[0]} y ${labels.length - 1} más`;
	};

	const refreshTaskShareLabels = (taskId: number, sharedIds: Set<string>) => {
		const labels = [...sharedIds].map((id) => {
			const contact = contacts.find((c) => c.id === id);
			return contact ? contactLabel(contact) : 'contacto';
		});
		tasks = tasks.map((t) =>
			t.id === taskId
				? {
						...t,
						is_shared: labels.length > 0 || Boolean(t.is_shared_with_me),
						shared_with_labels: labels
					}
				: t
		);
	};

	const addTag = async () => {
		const name = newTagName.trim();
		if (!name) return;

		if (!supabase) {
			alert('Supabase no está configurado.');
			return;
		}

		const { data, error } = await supabase
			.from('tags')
			.insert([{ name, color: newTagColor }])
			.select('id, name, color')
			.single();

		if (error) {
			alert('Error al crear etiqueta: ' + error.message);
			return;
		}

		if (data) tags = [...tags, data].sort((a, b) => a.name.localeCompare(b.name));
		newTagName = '';
		newTagColor = '#feef4c';
	};

	const deleteTag = async (tagId: number) => {
		if (!confirm('¿Eliminar esta etiqueta? Las tareas quedarán sin etiqueta.')) return;

		if (supabase) {
			const { error } = await supabase.from('tags').delete().eq('id', tagId);
			if (error) {
				alert('Error al eliminar etiqueta: ' + error.message);
				return;
			}
		}

		tags = tags.filter((t) => t.id !== tagId);
		if (selectedTagId === tagId) selectedTagId = null;
		if (editingTagId === tagId) editingTagId = null;
		await fetchTasks();
	};

	// Efecto para recargar tareas cuando cambia la fecha
	$effect(() => {
		fetchTasks();
	});

	$effect(() => {
		fetchTags();
		fetchContacts();
	});

	const toggleTask = async (id: number) => {
		const task = tasks.find(t => t.id === id);
		if (task) {
			task.is_completed = !task.is_completed;
			if (supabase) {
				const { error } = await supabase.from('tasks').update({ is_completed: task.is_completed }).eq('id', id);
				if (error) alert("Error al actualizar: " + error.message);
			}
			await fetchActiveTaskDays();
		}
	};

	const openNewTask = () => {
		newTaskTitle = '';
		selectedTagId = null;
		showNewTask = true;
	};

	const addTask = async () => {
		if (!newTaskTitle.trim()) return;
		
		const newTask = {
			title: newTaskTitle,
			is_completed: false,
			date: formatDateString(selectedDate),
			order_index: tasks.length,
			novedad: '',
			tag_id: selectedTagId
		};

		if (supabase) {
			const { data, error } = await supabase
				.from('tasks')
				.insert([newTask])
				.select('*, tags(id, name, color)');
			if (error) {
				alert("Error al crear tarea: " + error.message);
				return;
			}
			if (data) {
				tasks = [...tasks, { ...data[0] }];
			}
		} else {
			const tag = tags.find((t) => t.id === selectedTagId) ?? null;
			tasks = [...tasks, { id: Date.now(), ...newTask, tags: tag }];
		}
		
		newTaskTitle = '';
		selectedTagId = null;
		showNewTask = false;
		await fetchActiveTaskDays();
	};

	const loadTaskShares = async (taskId: number) => {
		sharedWithIds = new Set();
		if (!supabase) return;

		const { data, error } = await supabase
			.from('task_shares')
			.select('shared_with')
			.eq('task_id', taskId);

		if (error) {
			console.warn('Error al cargar compartidos:', error.message);
			return;
		}

		sharedWithIds = new Set((data ?? []).map((row) => row.shared_with));
	};

	const listsTableMissing = (message: string) =>
		/task_lists|task_list_items|schema cache|does not exist/i.test(message);

	const loadTaskLists = async (taskId: number) => {
		taskLists = [];
		if (!supabase) return;

		listsLoading = true;
		listaError = '';

		const { data, error } = await supabase
			.from('task_lists')
			.select('id, task_id, name')
			.eq('task_id', taskId)
			.order('created_at', { ascending: false });

		if (error) {
			listsLoading = false;
			listaError = listsTableMissing(error.message)
				? 'Falta crear las tablas de listas en Supabase. Ejecuta el SQL 007_task_lists.sql'
				: error.message;
			return;
		}

		const lists = data ?? [];
		if (lists.length === 0) {
			taskLists = [];
			listsLoading = false;
			return;
		}

		const listIds = lists.map((l) => l.id);
		const { data: items } = await supabase
			.from('task_list_items')
			.select('list_id, is_completed')
			.in('list_id', listIds);

		taskLists = lists.map((list) => {
			const listItems = (items ?? []).filter((i) => i.list_id === list.id);
			return {
				...list,
				item_count: listItems.length,
				done_count: listItems.filter((i) => i.is_completed).length
			};
		});
		listsLoading = false;
	};

	const loadListItems = async (list: TaskList) => {
		selectedList = list;
		selectedListItems = [];
		if (!supabase) return;

		listDetailLoading = true;
		listaError = '';
		const { data, error } = await supabase
			.from('task_list_items')
			.select('id, list_id, title, is_completed, order_index')
			.eq('list_id', list.id)
			.order('order_index', { ascending: true });

		listDetailLoading = false;
		if (error) {
			listaError = error.message;
			return;
		}
		selectedListItems = data ?? [];
	};

	const openTaskUpdate = async (task: any) => {
		selectedTaskId = task.id;
		selectedTaskTitle = task.title || '';
		editingNovedad = task.novedad || '';
		editingTagId = task.tag_id ?? getTaskTag(task)?.id ?? null;
		closeListModals();
		taskPanel = 'menu';
		taskActionError = '';
		taskActionSuccess = '';
		showTaskOptions = false;
		showTaskUpdate = true;
		await loadTaskShares(task.id);
	};

	const setTaskPanel = (panel: TaskPanel) => {
		if (panel !== 'listas') {
			closeListModals();
		}
		taskPanel = panel;
		taskActionError = '';
		taskActionSuccess = '';
		showTaskOptions = false;
	};

	const closeListModals = () => {
		showCrearListaModal = false;
		showVerListasModal = false;
		showEditListModal = false;
		listaError = '';
		newListName = '';
		draftListItems = [];
		newDraftItem = '';
		editListName = '';
		newListItemTitle = '';
		selectedList = null;
		selectedListItems = [];
		taskLists = [];
	};

	const openEditListModal = () => {
		if (!selectedList) return;
		editListName = selectedList.name;
		newListItemTitle = '';
		listaError = '';
		showEditListModal = true;
	};

	const closeEditListModal = () => {
		showEditListModal = false;
		editListName = '';
		newListItemTitle = '';
		listaSuccess = '';
		if (listaSuccessTimer) {
			clearTimeout(listaSuccessTimer);
			listaSuccessTimer = null;
		}
	};

	const saveListName = async () => {
		if (!supabase || !selectedList) return;
		const name = editListName.trim();
		if (!name) {
			listaError = 'Escribe un nombre para la lista.';
			return;
		}

		const { error } = await supabase
			.from('task_lists')
			.update({ name })
			.eq('id', selectedList.id);

		if (error) {
			listaError = error.message;
			return;
		}

		selectedList = { ...selectedList, name };
		taskLists = taskLists.map((list) =>
			list.id === selectedList?.id ? { ...list, name } : list
		);
		closeEditListModal();
	};

	const showListaToast = (message: string) => {
		listaSuccess = message;
		if (listaSuccessTimer) clearTimeout(listaSuccessTimer);
		listaSuccessTimer = setTimeout(() => {
			listaSuccess = '';
			listaSuccessTimer = null;
		}, 2200);
	};

	const addItemToSelectedList = async () => {
		if (!supabase || !selectedList) return;
		const title = newListItemTitle.trim();
		if (!title) return;

		listaError = '';
		const { data, error } = await supabase
			.from('task_list_items')
			.insert({
				list_id: selectedList.id,
				title,
				is_completed: false,
				order_index: selectedListItems.length
			})
			.select('id, list_id, title, is_completed, order_index')
			.single();

		if (error) {
			listaError = error.message;
			return;
		}

		if (data) {
			selectedListItems = [...selectedListItems, data];
			newListItemTitle = '';
			taskLists = taskLists.map((list) =>
				list.id === selectedList?.id
					? {
							...list,
							item_count: selectedListItems.length,
							done_count: selectedListItems.filter((i) => i.is_completed).length
						}
					: list
			);
			showListaToast('Ítem agregado');
		}
	};

	const openCrearListaModal = () => {
		if (selectedTaskId === null) return;
		listaError = '';
		newListName = '';
		draftListItems = [];
		newDraftItem = '';
		taskPanel = 'listas';
		showVerListasModal = false;
		showEditListModal = false;
		showCrearListaModal = true;
	};

	const openVerListasModal = async () => {
		if (selectedTaskId === null) return;
		listaError = '';
		selectedList = null;
		selectedListItems = [];
		taskPanel = 'listas';
		showCrearListaModal = false;
		showEditListModal = false;
		showVerListasModal = true;
		await loadTaskLists(selectedTaskId);
	};

	const addDraftItem = () => {
		const title = newDraftItem.trim();
		if (!title) return;
		draftListItems = [...draftListItems, title];
		newDraftItem = '';
	};

	const removeDraftItem = (index: number) => {
		draftListItems = draftListItems.filter((_, i) => i !== index);
	};

	const saveNewList = async () => {
		if (!supabase || selectedTaskId === null) return;

		const name = newListName.trim();
		if (!name) {
			listaError = 'Escribe un nombre para la lista.';
			return;
		}

		listaError = '';
		const { data: list, error } = await supabase
			.from('task_lists')
			.insert({ task_id: selectedTaskId, name })
			.select('id, task_id, name')
			.single();

		if (error) {
			listaError = listsTableMissing(error.message)
				? 'Falta crear las tablas de listas en Supabase. Ejecuta el SQL 007_task_lists.sql'
				: error.message;
			return;
		}

		if (draftListItems.length > 0 && list) {
			const rows = draftListItems.map((title, index) => ({
				list_id: list.id,
				title,
				is_completed: false,
				order_index: index
			}));
			const { error: itemsError } = await supabase.from('task_list_items').insert(rows);
			if (itemsError) {
				listaError = itemsError.message;
				return;
			}
		}

		setTaskHasLists(selectedTaskId, true);
		closeListModals();
		taskActionSuccess = `Lista ${name} creada`;
	};

	const toggleListItem = async (item: TaskListItem) => {
		if (!supabase) return;
		const nextValue = !item.is_completed;
		selectedListItems = selectedListItems.map((row) =>
			row.id === item.id ? { ...row, is_completed: nextValue } : row
		);

		const { error } = await supabase
			.from('task_list_items')
			.update({ is_completed: nextValue })
			.eq('id', item.id);

		if (error) {
			selectedListItems = selectedListItems.map((row) =>
				row.id === item.id ? { ...row, is_completed: !nextValue } : row
			);
			listaError = error.message;
			return;
		}

		if (selectedList) {
			taskLists = taskLists.map((list) =>
				list.id === selectedList?.id
					? {
							...list,
							done_count: selectedListItems.filter((i) => i.is_completed).length,
							item_count: selectedListItems.length
						}
					: list
			);
		}
	};

	const deleteListItem = async (itemId: number) => {
		if (!supabase) return;
		const previous = selectedListItems;
		selectedListItems = selectedListItems.filter((row) => row.id !== itemId);

		const { error } = await supabase.from('task_list_items').delete().eq('id', itemId);
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
							done_count: selectedListItems.filter((i) => i.is_completed).length
						}
					: list
			);
		}
	};

	const deleteTaskList = async (listId: number) => {
		if (!supabase) return;
		if (!confirm('¿Eliminar esta lista y todos sus ítems?')) return;

		const { error } = await supabase.from('task_lists').delete().eq('id', listId);
		if (error) {
			listaError = error.message;
			return;
		}

		taskLists = taskLists.filter((l) => l.id !== listId);
		if (selectedTaskId !== null) {
			setTaskHasLists(selectedTaskId, taskLists.length > 0);
		}
		if (selectedList?.id === listId) {
			selectedList = null;
			selectedListItems = [];
			closeEditListModal();
		}
	};

	const saveNovedad = async () => {
		if (selectedTaskId === null) return;
		
		const taskIndex = tasks.findIndex(t => t.id === selectedTaskId);
		if (taskIndex !== -1) {
			tasks[taskIndex].novedad = editingNovedad;
			tasks[taskIndex].tag_id = editingTagId;
			tasks[taskIndex].tags = tags.find((t) => t.id === editingTagId) ?? null;
			if (supabase) {
				const { error } = await supabase
					.from('tasks')
					.update({ novedad: editingNovedad, tag_id: editingTagId })
					.eq('id', selectedTaskId);
				if (error) {
					taskActionError = error.message;
					return;
				}
			}
		}
		taskActionSuccess = 'Novedad guardada.';
		taskPanel = 'menu';
	};

	const toggleShareWithContact = async (contactId: string) => {
		if (!supabase || selectedTaskId === null) return;

		shareBusyId = contactId;
		taskActionError = '';
		taskActionSuccess = '';

		try {
			const alreadyShared = sharedWithIds.has(contactId);

			if (alreadyShared) {
				const { error } = await supabase
					.from('task_shares')
					.delete()
					.eq('task_id', selectedTaskId)
					.eq('shared_with', contactId);

				if (error) {
					taskActionError = error.message;
					return;
				}

				const next = new Set(sharedWithIds);
				next.delete(contactId);
				sharedWithIds = next;
				refreshTaskShareLabels(selectedTaskId, next);
				taskActionSuccess = 'Se dejó de compartir con ese contacto.';
			} else {
				const {
					data: { session }
				} = await supabase.auth.getSession();
				const me = session?.user?.id;
				if (!me) {
					taskActionError = 'Debes iniciar sesión.';
					return;
				}

				const { error } = await supabase.from('task_shares').insert({
					task_id: selectedTaskId,
					shared_with: contactId,
					shared_by: me
				});

				if (error) {
					taskActionError = /task_shares|schema cache|does not exist/i.test(error.message)
						? 'Falta crear la tabla task_shares en Supabase. Ejecuta el SQL 005_task_shares.sql'
						: error.message;
					return;
				}

				const next = new Set(sharedWithIds);
				next.add(contactId);
				sharedWithIds = next;
				refreshTaskShareLabels(selectedTaskId, next);
				taskActionSuccess = 'Tarea compartida.';
			}
		} finally {
			shareBusyId = null;
		}
	};

	const deleteTask = async () => {
		if (selectedTaskId === null) return;
		
		// Confirmación simple
		if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;

		if (supabase) {
			const { error } = await supabase.from('tasks').delete().eq('id', selectedTaskId);
			if (error) {
				alert("Error al eliminar la tarea: " + error.message);
				return; // Si hay error, no la borramos localmente
			}
		}
		
		tasks = tasks.filter(t => t.id !== selectedTaskId);
		showTaskUpdate = false;
		await fetchActiveTaskDays();
	};

	const setDate = (offset: number) => {
		const d = new Date();
		d.setDate(d.getDate() + offset);
		d.setHours(0,0,0,0);
		selectedDate = d;
	};

	const isSameDay = (a: Date, b: Date) =>
		a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

	const isToday = (d: Date) => isSameDay(d, new Date());

	const isOffsetDay = (d: Date, offset: number) => {
		const target = new Date();
		target.setDate(target.getDate() + offset);
		target.setHours(0, 0, 0, 0);
		return isSameDay(d, target);
	};

	const dayTabClass = (active: boolean) =>
		`flex-1 py-2.5 rounded-xl text-center transition-colors ${
			active
				? 'bg-brand-accent text-brand-bg font-semibold'
				: 'text-brand-text-muted hover:text-brand-text'
		}`;

	// Handlers para el drag and drop
	const handleDndConsider = (e: any) => {
		tasks = e.detail.items;
	};

	const handleDndFinalize = async (e: any) => {
		tasks = e.detail.items;
		if (supabase) {
			// Update order_index for all items locally
			const updates = tasks.map((t, index) => ({
				id: t.id,
				title: t.title,
				is_completed: t.is_completed,
				date: t.date,
				order_index: index,
				novedad: t.novedad,
				tag_id: t.tag_id ?? null
			}));
			await supabase.from('tasks').upsert(updates);
		}
	};

	// Cálculo de progreso
	let progress = $derived(tasks.length > 0 ? Math.round((tasks.filter(t => t.is_completed).length / tasks.length) * 100) : 0);
</script>

<svelte:head>
	<title>Tareas · Fokuz</title>
</svelte:head>

<!-- Header -->
<header class="flex items-center justify-between p-6 bg-brand-surface pb-4 rounded-b-3xl z-10 sticky top-0 border-b border-brand-divider">
	<div class="flex items-center gap-3">
		<img src={logo} alt="Fokuz" class="w-8 h-8 rounded-lg object-contain" />
		<h1 class="text-xl font-bold text-brand-text">Tareas</h1>
	</div>
	<button
		onclick={() => showTags = true}
		class="p-2 rounded-xl text-brand-accent hover:bg-brand-accent-muted transition-colors"
		title="Etiquetas"
		aria-label="Gestionar etiquetas"
	>
		<Tag class="w-5 h-5" />
	</button>
</header>

<!-- Contenido principal -->
<div class="flex-1 overflow-y-auto px-6 py-4 pb-28">
	
	<!-- Selector de fecha -->
	<div class="flex items-center gap-1 bg-brand-surface rounded-2xl p-1 mb-8 border border-brand-divider">
		<div class="flex flex-1 items-center gap-1 text-sm font-medium min-w-0">
			<button class={dayTabClass(isOffsetDay(selectedDate, -1))} onclick={() => setDate(-1)}>Ayer</button>
			<button class={dayTabClass(isToday(selectedDate))} onclick={() => setDate(0)}>Hoy</button>
			<button class={dayTabClass(isOffsetDay(selectedDate, 1))} onclick={() => setDate(1)}>Mañana</button>
		</div>
		<div class="w-px h-6 bg-brand-divider shrink-0"></div>
		
		<!-- Selector Custom (Botón para abrir modal) -->
		<button 
			class="relative w-9 h-9 flex items-center justify-center text-brand-accent hover:bg-brand-accent-muted rounded-full transition-colors"
			onclick={() => {
				calendarMode = 'navigate';
				showCalendar = true;
			}}
		>
			<Calendar class="w-5 h-5" />
		</button>
	</div>

	<!-- Lista de prioridades -->
	<div class="mb-2">
		<h2 class="text-xs font-bold text-brand-text-muted tracking-wider mb-4 uppercase">Enfoque actual</h2>
		
		<section 
			class="flex flex-col gap-3 min-h-[50px]" 
			use:dndzone={{items: tasks, flipDurationMs: 200, dropTargetStyle: {}}} 
			onconsider={handleDndConsider} 
			onfinalize={handleDndFinalize}
		>
			{#each tasks as task (task.id)}
				{@const taskTag = getTaskTag(task)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div 
					class="flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all duration-200 border-l-4 {selectedTaskId === task.id ? 'bg-brand-surface-elevated border-brand-accent shadow-md' : 'bg-brand-surface border-transparent hover:bg-brand-surface-elevated'}"
					onclick={() => openTaskUpdate(task)}
				>
					<div class="flex items-center gap-4 flex-1 min-w-0">
						<!-- svelte-ignore a11y_consider_explicit_label -->
						<button 
							onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
							class="text-brand-text-muted hover:text-brand-accent transition-colors focus:outline-none shrink-0"
						>
							{#if task.is_completed}
								<CheckCircle2 class="w-6 h-6 text-brand-accent fill-brand-accent-muted" />
							{:else}
								<Circle class="w-6 h-6" />
							{/if}
						</button>
						<div class="min-w-0">
							<span class="block text-[15px] font-medium truncate {task.is_completed ? 'text-brand-text-muted line-through' : 'text-brand-text'}">
								{task.title}
							</span>
							{#if taskTag}
								<span
									class="inline-flex mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-brand-bg"
									style="background-color: {taskTag.color}"
								>
									{taskTag.name}
								</span>
							{/if}
							{#if task.is_shared}
								<p class="mt-1 text-[11px] font-medium text-brand-accent truncate">
									{sharedWithText(task)}
								</p>
							{/if}
						</div>
					</div>
					
					<div class="flex items-center gap-2 shrink-0">
						{#if task.has_lists}
							<span title="Tiene lista" class="text-brand-accent">
								<ListChecks class="w-4 h-4" />
							</span>
						{/if}
						{#if task.is_shared}
							<span title={sharedWithText(task)} class="text-brand-accent">
								<Share2 class="w-4 h-4" />
							</span>
						{/if}
						{#if task.novedad && task.novedad.trim() !== ''}
							<AlertTriangle class="w-5 h-5 text-brand-accent fill-brand-accent-muted" />
						{/if}
						<div class="text-brand-text-muted/50 hover:text-brand-text-muted cursor-grab active:cursor-grabbing p-1">
							<GripVertical class="w-5 h-5" />
						</div>
					</div>
				</div>
			{/each}
		</section>
		{#if tasks.length === 0}
			<div class="text-center py-8 text-brand-text-muted text-sm">
				No hay prioridades para este día.
			</div>
		{/if}
	</div>

	<!-- Barra de progreso -->
	<div class="mt-8 mb-6">
		<div class="flex justify-between items-center mb-2">
			<span class="text-xs font-bold text-brand-text-muted tracking-wider uppercase">Progreso diario</span>
			<span class="text-sm font-bold text-brand-accent">{progress}%</span>
		</div>
		<div class="h-2 w-full bg-brand-surface-elevated rounded-full overflow-hidden">
			<div 
				class="h-full bg-brand-accent rounded-full transition-all duration-500 ease-out" 
				style="width: {progress}%"
			></div>
		</div>
	</div>
</div>

<!-- Floating Action Button -->
<button 
	class="absolute bottom-24 right-6 w-14 h-14 bg-brand-accent hover:brightness-105 text-brand-bg rounded-full shadow-lg shadow-black/30 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-20"
	onclick={openNewTask}
>
	<Plus class="w-7 h-7" />
</button>

<!-- Modals (Bottom Sheets) -->

<!-- Overlay -->
{#if showNewTask || showTaskUpdate || showCalendar || showTags || showCrearListaModal || showVerListasModal || showEditListModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="absolute inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity"
		onclick={() => {
			if (showEditListModal) {
				closeEditListModal();
				return;
			}
			if (showCrearListaModal || showVerListasModal) {
				closeListModals();
				return;
			}
			if (showCalendar) {
				closeCalendar();
				return;
			}
			showNewTask = false;
			showTaskUpdate = false;
			showTags = false;
		}}
	></div>
{/if}

<!-- Calendario Custom Bottom Sheet -->
{#if showCalendar}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl {calendarMode === 'moveTask' ? 'z-50' : 'z-40'} p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		{#if calendarMode === 'moveTask'}
			<div class="flex justify-between items-center mb-2">
				<h3 class="text-lg font-bold text-brand-text">Modificar día</h3>
				<button
					class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
					onclick={closeCalendar}
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
			<p class="text-sm text-brand-text-muted mb-5 truncate">{selectedTaskTitle}</p>
		{/if}
		
		<div class="flex justify-between items-center mb-6">
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={prevMonth}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
			</button>
			<h3 class="text-lg font-bold text-brand-text capitalize">{monthNames[calMonth]} {calYear}</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={nextMonth}>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
			</button>
		</div>
		
		<div class="grid grid-cols-7 gap-2 text-center mb-2">
			{#each ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as dayStr}
				<div class="text-xs font-bold text-brand-text-muted">{dayStr}</div>
			{/each}
		</div>
		
		<div class="grid grid-cols-7 gap-2 text-center mb-6">
			{#each calendarDays as day}
				{#if day === null}
					<div></div>
				{:else}
					{@const highlightDate =
						calendarMode === 'moveTask'
							? (() => {
									const task = tasks.find((t) => t.id === selectedTaskId);
									const dateStr =
										typeof task?.date === 'string' ? task.date : formatDateString(selectedDate);
									const [y, m, d] = dateStr.split('-').map(Number);
									return y && m && d ? new Date(y, m - 1, d) : selectedDate;
								})()
							: selectedDate}
					{@const isSelected =
						highlightDate.getDate() === day &&
						highlightDate.getMonth() === calMonth &&
						highlightDate.getFullYear() === calYear}
					{@const hasActiveTasks = daysWithActiveTasks.has(formatDayKey(calYear, calMonth, day))}
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button 
						class="w-10 h-10 mx-auto flex items-center justify-center rounded-full text-sm transition-all {isSelected
							? 'bg-brand-accent text-brand-bg font-bold shadow-md'
							: hasActiveTasks
								? 'text-brand-text ring-2 ring-brand-accent'
								: 'text-brand-text hover:bg-brand-accent-muted'}"
						onclick={() => selectCalendarDate(day)}
					>
						{day}
					</button>
				{/if}
			{/each}
		</div>
		{#if calendarMode === 'moveTask'}
			<p class="text-xs text-brand-text-muted text-center">Elige el nuevo día para esta tarea.</p>
		{/if}
	</div>
{/if}

<!-- Tags Bottom Sheet -->
{#if showTags}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300 max-h-[85%] overflow-y-auto">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Etiquetas</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={() => showTags = false}>
				<X class="w-4 h-4" />
			</button>
		</div>

		<div class="space-y-3 mb-6">
			{#if tags.length === 0}
				<p class="text-sm text-brand-text-muted text-center py-4">Aún no tienes etiquetas. Crea una como “Hogar” o “Trabajo”.</p>
			{:else}
				{#each tags as tag (tag.id)}
					<div class="flex items-center justify-between gap-3 bg-brand-bg rounded-xl px-4 py-3">
						<div class="flex items-center gap-3 min-w-0">
							<span class="w-3 h-3 rounded-full shrink-0" style="background-color: {tag.color}"></span>
							<span class="text-brand-text font-medium truncate">{tag.name}</span>
						</div>
						<button
							class="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
							onclick={() => deleteTag(tag.id)}
							aria-label="Eliminar etiqueta {tag.name}"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				{/each}
			{/if}
		</div>

		<div class="border-t border-brand-divider pt-5 space-y-4">
			<input
				type="text"
				bind:value={newTagName}
				placeholder="Nombre de la etiqueta..."
				class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
			/>
			<div class="flex items-center gap-2">
				{#each TAG_COLORS as color}
					<button
						type="button"
						class="w-8 h-8 rounded-full transition-transform {newTagColor === color ? 'ring-2 ring-white scale-110' : ''}"
						style="background-color: {color}"
						onclick={() => newTagColor = color}
						aria-label="Color {color}"
					></button>
				{/each}
			</div>
			<button
				class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
				onclick={addTag}
			>
				<Plus class="w-5 h-5" />
				Crear etiqueta
			</button>
		</div>
	</div>
{/if}

<!-- New Task Bottom Sheet -->
{#if showNewTask}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Nueva Tarea</h3>
			<button class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text" onclick={() => showNewTask = false}>
				<X class="w-4 h-4" />
			</button>
		</div>
		
		<input 
			type="text" 
			bind:value={newTaskTitle}
			placeholder="Escribe tu tarea..." 
			class="w-full bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-5"
		/>

		<div class="mb-8">
			<label for="new-task-tag" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">Etiqueta</label>
			{#if tags.length === 0}
				<button
					type="button"
					class="w-full py-3.5 rounded-xl border border-brand-accent/50 bg-brand-accent-muted text-brand-accent font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-accent/20 transition-colors"
					onclick={() => { showNewTask = false; showTags = true; }}
				>
					<Tag class="w-4 h-4" />
					Crear tu primera etiqueta
				</button>
			{:else}
				<TagSelect id="new-task-tag" {tags} bind:value={selectedTagId} />
			{/if}
		</div>
		
		<button 
			class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
			onclick={addTask}
		>
			<Plus class="w-5 h-5" />
			Añadir Tarea
		</button>
	</div>
{/if}

<!-- Detalle de la Tarea Bottom Sheet -->
{#if showTaskUpdate}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-40 p-6 pt-4 transform transition-transform shadow-2xl border-t border-brand-divider animate-in slide-in-from-bottom-8 duration-300 max-h-[90%] overflow-y-auto">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>
		
		<div class="flex justify-between items-center mb-2">
			<h3 class="text-lg font-bold text-brand-text">Tarea</h3>
			<button
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
				onclick={() => {
					closeListModals();
					showTaskOptions = false;
					showTaskUpdate = false;
				}}
			>
				<X class="w-4 h-4" />
			</button>
		</div>
		<p class="text-sm text-brand-text-muted mb-5 truncate">{selectedTaskTitle}</p>

		<div class="grid grid-cols-3 gap-2 mb-5">
			<button
				type="button"
				class="flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-colors {taskPanel === 'novedad'
					? 'border-brand-accent bg-brand-accent-muted text-brand-accent'
					: 'border-brand-divider bg-brand-bg text-brand-text'}"
				onclick={() => setTaskPanel('novedad')}
			>
				<StickyNote class="w-5 h-5" />
				<span class="text-[11px] font-semibold text-center leading-tight">Crear novedad</span>
			</button>
			<button
				type="button"
				class="flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-colors {taskPanel === 'share'
					? 'border-brand-accent bg-brand-accent-muted text-brand-accent'
					: 'border-brand-divider bg-brand-bg text-brand-text'}"
				onclick={() => setTaskPanel('share')}
			>
				<Share2 class="w-5 h-5" />
				<span class="text-[11px] font-semibold text-center leading-tight">Compartir</span>
			</button>
			<button
				type="button"
				class="flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-colors {taskPanel === 'listas'
					? 'border-brand-accent bg-brand-accent-muted text-brand-accent'
					: 'border-brand-divider bg-brand-bg text-brand-text'}"
				onclick={() => setTaskPanel('listas')}
			>
				<ListChecks class="w-5 h-5" />
				<span class="text-[11px] font-semibold text-center leading-tight">Listas</span>
			</button>
		</div>

		{#if taskPanel === 'menu'}
			<p class="text-sm text-brand-text-muted mb-5">
				Elige una opción para gestionar esta tarea.
			</p>
		{:else if taskPanel === 'listas'}
			<p class="text-sm text-brand-text-muted mb-3">
				¿Qué quieres hacer con las listas?
			</p>
			<div class="grid grid-cols-2 gap-2 mb-5">
				<button
					type="button"
					class="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-brand-divider bg-brand-bg text-brand-text px-2 py-3 hover:border-brand-accent hover:text-brand-accent transition-colors"
					onclick={openCrearListaModal}
				>
					<ListChecks class="w-5 h-5" />
					<span class="text-[11px] font-semibold text-center leading-tight">Crear lista</span>
				</button>
				<button
					type="button"
					class="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-brand-divider bg-brand-bg text-brand-text px-2 py-3 hover:border-brand-accent hover:text-brand-accent transition-colors"
					onclick={openVerListasModal}
				>
					<List class="w-5 h-5" />
					<span class="text-[11px] font-semibold text-center leading-tight">Ver listas</span>
				</button>
			</div>
		{:else if taskPanel === 'novedad'}
			<textarea 
				bind:value={editingNovedad}
				placeholder="Escribe aquí cualquier novedad o detalle..." 
				class="w-full h-28 bg-brand-bg rounded-xl p-4 text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-4 resize-none"
			></textarea>
			
			<button 
				class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors mb-3"
				onclick={saveNovedad}
			>
				Guardar novedad
			</button>

			{#if editingNovedad.trim()}
				<button 
					class="w-full py-3 rounded-xl border border-red-400/40 text-red-400 font-semibold text-sm hover:bg-red-500/10 transition-colors mb-3"
					onclick={() => { editingNovedad = ''; saveNovedad(); }}
				>
					Eliminar novedad
				</button>
			{/if}
		{:else if taskPanel === 'share'}
			<p class="text-sm text-brand-text-muted mb-3">
				Comparte esta tarea con tus contactos. Ellos la verán en su lista.
			</p>
			{#if contacts.length === 0}
				<p class="text-sm text-brand-text-muted mb-3">
					Aún no tienes contactos. Agrégalos desde Perfil.
				</p>
			{:else}
				<div class="space-y-2 mb-3 max-h-52 overflow-y-auto">
					{#each contacts as contact (contact.id)}
						{@const isShared = sharedWithIds.has(contact.id)}
						<button
							type="button"
							class="w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors {isShared
								? 'border-brand-accent bg-brand-accent-muted'
								: 'border-brand-divider bg-brand-bg'}"
							disabled={shareBusyId === contact.id}
							onclick={() => toggleShareWithContact(contact.id)}
						>
							<div class="min-w-0">
								<p class="font-medium text-brand-text truncate">{contactLabel(contact)}</p>
								<p class="text-xs text-brand-text-muted truncate">{contact.email}</p>
							</div>
							<span class="text-xs font-semibold shrink-0 {isShared ? 'text-brand-accent' : 'text-brand-text-muted'}">
								{shareBusyId === contact.id ? '...' : isShared ? 'Compartida' : 'Compartir'}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		{/if}

		{#if taskActionError}
			<p class="text-sm text-red-400 mb-3">{taskActionError}</p>
		{/if}
		{#if taskActionSuccess}
			<div class="mb-3 flex justify-center">
				<div class="rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium px-3 py-1.5">
					{taskActionSuccess}
				</div>
			</div>
		{/if}

		<div class="border-t border-brand-divider pt-4 flex justify-end relative">
			<button
				type="button"
				class="p-2.5 rounded-full bg-brand-bg border border-brand-divider text-brand-text-muted hover:text-brand-text hover:border-brand-accent transition-colors"
				onclick={() => (showTaskOptions = !showTaskOptions)}
				aria-label="Opciones"
			>
				<Settings class="w-4 h-4" />
			</button>
			{#if showTaskOptions}
				{@const selectedTask = tasks.find((t) => t.id === selectedTaskId)}
				<div class="absolute bottom-full right-0 mb-2 min-w-[11rem] rounded-xl border border-brand-divider bg-brand-surface-elevated shadow-xl overflow-hidden z-10">
					<button
						type="button"
						class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-brand-text hover:bg-brand-accent-muted transition-colors"
						onclick={openMoveTaskCalendar}
					>
						<Calendar class="w-4 h-4 text-brand-accent" />
						Modificar día
					</button>
					{#if !selectedTask?.is_shared_with_me}
						<button
							type="button"
							class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
							onclick={() => {
								showTaskOptions = false;
								deleteTask();
							}}
						>
							<Trash2 class="w-4 h-4" />
							Eliminar tarea
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Modal Crear lista -->
{#if showCrearListaModal}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-50 p-6 pt-4 shadow-2xl border-t border-brand-divider max-h-[90%] overflow-y-auto">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		<div class="flex justify-between items-center mb-2">
			<h3 class="text-lg font-bold text-brand-text">Crear lista</h3>
			<button
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
				onclick={closeListModals}
				aria-label="Cerrar"
			>
				<X class="w-4 h-4" />
			</button>
		</div>
		<p class="text-sm text-brand-text-muted mb-5 truncate">{selectedTaskTitle}</p>

		<label for="list-name" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Nombre de la lista
		</label>
		<input
			id="list-name"
			type="text"
			bind:value={newListName}
			placeholder="Ej. Compras, Pendientes..."
			class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-4"
		/>

		<label class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Ítems
		</label>
		<form
			class="flex gap-2 mb-3"
			onsubmit={(e) => {
				e.preventDefault();
				addDraftItem();
			}}
		>
			<input
				type="text"
				bind:value={newDraftItem}
				placeholder="Nuevo ítem..."
				class="flex-1 min-w-0 bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
			/>
			<button
				type="submit"
				class="shrink-0 bg-brand-accent text-brand-bg font-bold px-4 rounded-xl hover:brightness-105 transition-colors"
				aria-label="Agregar ítem"
			>
				<Plus class="w-5 h-5" />
			</button>
		</form>

		{#if draftListItems.length === 0}
			<p class="text-sm text-brand-text-muted mb-4">
				Agrega los ítems de tu lista (opcional) y luego guárdala.
			</p>
		{:else}
			<div class="space-y-2 mb-4 max-h-48 overflow-y-auto">
				{#each draftListItems as item, index (index)}
					<div class="flex items-center gap-3 bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5">
						<Circle class="w-4 h-4 text-brand-text-muted shrink-0" />
						<span class="flex-1 text-sm text-brand-text truncate">{item}</span>
						<button
							type="button"
							class="shrink-0 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
							onclick={() => removeDraftItem(index)}
							aria-label="Quitar ítem"
						>
							<Trash2 class="w-4 h-4" />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		{#if listaError}
			<p class="text-sm text-red-400 mb-3">{listaError}</p>
		{/if}

		<button
			class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-3.5 rounded-xl transition-colors"
			onclick={saveNewList}
		>
			Guardar lista
		</button>
	</div>
{/if}

<!-- Modal Ver listas -->
{#if showVerListasModal}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-50 p-6 pt-4 shadow-2xl border-t border-brand-divider max-h-[90%] overflow-y-auto">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		<div class="flex justify-between items-center mb-2 gap-2">
			{#if selectedList}
				<button
					type="button"
					class="flex items-center gap-2 text-brand-accent font-medium text-sm shrink-0"
					onclick={() => {
						selectedList = null;
						selectedListItems = [];
						closeEditListModal();
					}}
				>
					<ArrowLeft class="w-4 h-4" />
					Volver atrás
				</button>
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="p-2 rounded-full text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors"
						onclick={openEditListModal}
						aria-label="Modificar lista"
					>
						<MoreVertical class="w-5 h-5" />
					</button>
					<button
						class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
						onclick={closeListModals}
						aria-label="Cerrar"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			{:else}
				<h3 class="text-lg font-bold text-brand-text">Ver listas</h3>
				<button
					class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
					onclick={closeListModals}
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			{/if}
		</div>

		{#if selectedList}
			<h3 class="text-lg font-bold text-brand-text mb-1 truncate">{selectedList.name}</h3>
			<p class="text-sm text-brand-text-muted mb-5 truncate">{selectedTaskTitle}</p>

			{#if listDetailLoading}
				<p class="text-sm text-brand-text-muted mb-3">Cargando ítems...</p>
			{:else if selectedListItems.length === 0}
				<p class="text-sm text-brand-text-muted mb-3">
					Esta lista no tiene ítems. Usa los tres puntos para agregar.
				</p>
			{:else}
				<div class="space-y-2 mb-3 max-h-64 overflow-y-auto">
					{#each selectedListItems as item (item.id)}
						<div class="flex items-center gap-3 bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5">
							<button
								type="button"
								class="shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors"
								onclick={() => toggleListItem(item)}
								aria-label={item.is_completed ? 'Marcar pendiente' : 'Marcar completado'}
							>
								{#if item.is_completed}
									<CheckCircle2 class="w-5 h-5 text-brand-accent" />
								{:else}
									<Circle class="w-5 h-5" />
								{/if}
							</button>
							<span class="flex-1 text-sm min-w-0 truncate {item.is_completed ? 'text-brand-text-muted line-through' : 'text-brand-text'}">
								{item.title}
							</span>
							<button
								type="button"
								class="shrink-0 p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
								onclick={() => deleteListItem(item.id)}
								aria-label="Eliminar ítem"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					{/each}
				</div>
				<p class="text-xs text-brand-text-muted mb-3">
					{selectedListItems.filter((i) => i.is_completed).length}/{selectedListItems.length} completados
				</p>
			{/if}
		{:else}
			<p class="text-sm text-brand-text-muted mb-5 truncate">{selectedTaskTitle}</p>

			{#if listsLoading}
				<p class="text-sm text-brand-text-muted mb-3">Cargando listas...</p>
			{:else if taskLists.length === 0}
				<p class="text-sm text-brand-text-muted mb-3">
					Aún no hay listas. Usa “Crear lista” para agregar una.
				</p>
			{:else}
				<div class="space-y-2 mb-3 max-h-72 overflow-y-auto">
					{#each taskLists as list (list.id)}
						<div class="flex items-center gap-2 bg-brand-bg border border-brand-divider rounded-xl overflow-hidden">
							<button
								type="button"
								class="flex-1 min-w-0 text-left px-4 py-3 hover:bg-brand-surface-elevated transition-colors"
								onclick={() => loadListItems(list)}
							>
								<p class="font-medium text-brand-text truncate">{list.name}</p>
								<p class="text-xs text-brand-text-muted">
									{list.done_count ?? 0}/{list.item_count ?? 0} completados
								</p>
							</button>
							<button
								type="button"
								class="shrink-0 p-3 text-red-400 hover:bg-red-500/10"
								onclick={() => deleteTaskList(list.id)}
								aria-label="Eliminar lista {list.name}"
							>
								<Trash2 class="w-4 h-4" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		{#if listaError && !showEditListModal}
			<p class="text-sm text-red-400 mb-3">{listaError}</p>
		{/if}
	</div>
{/if}

<!-- Modal Modificar lista -->
{#if showEditListModal && selectedList}
	<div class="absolute bottom-0 left-0 right-0 bg-brand-surface rounded-t-3xl z-[60] p-6 pt-4 shadow-2xl border-t border-brand-divider max-h-[90%] overflow-y-auto">
		<div class="w-12 h-1.5 bg-brand-divider rounded-full mx-auto mb-6"></div>

		{#if listaSuccess}
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium px-3 py-1.5">
					{listaSuccess}
				</div>
			</div>
		{/if}

		<div class="flex justify-between items-center mb-6">
			<h3 class="text-lg font-bold text-brand-text">Modificar lista</h3>
			<button
				class="p-2 bg-brand-surface-elevated rounded-full text-brand-text-muted hover:text-brand-text"
				onclick={closeEditListModal}
				aria-label="Cerrar"
			>
				<X class="w-4 h-4" />
			</button>
		</div>

		<label for="edit-list-name" class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Nombre
		</label>
		<input
			id="edit-list-name"
			type="text"
			bind:value={editListName}
			class="w-full bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mb-5"
		/>

		<label class="block text-xs font-bold text-brand-text-muted tracking-wider uppercase mb-2">
			Agregar ítem
		</label>
		<form
			class="flex gap-2 mb-5"
			onsubmit={(e) => {
				e.preventDefault();
				addItemToSelectedList();
			}}
		>
			<input
				type="text"
				bind:value={newListItemTitle}
				placeholder="Nuevo ítem..."
				class="flex-1 min-w-0 bg-brand-bg border border-brand-divider rounded-xl px-3 py-2.5 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
			/>
			<button
				type="submit"
				class="shrink-0 bg-brand-accent text-brand-bg font-bold px-4 rounded-xl hover:brightness-105 transition-colors"
				aria-label="Agregar ítem"
			>
				<Plus class="w-5 h-5" />
			</button>
		</form>

		{#if listaError}
			<p class="text-sm text-red-400 mb-3">{listaError}</p>
		{/if}

		<button
			class="w-full bg-brand-accent hover:brightness-105 text-brand-bg font-bold py-3.5 rounded-xl transition-colors mb-3"
			onclick={saveListName}
		>
			Guardar
		</button>

		<button
			class="w-full py-3.5 rounded-xl bg-red-500/15 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-500/25 transition-colors"
			onclick={() => selectedList && deleteTaskList(selectedList.id)}
		>
			<Trash2 class="w-4 h-4" />
			Eliminar lista
		</button>
	</div>
{/if}
