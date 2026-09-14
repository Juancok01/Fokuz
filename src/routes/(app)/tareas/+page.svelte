<script lang="ts">
	import {
	Calendar, GripVertical, CheckCircle2, Circle, Plus, X, AlertTriangle, Trash2,
	Tag, StickyNote, Share2, ListChecks, List, MoreVertical, ArrowLeft, Settings,
	Filter, Timer, CheckSquare, Paperclip, MessageSquare, Flame, ChevronDown, Kanban, LayoutList
} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dndzone } from 'svelte-dnd-action';
	import logo from '$lib/assets/Logo_Fokuz.png';
	import TagSelect from '$lib/components/TagSelect.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { linkPomodoroTask } from '$lib/pomodoro.svelte';

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
	let tasksLoading = $state(false);
	let tasksRefreshing = $state(false);
	let tasksFetchId = 0;
	let loadedDateStr = $state<string | null>(null);
	
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
	let showFilter = $state(false);
	let filterTagIds = $state<number[]>([]);
	let filterSharedWithIds = $state<string[]>([]);
	let filterSharedOnly = $state(false);
	let filterHasLists = $state(false);
	let filterHasNovedad = $state(false);
	let filterStatus = $state<'all' | 'pending' | 'completed'>('all');
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
	let showTaskCreatedToast = $state(false);

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

		const taskId = selectedTaskId;
		const dateStr = formatDateString(date);
		const previous = tasks;
		tasks = tasks.filter((t) => t.id !== taskId);
		closeCalendar();
		showTaskOptions = false;
		showTaskUpdate = false;

		const { error } = await supabase.from('tasks').update({ date: dateStr }).eq('id', taskId);

		if (error) {
			tasks = previous;
			taskActionError = error.message;
		}
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
		const requestId = ++tasksFetchId;
		const dateStr = formatDateString(selectedDate);
		const keepStale = loadedDateStr === dateStr && tasks.length > 0;

		if (keepStale) {
			tasksRefreshing = true;
		} else {
			tasksLoading = true;
			if (loadedDateStr !== dateStr) tasks = [];
		}

		try {
			if (!supabase) {
				console.warn('Supabase no está configurado. Las tareas no se pueden cargar.');
				if (requestId === tasksFetchId) {
					tasks = [];
					loadedDateStr = dateStr;
				}
				return;
			}

			const [ownResult, sharedResult] = await Promise.all([
				supabase
					.from('tasks')
					.select('*, tags(id, name, color)')
					.eq('date', dateStr)
					.order('order_index', { ascending: true }),
				supabase.rpc('get_shared_tasks_for_date', { target_date: dateStr })
			]);

			if (requestId !== tasksFetchId) return;

			if (ownResult.error) alert('Error al cargar: ' + ownResult.error.message);

			let merged = ownResult.data ?? [];

			let sharedList = normalizeSharedTasks(sharedResult.data);
			if (sharedResult.error) {
				console.warn('Error al cargar tareas compartidas:', sharedResult.error.message);
				sharedList = await fetchSharedTasksFallback(dateStr);
			} else if (sharedList.length === 0) {
				// Si el RPC no trae nada, intenta por RLS directo (por si el SQL viejo falla)
				const fallback = await fetchSharedTasksFallback(dateStr);
				if (fallback.length > 0) sharedList = fallback;
			}

			if (requestId !== tasksFetchId) return;

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

				if (requestId !== tasksFetchId) return;

				for (const row of listRows ?? []) {
					taskIdsWithLists.add(row.task_id);
				}

				const rows = shareRows ?? [];
				const sharedOutIds = new Set(rows.map((row) => row.task_id));
				const sharedUserIds = [...new Set(rows.map((row) => row.shared_with))];

				const nameByUserId = new Map<string, string>();
				for (const contact of contacts) {
					nameByUserId.set(contact.id, contactLabel(contact));
				}

				const missingIds = sharedUserIds.filter((id) => !nameByUserId.has(id));
				if (missingIds.length > 0) {
					const { data: profiles } = await supabase
						.from('profiles')
						.select('id, email, display_name')
						.in('id', missingIds);

					if (requestId !== tasksFetchId) return;

					for (const profile of profiles ?? []) {
						nameByUserId.set(
							profile.id,
							(profile.display_name || '').trim() || profile.email.split('@')[0]
						);
					}
				}

				const labelsByTask = new Map<number, string[]>();
				const idsByTask = new Map<number, string[]>();
				for (const row of rows) {
					const labels = labelsByTask.get(row.task_id) ?? [];
					labels.push(nameByUserId.get(row.shared_with) || 'contacto');
					labelsByTask.set(row.task_id, labels);

					const ids = idsByTask.get(row.task_id) ?? [];
					ids.push(row.shared_with);
					idsByTask.set(row.task_id, ids);
				}

				merged = merged.map((t) => {
					const labels = labelsByTask.get(t.id) ?? [];
					const sharedIds = idsByTask.get(t.id) ?? [];
					const isShared =
						Boolean(t.is_shared) || receivedSharedIds.has(t.id) || sharedOutIds.has(t.id);
					return {
						...t,
						is_shared: isShared,
						shared_with_labels: labels,
						shared_with_ids: sharedIds,
						has_lists: taskIdsWithLists.has(t.id)
					};
				});
			}

			if (requestId !== tasksFetchId) return;
			tasks = merged;
			loadedDateStr = dateStr;
		} finally {
			if (requestId === tasksFetchId) {
				tasksLoading = false;
				tasksRefreshing = false;
			}
		}
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
		const ids = [...sharedIds];
		const labels = ids.map((id) => {
			const contact = contacts.find((c) => c.id === id);
			return contact ? contactLabel(contact) : 'contacto';
		});
		tasks = tasks.map((t) =>
			t.id === taskId
				? {
						...t,
						is_shared: labels.length > 0 || Boolean(t.is_shared_with_me),
						shared_with_labels: labels,
						shared_with_ids: ids
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

	// Solo reaccionar al cambio de fecha; untrack evita bucle con tasks/loading
	$effect(() => {
		void selectedDate;
		untrack(() => {
			fetchTasks();
		});
	});

	$effect(() => {
		untrack(() => {
			fetchTags();
			fetchContacts();
		});
	});

	const toggleTask = async (id: number) => {
		const task = tasks.find((t) => t.id === id);
		if (!task) return;

		const previous = task.is_completed;
		task.is_completed = !task.is_completed;

		if (supabase) {
			const { error } = await supabase
				.from('tasks')
				.update({ is_completed: task.is_completed })
				.eq('id', id);
			if (error) {
				task.is_completed = previous;
				alert('Error al actualizar: ' + error.message);
				return;
			}
		}

		if (showCalendar) await fetchActiveTaskDays();
	};

	const openNewTask = () => {
		newTaskTitle = '';
		selectedTagId = null;
		showNewTask = true;
	};

	const addTask = async () => {
		if (!newTaskTitle.trim()) return;

		const tag = tags.find((t) => t.id === selectedTagId) ?? null;
		const newTask = {
			title: newTaskTitle.trim(),
			is_completed: false,
			date: formatDateString(selectedDate),
			order_index: tasks.length,
			novedad: '',
			tag_id: selectedTagId
		};
		const tempId = -Date.now();
		tasks = [
			...tasks,
			{
				id: tempId,
				...newTask,
				tags: tag,
				is_shared: false,
				has_lists: false
			}
		];
		newTaskTitle = '';
		selectedTagId = null;
		showNewTask = false;

		if (!supabase) return;

		const { data, error } = await supabase
			.from('tasks')
			.insert([newTask])
			.select('*, tags(id, name, color)');

		if (error) {
			tasks = tasks.filter((t) => t.id !== tempId);
			alert('Error al crear tarea: ' + error.message);
			return;
		}

		if (data?.[0]) {
			tasks = tasks.map((t) => (t.id === tempId ? { ...data[0], has_lists: false } : t));
		}

		showTaskCreatedToast = true;

		if (showCalendar) await fetchActiveTaskDays();
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

	const saveTaskDetails = async () => {
		if (selectedTaskId === null) return;

		const title = selectedTaskTitle.trim();
		if (!title) {
			taskActionError = 'El título no puede estar vacío.';
			return;
		}

		const taskIndex = tasks.findIndex((t) => t.id === selectedTaskId);
		if (taskIndex === -1) return;

		const previous = {
			title: tasks[taskIndex].title,
			tag_id: tasks[taskIndex].tag_id ?? null,
			tags: tasks[taskIndex].tags ?? null
		};
		const nextTag = tags.find((t) => t.id === editingTagId) ?? null;

		tasks[taskIndex].title = title;
		tasks[taskIndex].tag_id = editingTagId;
		tasks[taskIndex].tags = nextTag;
		selectedTaskTitle = title;
		taskActionError = '';

		if (supabase) {
			const { error } = await supabase
				.from('tasks')
				.update({ title, tag_id: editingTagId })
				.eq('id', selectedTaskId);
			if (error) {
				tasks[taskIndex].title = previous.title;
				tasks[taskIndex].tag_id = previous.tag_id;
				tasks[taskIndex].tags = previous.tags;
				selectedTaskTitle = previous.title;
				taskActionError = error.message;
				return;
			}
		}

		taskActionSuccess = 'Tarea actualizada.';
	};

	const saveNovedad = async () => {
		if (selectedTaskId === null) return;

		const taskIndex = tasks.findIndex((t) => t.id === selectedTaskId);
		if (taskIndex !== -1) {
			const previous = tasks[taskIndex].novedad;
			tasks[taskIndex].novedad = editingNovedad;
			if (supabase) {
				const { error } = await supabase
					.from('tasks')
					.update({ novedad: editingNovedad })
					.eq('id', selectedTaskId);
				if (error) {
					tasks[taskIndex].novedad = previous;
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

		if (!confirm('¿Estás seguro de que deseas eliminar esta tarea?')) return;

		const taskId = selectedTaskId;
		const previous = tasks;
		tasks = tasks.filter((t) => t.id !== taskId);
		showTaskUpdate = false;
		showTaskOptions = false;

		if (supabase) {
			const { error } = await supabase.from('tasks').delete().eq('id', taskId);
			if (error) {
				tasks = previous;
				alert('Error al eliminar la tarea: ' + error.message);
				return;
			}
		}

		if (showCalendar) await fetchActiveTaskDays();
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
		if (hasActiveFilters) return;
		tasks = e.detail.items;
	};

	const handleDndFinalize = async (e: any) => {
		if (hasActiveFilters) return;
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

	let hasActiveFilters = $derived(
		filterStatus !== 'all' ||
			filterTagIds.length > 0 ||
			filterSharedWithIds.length > 0 ||
			filterSharedOnly ||
			filterHasLists ||
			filterHasNovedad
	);

	let filteredTasks = $derived.by(() => {
		if (!hasActiveFilters) return tasks;

		return tasks.filter((task) => {
			if (filterStatus === 'pending' && task.is_completed) return false;
			if (filterStatus === 'completed' && !task.is_completed) return false;

			if (filterTagIds.length > 0) {
				const tag = getTaskTag(task);
				if (!tag || !filterTagIds.includes(tag.id)) return false;
			}

			if (filterHasNovedad && !(typeof task.novedad === 'string' && task.novedad.trim())) {
				return false;
			}

			if (filterHasLists && !task.has_lists) return false;

			if (filterSharedOnly || filterSharedWithIds.length > 0) {
				if (!task.is_shared) return false;
				if (filterSharedWithIds.length > 0) {
					const sharedIds = (task.shared_with_ids ?? []) as string[];
					if (!filterSharedWithIds.some((id) => sharedIds.includes(id))) return false;
				}
			}

			return true;
		});
	});

	const toggleFilterTag = (tagId: number) => {
		filterTagIds = filterTagIds.includes(tagId)
			? filterTagIds.filter((id) => id !== tagId)
			: [...filterTagIds, tagId];
	};

	const toggleFilterContact = (contactId: string) => {
		filterSharedWithIds = filterSharedWithIds.includes(contactId)
			? filterSharedWithIds.filter((id) => id !== contactId)
			: [...filterSharedWithIds, contactId];
		if (filterSharedWithIds.length > 0) filterSharedOnly = true;
	};

	const clearFilters = () => {
		filterStatus = 'all';
		filterTagIds = [];
		filterSharedWithIds = [];
		filterSharedOnly = false;
		filterHasLists = false;
		filterHasNovedad = false;
	};

	const focusOnSelectedTask = () => {
		if (selectedTaskId == null) return;
		linkPomodoroTask(selectedTaskId, selectedTaskTitle || 'Tarea');
		showTaskOptions = false;
		showTaskUpdate = false;
		goto('/pomodoro');
	};


	// --- KANBAN MOCK LOGIC ---
	const COLUMNS = [
		{ id: 'backlog', title: 'Por Hacer / Backlog', color: 'bg-brand-surface' },
		{ id: 'progress', title: 'En Progreso', color: 'bg-brand-surface' },
		{ id: 'review', title: 'En Revisión / Pausa', color: 'bg-brand-surface' },
		{ id: 'completed', title: 'Completado', color: 'bg-brand-surface' }
	];

	let kanbanState = $derived.by(() => {
		const cols = { backlog: [], progress: [], review: [], completed: [] };
		tasks.forEach(t => {
			if (t.is_completed) cols.completed.push(t);
			else {
				const mod = Math.abs(t.id) % 3;
				if (mod === 0) cols.backlog.push(t);
				else if (mod === 1) cols.progress.push(t);
				else cols.review.push(t);
			}
		});
		Object.keys(cols).forEach(k => cols[k].sort((a,b) => a.order_index - b.order_index));
		return cols;
	});
	
	let boardItems = $state({ backlog: [], progress: [], review: [], completed: [] });
	
	$effect(() => {
		boardItems = kanbanState;
	});

	function handleDndConsiderCards(e, colId) {
		boardItems[colId] = e.detail.items;
	}
	function handleDndFinalizeCards(e, colId) {
		boardItems[colId] = e.detail.items;
		// Normally we would update supabase here based on the new column and order
	}
	// -------------------------
</script>

<svelte:head>
	<title>Tablero Tareas · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden">
	<!-- Top Toolbar -->
	<header class="shrink-0 border-b border-brand-divider bg-brand-surface px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
		<div class="flex items-center gap-6">
			<button class="flex items-center gap-2 text-brand-text hover:text-brand-accent transition-colors font-bold text-sm bg-[#0d1216] border border-brand-divider px-3 py-1.5 rounded-lg">
				<span class="w-2 h-2 rounded-full bg-brand-accent"></span>
				Tablero: Enfoque Semanal & Proyectos
				<ChevronDown class="w-4 h-4 text-brand-text-muted" />
			</button>
			
			<div class="flex items-center gap-1 border border-brand-divider bg-[#0d1216] p-1 rounded-lg">
				<button class="flex items-center gap-2 px-3 py-1 rounded-md bg-brand-surface-elevated border border-brand-divider text-brand-accent text-xs font-bold shadow-sm">
					<Kanban class="w-3.5 h-3.5" /> Kanban
				</button>
				<button class="flex items-center gap-2 px-3 py-1 rounded-md text-brand-text-muted hover:text-brand-text text-xs font-semibold transition-colors">
					<LayoutList class="w-3.5 h-3.5" /> Lista
				</button>
				<button class="flex items-center gap-2 px-3 py-1 rounded-md text-brand-text-muted hover:text-brand-text text-xs font-semibold transition-colors">
					<Calendar class="w-3.5 h-3.5" /> Calendario
				</button>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text border border-transparent hover:border-brand-divider text-xs font-semibold transition-colors" onclick={() => showTags = true}>
				<Tag class="w-3.5 h-3.5" /> Etiquetas
			</button>
			<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-text hover:text-brand-accent border border-transparent hover:border-brand-divider text-xs font-semibold transition-colors">
				<span class="w-2 h-2 rounded-full bg-brand-accent"></span> Solo mías
			</button>
			<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-accent bg-brand-accent/10 border border-brand-accent/20 text-xs font-bold transition-colors">
				<Zap class="w-3.5 h-3.5" /> Sprint 37 (13 - 19 Sept)
			</button>
			<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text border border-brand-divider text-xs font-semibold transition-colors bg-[#0d1216]">
				<Settings class="w-3.5 h-3.5" /> Reglas
			</button>
			<button class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-brand-bg bg-brand-accent hover:brightness-105 shadow-[0_0_10px_var(--color-brand-accent-muted)] text-xs font-bold transition-all" onclick={openNewTask}>
				<Plus class="w-4 h-4" /> Añadir Tarjeta
			</button>
		</div>
	</header>

	<!-- Kanban Board -->
	<div class="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar p-6 bg-[#070b0e]">
		<div class="flex items-start gap-6 h-full min-w-max pb-4">
			{#each COLUMNS as col}
				<div class="flex flex-col w-80 h-full max-h-full rounded-2xl bg-[#0d1216] border border-brand-divider overflow-hidden shadow-lg">
					<!-- Column Header -->
					<div class="flex items-center justify-between p-4 border-b border-brand-divider/50 bg-[#0d1216]">
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full {col.id === 'completed' ? 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]' : (col.id === 'progress' ? 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]' : (col.id === 'review' ? 'bg-amber-400 shadow-[0_0_8px_var(--color-amber-400)]' : 'bg-brand-text-muted'))}"></span>
							<h3 class="text-sm font-bold text-brand-text">{col.title}</h3>
							<span class="text-[10px] font-bold text-brand-text-muted bg-brand-surface border border-brand-divider px-2 py-0.5 rounded-full">
								{boardItems[col.id]?.length || 0}
							</span>
						</div>
						<button class="text-brand-text-muted hover:text-brand-text transition-colors p-1 rounded-md hover:bg-brand-surface-elevated">
							<MoreVertical class="w-4 h-4" />
						</button>
					</div>

					<!-- Column Body (Draggable Area) -->
					<div 
						class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-brand-surface/30"
						use:dndzone={{items: boardItems[col.id] || [], flipDurationMs: 200, dropTargetStyle: {}}}
						on:consider={(e) => handleDndConsiderCards(e, col.id)}
						on:finalize={(e) => handleDndFinalizeCards(e, col.id)}
					>
						{#each (boardItems[col.id] || []) as task (task.id)}
							<div class="bg-[#070b0e] border border-brand-divider rounded-xl p-4 shadow-sm hover:border-brand-accent/50 transition-colors group cursor-grab active:cursor-grabbing relative overflow-hidden">
								
								<!-- Mock Tag & Priority -->
								<div class="flex items-center justify-between mb-3">
									{#if task.tags}
										<span class="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase" style="background: {task.tags.color}15; color: {task.tags.color}; border: 1px solid {task.tags.color}30">
											{task.tags.name}
										</span>
									{:else}
										<span class="px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide uppercase bg-brand-surface-elevated text-brand-text-muted border border-brand-divider">
											General
										</span>
									{/if}
									
									<!-- Mock Priority or Deadlines based on ID parity -->
									{#if task.id % 4 === 0}
										<span class="flex items-center gap-1 text-[9px] font-bold text-red-400"><ListChecks class="w-3 h-3" /> Alta</span>
									{:else if task.id % 4 === 1}
										<span class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/20">Activa hoy</span>
									{:else if task.id % 4 === 2}
										<span class="flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-md"><Timer class="w-3 h-3" /> Hoy 18:00</span>
									{/if}
								</div>

								<!-- Title -->
								<h4 class="text-[13px] font-bold text-brand-text leading-snug mb-2 group-hover:text-brand-accent transition-colors">{task.title}</h4>
								
								<!-- Novedad (Description) -->
								{#if task.novedad}
									<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-3 mb-3 border-l-2 border-brand-divider pl-2">
										{task.novedad}
									</p>
								{:else if task.id % 2 !== 0}
									<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-2 mb-3">
										Subtareas generadas a partir de la revisión de ayer. Pendiente aprobar recursos.
									</p>
								{/if}

								<!-- Mock Progress Bar for subtasks -->
								{#if task.id % 3 === 0}
									<div class="mb-3">
										<div class="flex items-center justify-between text-[9px] font-bold text-brand-text-muted mb-1">
											<span>Progreso</span>
											<span class="text-brand-accent">60%</span>
										</div>
										<div class="h-1.5 bg-brand-surface rounded-full overflow-hidden border border-brand-divider">
											<div class="h-full bg-brand-accent w-[60%] rounded-full shadow-[0_0_5px_var(--color-brand-accent)]"></div>
										</div>
									</div>
								{:else if task.id % 2 === 0}
									<div class="flex items-center justify-between mb-3 text-[10px] font-semibold text-brand-text-muted">
										<div class="flex items-center gap-1">
											<CheckSquare class="w-3.5 h-3.5 text-brand-accent/80" />
										</div>
										<span class="text-brand-text">3/4</span>
									</div>
									<div class="h-1 bg-brand-surface mb-3 rounded-full overflow-hidden">
										<div class="h-full bg-brand-accent w-3/4 rounded-full"></div>
									</div>
								{/if}

								<!-- Footer Icons & Avatars -->
								<div class="flex items-center justify-between pt-1">
									<div class="flex items-center gap-3 text-[10px] font-medium text-brand-text-muted">
										{#if task.id % 2 === 0}
											<span class="flex items-center gap-1 hover:text-brand-text transition-colors"><Paperclip class="w-3 h-3" /> 2</span>
											<span class="flex items-center gap-1 hover:text-brand-text transition-colors"><MessageSquare class="w-3 h-3" /> 1</span>
										{:else if task.id % 3 === 0}
											<span class="flex items-center gap-1 text-orange-400"><Flame class="w-3 h-3" /> Racha: 12d</span>
										{:else}
											<span class="flex items-center gap-1"><Timer class="w-3 h-3" /> 15 min</span>
										{/if}
									</div>
									<div class="w-6 h-6 rounded-full bg-brand-accent/20 border border-brand-accent/50 flex items-center justify-center text-[9px] font-bold text-brand-accent">
										JN
									</div>
								</div>

							</div>
						{/each}
						
						<!-- Add Card Button inside column -->
						<button class="w-full py-3 mt-2 flex items-center justify-center gap-2 text-[11px] font-bold text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated border border-transparent hover:border-brand-divider rounded-xl transition-all" onclick={openNewTask}>
							<Plus class="w-4 h-4" /> Añadir tarjeta
						</button>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Bottom Status Bar -->
	<footer class="shrink-0 h-10 border-t border-brand-divider bg-[#070b0e] px-6 flex items-center justify-between text-[11px] font-medium relative z-10">
		<div class="flex items-center gap-6">
			<span class="flex items-center gap-2 text-brand-text font-bold"><Kanban class="w-3.5 h-3.5 text-brand-text-muted" /> {tasks.length} tareas en este tablero</span>
			<span class="flex items-center gap-2 text-brand-accent font-bold"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_var(--color-brand-accent)]"></span> {boardItems.completed.length} completadas ({tasks.length ? Math.round((boardItems.completed.length / tasks.length)*100) : 0}%)</span>
			<span class="flex items-center gap-1 text-orange-400 font-bold"><span class="w-1 h-1 rounded-full bg-orange-400"></span> Próxima entrega: Hoy 18:00</span>
		</div>
		<div class="flex items-center gap-4">
			<div class="flex -space-x-1.5">
				<div class="w-5 h-5 rounded-full bg-brand-accent/20 border border-[#070b0e] flex items-center justify-center text-[8px] font-bold text-brand-accent z-30 shadow-sm">JN</div>
				<div class="w-5 h-5 rounded-full bg-pink-500/20 border border-[#070b0e] flex items-center justify-center text-[8px] font-bold text-pink-500 z-20 shadow-sm">AL</div>
				<div class="w-5 h-5 rounded-full bg-purple-500/20 border border-[#070b0e] flex items-center justify-center text-[8px] font-bold text-purple-500 z-10 shadow-sm">MC</div>
			</div>
			<div class="flex items-center gap-1.5 text-brand-text-muted font-bold">
				<span class="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_5px_var(--color-brand-accent)]"></span> Tablero sincronizado
			</div>
		</div>
	</footer>
</div>

<!-- Modals Block -->
{#if showNewTask}
	<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-md p-6 shadow-2xl">
			<div class="flex justify-between items-center mb-6">
				<h3 class="text-lg font-bold text-brand-text">Nueva Tarjeta</h3>
				<button class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted" onclick={() => showNewTask = false}><X class="w-5 h-5"/></button>
			</div>
			
			<input 
				type="text" 
				bind:value={newTaskTitle} 
				placeholder="¿Qué necesitas hacer?" 
				class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text placeholder-brand-text-muted mb-4 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
				onkeydown={(e) => e.key === 'Enter' && addTask()}
			/>

			{#if tags.length > 0}
				<div class="mb-6">
					<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Etiqueta</label>
					<div class="flex flex-wrap gap-2">
						{#each tags as tag}
							<button 
								class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors {selectedTagId === tag.id ? 'bg-brand-surface-elevated' : 'bg-[#0d1216] border-brand-divider text-brand-text-muted hover:bg-brand-surface-elevated'}"
								style={selectedTagId === tag.id ? `border-color: ${tag.color}; color: ${tag.color};` : ''}
								onclick={() => selectedTagId = tag.id}
							>
								{tag.name}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex justify-end gap-3">
				<button class="px-4 py-2 rounded-xl text-brand-text font-bold hover:bg-brand-surface-elevated transition-colors" onclick={() => showNewTask = false}>Cancelar</button>
				<button class="px-5 py-2 bg-brand-accent text-brand-bg font-bold rounded-xl hover:brightness-105 transition-colors flex items-center gap-2 shadow-[0_0_10px_var(--color-brand-accent-muted)]" onclick={addTask}>
					<Plus class="w-4 h-4"/> Crear
				</button>
			</div>
		</div>
	</div>
{/if}
