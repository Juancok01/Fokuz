<script lang="ts">
	import {
	Calendar, GripVertical, CheckCircle2, Circle, Plus, X, AlertTriangle, Trash2, Tag, StickyNote, Share2, ListChecks, List, MoreVertical, ArrowLeft, Settings,
	Filter, Timer, CheckSquare, Paperclip, MessageSquare, Flame, ChevronDown, Kanban, LayoutList, Zap, ChevronLeft, ChevronRight, Edit2, Clock, Users, ThumbsUp, Lock, AlignLeft, Activity, Check, AlertCircle, AtSign
} from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { dndzone } from 'svelte-dnd-action';
	import logo from '$lib/assets/Logo_Fokuz.png';
	import TagSelect from '$lib/components/TagSelect.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import DateTimePicker from '$lib/components/DateTimePicker.svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
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
	let boardId = $derived(page.params.boardId);
	let currentBoard = $state<any>(null);
	let allBoards = $state<any[]>([]);
	let showBoardDropdown = $state(false);
	let viewMode = $state('kanban');
	let boardLists = $state<any[]>([]);
	let calendarCurrentMonth = $state(new Date());
	let boardCalendarDays = $derived.by(() => {
		const year = calendarCurrentMonth.getFullYear();
		const month = calendarCurrentMonth.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		
		let days = [];
		const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Lunes como inicio
		for (let i = 0; i < startPadding; i++) {
			const d = new Date(year, month, -startPadding + i + 1);
			days.push({ date: d, currentMonth: false });
		}
		
		for (let i = 1; i <= lastDay.getDate(); i++) {
			const d = new Date(year, month, i);
			days.push({ date: d, currentMonth: true, isToday: new Date().toDateString() === d.toDateString() });
		}
		
		const endPadding = 42 - days.length;
		for (let i = 1; i <= endPadding; i++) {
			const d = new Date(year, month + 1, i);
			days.push({ date: d, currentMonth: false });
		}
		return days;
	});

	function getTasksForCalendarDate(d) {
		const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
		return tasks.filter(t => {
			const targetDate = t.end_date ? t.end_date : t.date;
			return targetDate === dateStr;
		});
	}
	
	function nextCalMonth() { calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() + 1, 1); }
	function prevCalMonth() { calendarCurrentMonth = new Date(calendarCurrentMonth.getFullYear(), calendarCurrentMonth.getMonth() - 1, 1); }

	$effect(() => { if (boardId) loadBoard(boardId); });

	async function loadBoard(id) { 
		const {data} = await supabase.from('boards').select('*').eq('id', id).single(); 
		currentBoard = data; 
		const {data: boardsData} = await supabase.from('boards').select('*').order('created_at', { ascending: true });
		allBoards = boardsData || [];
	}
	let tasksRefreshing = $state(false);
	let tasksFetchId = 0;
	let loadedDateStr = $state<string | null>(null);
	
	// Inicializar la fecha a las 00:00:00 sin mutaciones externas para evitar warnings en Svelte 5
	const initDate = new Date();
	initDate.setHours(0,0,0,0);
	let selectedDate = $state(initDate);

	let showNewTask = $state(false);
	let showTaskUpdate = $state(false);
	let showDeleteTaskConfirm = $state(false);
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
	let newTaskStartDate = $state(new Date().toISOString().split('T')[0]);
	let newTaskEndDate = $state('');
	let newTaskSharedWith = $state<string[]>([]);
	let selectedTagId = $state<number | null>(null);
	let newTagName = $state('');
	let newTagColor = $state('#feef4c');
	let tagToDelete = $state<number | null>(null);
	let tagToEdit = $state<number | null>(null);
	let editTagName = $state('');
	let editTagColor = $state('');
	let openListMenuId = $state<number | null>(null);
	let listToEdit = $state<number | null>(null);
	let editListTitle = $state('');
	let listToDelete = $state<number | null>(null);

	const TAG_COLORS = ['#feef4c', '#7dd3fc', '#f9a8d4', '#86efac', '#fdba74', '#c4b5fd'];
	
	// Estado para editar la tarea
	let selectedTaskId = $state<number | null>(null);
	let selectedTaskTitle = $state('');
	let subtaskTitle = $state('');
	let taskComments = $state<any[]>([]);
	let newCommentText = $state('');
	
	let subtasks = $derived(
		tasks.filter(t => t.parent_task_id === selectedTaskId)
	);
	let editingNovedad = $state('');
	let editingDescription = $state('');
	let editingDate = $state('');
	let editingEndDate = $state('');
	let editingTagId = $state<number | null>(null);
	let showNewChecklistForm = $state(false);
	let newChecklistName = $state('');
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
			.eq('board_id', Number(boardId))
			.order('order_index', { ascending: true });

		if (error) {
			console.warn('Error al cargar tareas compartidas (fallback):', error.message);
			return [];
		}

		return data ?? [];
	};

		let boardListsError = $state('');

	const fetchBoardLists = async () => {
		if (!supabase) return;
		const { data, error } = await supabase
			.from('board_lists')
			.select('*')
			.eq('board_id', Number(boardId))
			.order('order_index', { ascending: true });
		if (error) {
			console.error("Error al cargar board_lists:", error);
			boardListsError = error.message;
		}
		if (!error && data) {
			boardLists = data;
		}
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
					.eq('board_id', Number(boardId))
					.order('order_index', { ascending: true }),
				/* supabase.rpc('get_shared_tasks_for_date', { target_date: dateStr }) */ { data: [], error: null }
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

	const saveTagEdit = async () => {
		if (!tagToEdit) return;
		const name = editTagName.trim();
		if (!name) return;

		if (supabase) {
			const { error } = await supabase.from('tags').update({ name, color: editTagColor }).eq('id', tagToEdit);
			if (error) {
				alert('Error al actualizar etiqueta: ' + error.message);
				return;
			}
		}
		
		tags = tags.map(t => t.id === tagToEdit ? { ...t, name, color: editTagColor } : t);
		tagToEdit = null;
	};

	const deleteTag = async (tagId: number) => {
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
		tagToDelete = null;
		await fetchBoardLists();
		await fetchTasks();
	};

	// Solo reaccionar al cambio de fecha; untrack evita bucle con tasks/loading
	$effect(() => {
		void selectedDate;
		void boardId;
		untrack(() => {
			fetchBoardLists().then(() => {
				fetchTasks();
			});
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
		const payload = {
			title: newTaskTitle.trim(),
			is_completed: false,
			board_id: Number(boardId),
			status: 'backlog',
			order_index: tasks.length,
			novedad: '',
			date: newTaskStartDate,
			end_date: newTaskEndDate || null,
			tag_id: selectedTagId
		};
		
		const tempId = -Date.now();
		const sharedWithIds = [...newTaskSharedWith];
		
		tasks = [
			...tasks,
			{
				id: tempId,
				...payload,
				tags: tag,
				is_shared: sharedWithIds.length > 0,
				shared_with_ids: sharedWithIds,
				has_lists: false
			}
		];
		
		newTaskTitle = '';
		selectedTagId = null;
		newTaskStartDate = new Date().toISOString().split('T')[0];
		newTaskEndDate = '';
		newTaskSharedWith = [];
		showNewTask = false;

		if (!supabase) return;

		const { data, error } = await supabase
			.from('tasks')
			.insert([payload])
			.select('*, tags(id, name, color)');

		if (error) {
			tasks = tasks.filter((t) => t.id !== tempId);
			alert('Error al crear tarea: ' + error.message);
			return;
		}

		if (data?.[0]) {
			const createdTask = data[0];
			let finalTask = { 
				...createdTask, 
				has_lists: false, 
				is_shared: sharedWithIds.length > 0, 
				shared_with_ids: sharedWithIds 
			};

			if (sharedWithIds.length > 0) {
				const sharesToInsert = sharedWithIds.map(contactId => ({
					task_id: createdTask.id,
					shared_with: contactId
				}));
				// Ejecutamos silenciosamente
				supabase.from('task_shares').insert(sharesToInsert).then(({error: shareError}) => {
					if (shareError) console.error('Error sharing task:', shareError);
				});

				// Automatically share board
				const boardSharesToUpsert = sharedWithIds.map(contactId => ({
					board_id: Number(boardId),
					shared_with: contactId
				}));
				supabase.from('board_shares').upsert(boardSharesToUpsert, { onConflict: 'board_id, shared_with' }).then(({error: boardShareError}) => {
					if (boardShareError) console.error('Error sharing board:', boardShareError);
				});
			}
			
			tasks = tasks.map((t) => (t.id === tempId ? finalTask : t));
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

		taskLists = data ?? [];
		
		const listIds = taskLists.map((l) => l.id);
		if (listIds.length === 0) {
			selectedListItems = [];
			listsLoading = false;
			return;
		}

		const { data: itemsData, error: itemsError } = await supabase
			.from('task_list_items')
			.select('id, list_id, title, is_completed, order_index')
			.in('list_id', listIds)
			.order('order_index', { ascending: true });

		if (itemsError) {
			console.warn('Error cargando list items:', itemsError.message);
		} else if (itemsData) {
			const itemsByList = {};
			itemsData.forEach((it) => {
				if (!itemsByList[it.list_id]) itemsByList[it.list_id] = [];
				itemsByList[it.list_id].push(it);
			});
			taskLists = taskLists.map((l) => {
				const items = itemsByList[l.id] || [];
				return {
					...l,
					item_count: items.length,
					done_count: items.filter((i: any) => i.is_completed).length
				};
			});
		}

		listsLoading = false;
	};

	const loadTaskComments = async (taskId: number) => {
		taskComments = [];
		if (!supabase) return;

		const { data, error } = await supabase
			.from('task_comments')
			.select('*')
			.eq('task_id', taskId)
			.order('created_at', { ascending: true });

		if (error) {
			console.warn('Error al cargar comentarios:', error.message);
		} else {
			const { data: { session } } = await supabase.auth.getSession();
			const me = session?.user;
			
			taskComments = (data ?? []).map(comment => {
				let userData = { email: 'Usuario', raw_user_meta_data: { name: 'Usuario' } };
				if (me && me.id === comment.user_id) {
					userData = { email: me.email, raw_user_meta_data: me.user_metadata };
				} else {
					const contact = contacts.find(c => c.id === comment.user_id);
					if (contact) {
						userData = { email: contact.email, raw_user_meta_data: { name: contact.display_name || contact.nickname } };
					}
				}
				return { ...comment, user: userData };
			});
		}
	};

	const addTaskComment = async () => {
		if (!newCommentText.trim() || !selectedTaskId || !supabase) return;
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) return;
		
		const { data, error } = await supabase.from('task_comments').insert({
			task_id: selectedTaskId,
			user_id: session.user.id,
			content: newCommentText.trim()
		}).select('*').single();

		if (data) {
			const newComment = {
				...data,
				user: {
					email: session.user.email,
					raw_user_meta_data: session.user.user_metadata
				}
			};
			taskComments = [...taskComments, newComment];
			newCommentText = '';
		} else if (error) {
			console.error("Error al añadir comentario:", error.message);
			alert("Error al añadir comentario: " + error.message);
		}
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
		try {
			selectedTaskId = task.id;
			selectedTaskTitle = task.title || '';
			editingNovedad = task.novedad || '';
			editingDescription = task.description || '';
			editingDate = '';
			if (task.date) {
				try { editingDate = new Date(task.date).toISOString().slice(0, 16); } catch (e) {}
			}
			
			editingEndDate = '';
			if (task.end_date) {
				try { editingEndDate = new Date(task.end_date).toISOString().slice(0, 16); } catch (e) {}
			}
			editingTagId = task.tag_id ?? getTaskTag(task)?.id ?? null;
			closeListModals();
			taskPanel = 'menu';
			taskActionError = '';
			taskActionSuccess = '';
			showTaskOptions = false;
			showTaskUpdate = true;
			await loadTaskShares(task.id);
			await loadTaskLists(task.id);
			await loadTaskComments(task.id);
		} catch (e) {
			console.error("Error al abrir tarea:", e);
			alert("Error al abrir tarea: " + (e.message || String(e)));
		}
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
		// Note: intentionally NOT clearing taskLists here so the checklist panel stays populated
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
			tags: tasks[taskIndex].tags ?? null,
			novedad: tasks[taskIndex].novedad,
			description: tasks[taskIndex].description,
			date: tasks[taskIndex].date,
			end_date: tasks[taskIndex].end_date
		};
		const nextTag = tags.find((t) => t.id === editingTagId) ?? null;

		tasks[taskIndex].title = title;
		tasks[taskIndex].tag_id = editingTagId;
		tasks[taskIndex].tags = nextTag;
		tasks[taskIndex].novedad = editingNovedad;
		tasks[taskIndex].description = editingDescription;
		tasks[taskIndex].date = editingDate || null;
		tasks[taskIndex].end_date = editingEndDate || null;
		selectedTaskTitle = title;
		taskActionError = '';

		if (supabase) {
			const { error } = await supabase
				.from('tasks')
				.update({ 
					title, 
					tag_id: editingTagId, 
					novedad: editingNovedad,
					description: editingDescription,
					date: editingDate || null,
					end_date: editingEndDate || null
				})
				.eq('id', selectedTaskId);
			if (error) {
				tasks[taskIndex].title = previous.title;
				tasks[taskIndex].tag_id = previous.tag_id;
				tasks[taskIndex].tags = previous.tags;
				tasks[taskIndex].novedad = previous.novedad;
				tasks[taskIndex].description = previous.description;
				tasks[taskIndex].date = previous.date;
				tasks[taskIndex].end_date = previous.end_date;
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
				
				// Automatically share board
				await supabase.from('board_shares').upsert({
					board_id: Number(boardId),
					shared_with: contactId
				}, { onConflict: 'board_id, shared_with' });

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

	const deleteTask = () => {
		showDeleteTaskConfirm = true;
	};

	const confirmDeleteTask = async () => {
		if (selectedTaskId === null) return;
		showDeleteTaskConfirm = false;

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


	// --- KANBAN LOGIC ---
	let kanbanState = $derived.by(() => {
		const cols = {};
		boardLists.forEach(l => cols[l.id] = []);
		tasks.forEach(t => {
			// Apply "Solo mías" filter
			if (filterSharedOnly) {
				const isMine = t.is_shared === false || (t.shared_with_ids && t.shared_with_ids.length > 0);
				if (!isMine) return; // Super simple heuristic for now
			}
			
			let targetList = t.list_id;
			if (!targetList && boardLists.length > 0) targetList = boardLists[0].id;
			
			if (cols[targetList]) cols[targetList].push(t);
		});
		Object.keys(cols).forEach(k => cols[k].sort((a,b) => a.order_index - b.order_index));
		return cols;
	});
	
	let boardItems = $state({});
	
	$effect(() => {
		boardItems = kanbanState;
	});

	function handleDndConsiderCards(e, colId) {
		boardItems[colId] = e.detail.items;
	}
	function handleDndFinalizeCards(e, colId) {
		boardItems[colId] = e.detail.items;
		boardItems[colId].forEach(async (t, i) => {
			if (t.order_index !== i || t.list_id !== colId) {
				const updates = { order_index: i, list_id: colId };
				const tempTasks = [...tasks];
				tasks = tasks.map(tt => tt.id === t.id ? { ...tt, ...updates } : tt);
				if (supabase) {
					const {error} = await supabase.from('tasks').update(updates).eq('id', t.id);
					if (error) {
						tasks = tempTasks;
						console.error(error);
					}
				}
			}
		});
	}

	function handleDndConsiderColumns(e) {
		boardLists = e.detail.items;
	}

	async function handleDndFinalizeColumns(e) {
		boardLists = e.detail.items;
		if (supabase) {
			const updates = boardLists.map((l, index) => ({
				id: l.id,
				board_id: Number(boardId),
				name: l.name,
				order_index: index,
				color: l.color
			}));
			await supabase.from('board_lists').upsert(updates);
		}
	}

	const addList = () => {
		showCrearListaModal = true;
	};

	const confirmAddList = async () => {
		const name = newListName.trim();
		if (!name) return;
		const orderIndex = boardLists.length;
		const { data, error } = await supabase.from('board_lists').insert({
			board_id: Number(boardId),
			name,
			order_index: orderIndex,
			color: 'bg-brand-surface'
		}).select().single();
		if (data) {
			boardLists = [...boardLists, data];
			showCrearListaModal = false;
			newListName = '';
		}
	};

	const addSubtask = async () => {
		if (!subtaskTitle.trim() || selectedTaskId === null || !supabase) return;
		
		const title = subtaskTitle.trim();
		const listId = boardLists[0]?.id; // Default to first list or we can use current list
		const currentTask = tasks.find(t => t.id === selectedTaskId);
		const targetListId = currentTask ? currentTask.list_id : listId;
		const taskDate = currentTask?.date || formatDateString(new Date());

		const { data, error } = await supabase.from('tasks').insert({
			board_id: Number(boardId),
			list_id: targetListId,
			title,
			is_completed: false,
			order_index: 0,
			parent_task_id: selectedTaskId,
			date: taskDate
		}).select('*, tags(id, name, color)').single();

		if (error) {
			console.error("Error creating subtask:", error);
			alert("Error al crear subtarea: " + error.message);
		}

		if (data && !error) {
			tasks = [...tasks, data];
			subtaskTitle = '';
		}
	};

	const saveListEdit = async () => {
		if (!listToEdit) return;
		const name = editListTitle.trim();
		if (!name) return;
		
		if (supabase) {
			const { error } = await supabase.from('board_lists').update({ name }).eq('id', listToEdit);
			if (error) {
				alert('Error al actualizar la lista: ' + error.message);
				return;
			}
		}
		boardLists = boardLists.map(l => l.id === listToEdit ? { ...l, name } : l);
		listToEdit = null;
	};

	const confirmDeleteList = async (listId: number) => {
		if (supabase) {
			const { error } = await supabase.from('board_lists').delete().eq('id', listId);
			if (error) {
				alert('Error al eliminar la lista: ' + error.message);
				return;
			}
		}
		boardLists = boardLists.filter(l => l.id !== listId);
		listToDelete = null;
		await fetchTasks();
	};
	// -------------------------
</script>

<svelte:head>
	<title>Tablero Tareas · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden">
	<!-- Top Toolbar -->
	<header class="shrink-0 border-b border-brand-divider bg-brand-surface px-6 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
		<div class="flex flex-wrap items-center gap-3">
			<button onclick={() => goto('/tareas')} title="Volver a mis tableros" class="flex items-center justify-center p-2 text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated rounded-lg transition-colors border border-brand-divider shadow-sm bg-[#0d1216]">
				<ArrowLeft class="w-4 h-4" />
			</button>
			<div class="relative">
				<button onclick={() => showBoardDropdown = !showBoardDropdown} class="flex items-center gap-2 text-brand-text hover:text-brand-accent transition-colors font-bold text-sm bg-[#0d1216] border border-brand-divider px-3 py-1.5 rounded-lg">
					<span class="w-2 h-2 rounded-full" style={currentBoard ? `background-color: ${currentBoard.color}` : 'background-color: var(--color-brand-accent)'}></span>
					{currentBoard ? currentBoard.title : 'Cargando...'}
					<ChevronDown class="w-4 h-4 text-brand-text-muted transition-transform {showBoardDropdown ? 'rotate-180' : ''}" />
				</button>

				{#if showBoardDropdown}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="fixed inset-0 z-40" onclick={() => showBoardDropdown = false}></div>
					<div class="absolute top-full left-0 mt-2 w-64 bg-brand-surface border border-brand-divider rounded-xl shadow-xl z-50 py-2">
						<div class="px-3 pb-2 mb-2 border-b border-brand-divider">
							<span class="text-xs font-semibold text-brand-text-muted uppercase tracking-wider">Tus Tableros</span>
						</div>
						{#each allBoards as board}
							<button 
								class="w-full text-left px-4 py-2 hover:bg-brand-surface-elevated transition-colors flex items-center gap-3 {board.id == boardId ? 'bg-brand-surface-elevated' : ''}"
								onclick={() => { showBoardDropdown = false; goto('/tareas/' + board.id); }}
							>
								<span class="w-2.5 h-2.5 rounded-full" style="background-color: {board.color}"></span>
								<span class="text-sm font-medium {board.id == boardId ? 'text-brand-accent' : 'text-brand-text'}">{board.title}</span>
							</button>
						{/each}
						<div class="mt-2 pt-2 border-t border-brand-divider px-2">
							<button 
								onclick={() => { showBoardDropdown = false; goto('/tareas'); }}
								class="w-full text-left px-2 py-1.5 hover:bg-brand-surface-elevated transition-colors rounded-lg flex items-center gap-2 text-sm font-semibold text-brand-text-muted"
							>
								<List class="w-4 h-4" /> Ver todos los tableros
							</button>
						</div>
					</div>
				{/if}
			</div>
			
			<div class="flex items-center gap-1 border border-brand-divider bg-[#0d1216] p-1 rounded-lg">
				<button onclick={() => viewMode = 'kanban'} class="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors {viewMode === 'kanban' ? 'bg-brand-surface-elevated border border-brand-divider text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text border border-transparent'}">
					<Kanban class="w-3.5 h-3.5" /> Kanban
				</button>
				<button onclick={() => viewMode = 'lista'} class="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors {viewMode === 'lista' ? 'bg-brand-surface-elevated border border-brand-divider text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text border border-transparent'}">
					<LayoutList class="w-3.5 h-3.5" /> Lista
				</button>
				<button onclick={() => viewMode = 'calendario'} class="flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-colors {viewMode === 'calendario' ? 'bg-brand-surface-elevated border border-brand-divider text-brand-accent shadow-sm' : 'text-brand-text-muted hover:text-brand-text border border-transparent'}">
					<Calendar class="w-3.5 h-3.5" /> Calendario
				</button>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2 md:gap-3">
			<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-brand-text-muted hover:text-brand-text border border-transparent hover:border-brand-divider text-xs font-semibold transition-colors" onclick={() => showTags = true}>
				<Tag class="w-3.5 h-3.5" /> Etiquetas
			</button>

			<button class="flex items-center gap-2 px-4 py-1.5 rounded-lg text-brand-bg bg-brand-accent hover:brightness-105 shadow-[0_0_10px_var(--color-brand-accent-muted)] text-xs font-bold transition-all w-full sm:w-auto justify-center" onclick={addList}>
				<Plus class="w-4 h-4" /> Añadir Lista
			</button>
		</div>
	</header>

	
	{#if viewMode === 'kanban'}
		<!-- Kanban Board -->
		
	<div class="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar p-2 md:p-6 bg-[#070b0e]">
		{#if boardListsError}
			<div class="p-8 text-center text-red-400 bg-red-400/10 rounded-xl mb-4 border border-red-400/20">
				<AlertTriangle class="w-8 h-8 mx-auto mb-2" />
				<p class="font-bold">Error cargando listas:</p>
				<p>{boardListsError}</p>
			</div>
		{/if}
		{#if boardLists.length === 0 && !boardListsError}
			<div class="p-8 text-center text-brand-text-muted">
				<p>No hay listas configuradas en este tablero.</p>
				<button class="mt-4 px-4 py-2 bg-brand-accent text-brand-bg rounded-lg font-bold" onclick={addList}>Crear mi primera lista</button>
			</div>
		{/if}
		<div 
			class="flex items-start gap-6 h-full min-w-max pb-4"
			use:dndzone={{items: boardLists, flipDurationMs: 200, type: 'columns', dropTargetStyle: {}}}
			onconsider={handleDndConsiderColumns}
			onfinalize={handleDndFinalizeColumns}
		>
			{#each boardLists as col (col.id)}
				<div class="flex flex-col w-80 h-full max-h-full rounded-2xl bg-[#0d1216] border border-brand-divider overflow-hidden shadow-lg">
					<!-- Column Header -->
					<div class="flex items-center justify-between p-4 border-b border-brand-divider/50 bg-[#0d1216] relative">
						<div class="flex items-center gap-2 flex-1">
							<span class="w-2 h-2 rounded-full bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)] shrink-0"></span>
							{#if listToEdit === col.id}
								<input 
									type="text" 
									bind:value={editListTitle} 
									class="flex-1 min-w-0 bg-brand-surface border border-brand-accent rounded px-2 py-0.5 text-sm font-bold text-brand-text outline-none shadow-[0_0_5px_var(--color-brand-accent-muted)]"
									onkeydown={(e) => { if (e.key === 'Enter') saveListEdit(); if (e.key === 'Escape') listToEdit = null; }}
									onblur={saveListEdit}
									autofocus
								/>
							{:else}
								<h3 class="text-sm font-bold text-brand-text truncate">{col.name}</h3>
								<span class="text-[10px] font-bold text-brand-text-muted bg-brand-surface border border-brand-divider px-2 py-0.5 rounded-full shrink-0">
									{boardItems[col.id]?.length || 0}
								</span>
							{/if}
						</div>
						<div class="relative shrink-0 ml-2">
							<button class="text-brand-text-muted hover:text-brand-text transition-colors p-1 rounded-md hover:bg-brand-surface-elevated {openListMenuId === col.id ? 'bg-brand-surface-elevated text-brand-text' : ''}" onclick={() => openListMenuId = openListMenuId === col.id ? null : col.id}>
								<MoreVertical class="w-4 h-4" />
							</button>
							{#if openListMenuId === col.id}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="fixed inset-0 z-40" onclick={() => openListMenuId = null}></div>
								<div class="absolute right-0 top-full mt-1 w-40 bg-brand-surface border border-brand-divider rounded-xl shadow-xl z-50 overflow-hidden py-1">
									<button class="w-full text-left px-3 py-2 text-sm text-brand-text hover:bg-brand-surface-elevated transition-colors flex items-center gap-2" onclick={() => { listToEdit = col.id; editListTitle = col.name; openListMenuId = null; }}>
										<Edit2 class="w-3.5 h-3.5 text-brand-text-muted" /> Editar
									</button>
									<button class="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-2" onclick={() => { listToDelete = col.id; openListMenuId = null; }}>
										<Trash2 class="w-3.5 h-3.5" /> Eliminar
									</button>
								</div>
							{/if}
						</div>
					</div>

					<!-- Column Body (Draggable Area) -->
					<div 
						class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-brand-surface/30"
						use:dndzone={{items: boardItems[col.id] || [], flipDurationMs: 200, dropTargetStyle: {}}}
						onconsider={(e) => handleDndConsiderCards(e, col.id)}
						onfinalize={(e) => handleDndFinalizeCards(e, col.id)}
					>
						{#each (boardItems[col.id] || []) as task (task.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="bg-[#070b0e] border border-brand-divider rounded-xl p-4 shadow-sm hover:border-brand-accent/50 transition-colors group cursor-grab active:cursor-grabbing relative overflow-hidden" onclick={() => openTaskUpdate(task)}>
								
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
									
									<div class="flex items-center gap-2">
										{#if task.parent_task_id}
											<span class="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-brand-accent/10 text-brand-accent border border-brand-accent/20">
												<ListChecks class="w-3 h-3" /> Subtarea
											</span>
										{/if}
										<!-- Deadline -->
										{#if task.end_date}
											<span class="flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-md">
												<Timer class="w-3 h-3" /> {new Date(task.end_date).toLocaleDateString()}
											</span>
										{/if}

										{#if task.novedad}
											<div class="w-5 h-5 flex items-center justify-center rounded bg-amber-500 text-brand-bg shadow-[0_0_8px_var(--color-amber-500-muted)] tooltip tooltip-left" data-tip="Tarea bloqueada">
												<AlertTriangle class="w-3.5 h-3.5" strokeWidth="3" />
											</div>
										{/if}
									</div>
								</div>

								<!-- Title & Completion -->
								<div class="flex items-start gap-2 mb-2">
									<button 
										class="mt-0.5 shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors" 
										onclick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
									>
										{#if task.is_completed}
											<CheckCircle2 class="w-4 h-4 text-brand-accent" />
										{:else}
											<Circle class="w-4 h-4" />
										{/if}
									</button>
									<h4 class="text-[13px] font-bold text-brand-text leading-snug group-hover:text-brand-accent transition-colors {task.is_completed ? 'line-through opacity-50' : ''}">{task.title}</h4>
								</div>
								
								<!-- Description -->
								{#if task.description}
									<p class="text-[11px] text-brand-text-muted leading-relaxed line-clamp-3 mb-3 border-l-2 border-brand-divider pl-2">
										{task.description.replace(/<[^>]*>?/gm, '')}
									</p>
								{/if}



								<!-- Footer Icons & Avatars -->
								<div class="flex items-center justify-between pt-1">
									<div class="flex items-center gap-3 text-[10px] font-medium text-brand-text-muted">
										<!-- Future: add comment count or attachments here -->
									</div>
									<div class="flex items-center -space-x-2">
										<div class="w-6 h-6 rounded-full bg-brand-accent/20 border border-brand-accent/50 flex items-center justify-center text-[9px] font-bold text-brand-accent relative z-10" title="Propietario">
											JN
										</div>
										{#if task.is_shared || task.is_shared_with_me}
											{#each contacts.slice(0, 1) as contact, i}
												<div class="w-6 h-6 rounded-full bg-brand-surface-elevated border border-brand-divider flex items-center justify-center text-[9px] font-bold text-brand-text-muted relative" style="z-index: {9 - i}" title={contact.display_name}>
													{contact.nickname ? contact.nickname.substring(0, 2).toUpperCase() : contact.display_name.substring(0, 2).toUpperCase()}
												</div>
											{/each}
										{/if}
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

	
	{:else if viewMode === 'lista'}
		<!-- List View -->
		<div class="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-6 bg-[#070b0e]">
			<div class="max-w-5xl mx-auto space-y-6">
				{#each boardLists as col (col.id)}
					<div class="bg-[#0d1216] rounded-2xl border border-brand-divider overflow-hidden shadow-lg">
						<div class="bg-brand-surface border-b border-brand-divider px-6 py-4 flex items-center justify-between">
							<div class="flex items-center gap-3">
								<span class="w-2.5 h-2.5 rounded-full {col.id === 'completed' ? 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]' : (col.id === 'progress' ? 'bg-brand-accent shadow-[0_0_8px_var(--color-brand-accent-muted)]' : (col.id === 'review' ? 'bg-amber-400 shadow-[0_0_8px_var(--color-amber-400)]' : 'bg-brand-text-muted'))}"></span>
								<h3 class="text-base font-bold text-brand-text">{col.title}</h3>
								<span class="text-xs font-bold text-brand-text-muted bg-[#0d1216] border border-brand-divider px-2.5 py-0.5 rounded-full">
									{boardItems[col.id]?.length || 0}
								</span>
							</div>
						</div>
						<div class="divide-y divide-brand-divider/50">
							{#each (boardItems[col.id] || []) as task (task.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div class="px-6 py-4 hover:bg-brand-surface-elevated transition-colors flex items-center justify-between group cursor-pointer" onclick={() => openTaskUpdate(task)}>
									<div class="flex items-center gap-4">
										<button class="w-5 h-5 rounded-md border-2 {task.is_completed ? 'border-brand-accent bg-brand-accent text-brand-bg' : 'border-brand-text-muted group-hover:border-brand-accent'} flex items-center justify-center transition-colors">
											{#if task.is_completed}<CheckCircle2 class="w-3.5 h-3.5" />{/if}
										</button>
										<span class="text-sm font-semibold {task.is_completed ? 'text-brand-text-muted line-through' : 'text-brand-text'}">{task.title}</span>
									</div>
									<div class="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
										<!-- Botones de acciones, por ahora solo iconos -->
										<button class="text-brand-text-muted hover:text-red-400"><Trash2 class="w-4 h-4" /></button>
										<button class="text-brand-text-muted hover:text-brand-accent"><MoreVertical class="w-4 h-4" /></button>
									</div>
								</div>
							{/each}
							{#if !boardItems[col.id]?.length}
								<div class="px-6 py-8 text-center text-sm font-medium text-brand-text-muted">
									No hay tareas en esta sección
								</div>
							{/if}
						</div>
						<div class="px-6 py-3 bg-brand-surface/30 border-t border-brand-divider">
							<button class="flex items-center gap-2 text-sm font-semibold text-brand-text-muted hover:text-brand-text transition-colors" onclick={openNewTask}>
								<Plus class="w-4 h-4" /> Añadir tarjeta
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if viewMode === 'calendario'}
		<!-- Calendar View -->
		<div class="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-6 bg-[#070b0e]">
			<div class="max-w-6xl mx-auto h-full flex flex-col">
				<!-- Cabecera Mes -->
				<div class="flex items-center justify-between mb-4 bg-[#0d1216] border border-brand-divider p-3 rounded-2xl shadow-sm">
					<h2 class="text-lg font-bold text-brand-text px-3 capitalize">
						{calendarCurrentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
					</h2>
					<div class="flex items-center gap-2">
						<button class="p-2 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted transition-colors" onclick={prevCalMonth}>
							<ChevronLeft class="w-5 h-5"/>
						</button>
						<button class="px-4 py-1.5 bg-brand-surface-elevated text-xs font-bold text-brand-accent rounded-lg border border-brand-divider" onclick={() => calendarCurrentMonth = new Date()}>
							Hoy
						</button>
						<button class="p-2 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted transition-colors" onclick={nextCalMonth}>
							<ChevronRight class="w-5 h-5"/>
						</button>
					</div>
				</div>

				<!-- Grid Calendario -->
				<div class="flex-1 bg-[#0d1216] border border-brand-divider rounded-2xl overflow-hidden flex flex-col shadow-lg">
					<!-- Cabecera Días -->
					<div class="grid grid-cols-7 border-b border-brand-divider bg-brand-surface">
						{#each ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as day}
							<div class="py-3 text-center text-xs font-bold text-brand-text-muted uppercase tracking-wider">{day}</div>
						{/each}
					</div>
					
					<!-- Celdas -->
					<div class="grid grid-cols-7 flex-1 auto-rows-fr">
						{#each boardCalendarDays as day, i}
							<div class="min-h-[120px] p-2 border-r border-b border-brand-divider/50 {i % 7 === 6 ? 'border-r-0' : ''} {i >= 35 ? 'border-b-0' : ''} {!day.currentMonth ? 'bg-[#070b0e] opacity-50' : 'bg-[#0d1216]' } relative group transition-colors hover:bg-brand-surface-elevated/30">
								<div class="flex justify-between items-start mb-2">
									<span class="w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold {day.isToday ? 'bg-brand-accent text-brand-bg shadow-[0_0_8px_var(--color-brand-accent-muted)]' : 'text-brand-text'}">
										{day.date.getDate()}
									</span>
									<!-- Botón añadir rápido -->
									<button class="w-6 h-6 rounded-md hover:bg-brand-surface-elevated text-brand-text-muted opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all" onclick={() => {
										// Configurar el modal para este día
										newTaskStartDate = new Date(day.date.getTime() - (day.date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
										showNewTask = true;
									}}>
										<Plus class="w-4 h-4"/>
									</button>
								</div>
								
								<!-- Tareas del día -->
								<div class="space-y-1.5 h-[80px] overflow-y-auto custom-scrollbar pr-1">
									{#each getTasksForCalendarDate(day.date) as task}
										<div class="px-2 py-1.5 rounded-md text-[10px] font-semibold flex items-center gap-1.5 truncate border cursor-pointer hover:brightness-110 transition-all {task.is_completed ? 'bg-brand-surface/50 border-brand-divider text-brand-text-muted line-through' : 'bg-brand-surface-elevated border-brand-accent/30 text-brand-text shadow-sm'}" title={task.title}>
											<div class="w-1.5 h-1.5 rounded-full shrink-0 {task.is_completed ? 'bg-brand-text-muted' : 'bg-brand-accent'}"></div>
											<span class="truncate">{task.title}</span>
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
	
	<footer class="shrink-0 h-14 md:h-10 border-t border-brand-divider bg-[#070b0e] px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-center md:justify-between text-[11px] font-medium relative z-10 gap-2 md:gap-0">
		<div class="flex items-center justify-center md:justify-start gap-4 md:gap-6">
			<span class="flex items-center gap-2 text-brand-text font-bold"><Kanban class="w-3.5 h-3.5 text-brand-text-muted" /> {tasks.length} tareas en este tablero</span>
			<span class="flex items-center gap-2 text-brand-accent font-bold"><span class="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_var(--color-brand-accent)]"></span> {tasks.filter(t => t.is_completed).length} completadas</span>
		</div>
	</footer>
</div>

<!-- Modals Block -->

<!-- Detalle de la Tarea Modal (Fullscreen-ish) -->
{#if showTaskUpdate}
	{@const selectedTask = tasks.find((t) => t.id === selectedTaskId) || {}}
	<!-- Overlay -->
	<div class="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4 sm:p-6 overflow-y-auto">
		<!-- Modal Container -->
		<div class="bg-[#070b0e] border border-brand-divider rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh]">
			
			<!-- Header -->
			<div class="flex flex-wrap items-center justify-between p-4 border-b border-brand-divider bg-[#0d1216] rounded-t-2xl gap-4">
				<!-- Breadcrumbs -->
				<div class="flex items-center gap-2 text-xs font-semibold text-brand-text-muted">
					<Kanban class="w-4 h-4" />
					<span>Tablero: {currentBoard ? currentBoard.title : 'Enfoque Semanal & Proyectos'}</span>
					<span class="px-2">/</span>
					<span class="px-2 py-0.5 rounded-full bg-brand-surface border border-brand-divider text-brand-text flex items-center gap-1">
						{boardLists.find(l => l.id === selectedTask.list_id)?.name || boardLists[0]?.name || 'Lista'}
					</span>
				</div>
				
				<!-- Right actions -->
				<div class="flex items-center gap-3">
					<div class="w-px h-5 bg-brand-divider mx-1"></div>
					<button
						class="p-1.5 rounded-lg text-brand-text-muted hover:text-brand-text hover:bg-brand-surface-elevated transition-colors"
						onclick={() => {
							closeListModals();
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
					<button class="mt-1 shrink-0 text-brand-text-muted hover:text-brand-accent transition-colors" onclick={() => toggleTask(selectedTask.id)}>
						{#if selectedTask.is_completed}
							<CheckCircle2 class="w-7 h-7 text-brand-accent fill-brand-accent/20" />
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
					<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-divider bg-brand-surface text-brand-text-muted hover:text-brand-text text-xs font-bold transition-colors" onclick={() => showTags = true}>
						<Tag class="w-3.5 h-3.5 text-brand-accent" /> Etiquetas <span class="w-1.5 h-1.5 rounded-full bg-brand-accent ml-1"></span>
					</button>
					
					{#if !editingNovedad}
						<button 
							class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition-colors"
							onclick={() => editingNovedad = ' '}
						>
							<AlertTriangle class="w-3.5 h-3.5" /> Novedad / Bloqueo
						</button>
					{:else}
						<button class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition-colors ml-auto">
							<span class="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_var(--color-amber-500)]"></span> <AlertTriangle class="w-3.5 h-3.5" /> Novedad Activa (Bloqueo)
						</button>
					{/if}
					
					{#if selectedTask.is_shared || selectedTask.is_shared_with_me}
						<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-accent/30 bg-brand-accent/10 text-brand-accent text-xs font-bold">
							<Share2 class="w-3.5 h-3.5" />
							{selectedTask.is_shared_with_me ? 'Compartida contigo' : 'Compartida'}
						</div>
					{/if}
					
					{#if selectedTask.parent_task_id}
						{@const parentTask = tasks.find(t => t.id === selectedTask.parent_task_id)}
						{#if parentTask}
							<button 
								class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-accent/30 bg-brand-surface-elevated text-brand-text hover:text-brand-accent hover:border-brand-accent/50 text-xs font-bold transition-colors"
								onclick={() => openTaskUpdate(parentTask)}
							>
								<ArrowLeft class="w-3.5 h-3.5 text-brand-text-muted" /> De: {parentTask.title}
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Body Layout -->
			<div class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
				
				<!-- Left Column (Main Content) -->
				<div class="lg:col-span-2 space-y-8">
					
					{#if editingNovedad}
						<!-- Mockup Alert Block (Novedad) -->
						<div class="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-5 flex items-start gap-4">
							<div class="w-10 h-10 rounded-full border border-amber-500/50 bg-amber-500/10 flex items-center justify-center shrink-0">
								<AlertTriangle class="w-5 h-5 text-amber-500" />
							</div>
							<div class="flex-1">
								<div class="flex items-start justify-between gap-4 mb-2">
									<div>
										<h4 class="text-sm font-bold text-amber-500 uppercase tracking-wide">TAREA BLOQUEADA / NOVEDAD EN ESPERA</h4>
										<p class="text-[10px] text-amber-500/70 mt-1">• Define el motivo del bloqueo abajo</p>
									</div>
									<button 
										class="px-4 py-2 rounded-lg bg-amber-500 text-brand-bg font-bold text-xs hover:brightness-110 transition-all shadow-[0_0_15px_var(--color-amber-500-muted)]"
										onclick={() => { editingNovedad = ''; saveNovedad(); }}
									>
										Resolver / Desmarcar
									</button>
								</div>
								<textarea 
									bind:value={editingNovedad}
									placeholder="Escribe la novedad o motivo de bloqueo..."
									class="w-full bg-[#070b0e] border border-amber-500/30 rounded-lg text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-amber-500 transition-colors resize-none p-3 mt-2 custom-scrollbar min-h-[80px]"
								></textarea>
							</div>
						</div>
					{/if}

					<!-- Descripción Rich Text Editor -->
					<div>
						<div class="flex items-center justify-between mb-4">
							<h4 class="text-base font-bold text-brand-text flex items-center gap-2"><AlignLeft class="w-5 h-5 text-brand-accent"/> Descripción</h4>
						</div>
						<RichTextEditor bind:value={editingDescription} />
					</div>

					<!-- Checklist & Subtareas -->
					<div>
						<div class="flex items-center justify-between mb-3">
							<h4 class="text-base font-bold text-brand-text flex items-center gap-2"><CheckCircle2 class="w-5 h-5 text-brand-accent"/> Checklist</h4>
							{#if taskLists.length > 0}
								{@const totalItems = taskLists.reduce((a, l) => a + (l.item_count ?? 0), 0)}
								{@const doneItems = taskLists.reduce((a, l) => a + (l.done_count ?? 0), 0)}
								<span class="text-xs font-bold text-brand-accent">{doneItems} de {totalItems} completadas ({totalItems > 0 ? Math.round(doneItems / totalItems * 100) : 0}%)</span>
							{/if}
						</div>

						{#if listsLoading}
							<div class="text-xs text-brand-text-muted py-4 text-center">Cargando...</div>
						{:else}
							<!-- Mostrar checklists existentes -->
							{#each taskLists as list}
								{@const pct = list.item_count ? Math.round((list.done_count ?? 0) / list.item_count * 100) : 0}
								<div class="mb-4">
									<div class="flex items-center justify-between mb-2">
										<button type="button" class="text-sm font-bold text-brand-text hover:text-brand-accent transition-colors" onclick={() => loadListItems(list)}>
											{list.name}
										</button>
										<span class="text-[10px] text-brand-text-muted">{list.done_count ?? 0}/{list.item_count ?? 0}</span>
									</div>
									<div class="h-1.5 w-full bg-brand-surface rounded-full overflow-hidden mb-3">
										<div class="h-full bg-brand-accent rounded-full shadow-[0_0_8px_var(--color-brand-accent)] transition-all" style="width:{pct}%"></div>
									</div>
									{#if selectedList?.id === list.id}
										{#if listDetailLoading}
											<div class="text-xs text-brand-text-muted py-2 text-center">Cargando ítems...</div>
										{:else}
											<div class="space-y-1 mb-3">
												{#each selectedListItems as item}
													<div class="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-brand-surface transition-colors">
														<button type="button" class="shrink-0" onclick={() => toggleListItem(item)}>
															{#if item.is_completed}
																<CheckSquare class="w-5 h-5 text-brand-accent" />
															{:else}
																<div class="w-5 h-5 rounded-md border-2 border-brand-text-muted group-hover:border-brand-accent transition-colors"></div>
															{/if}
														</button>
														<span class="flex-1 text-sm font-semibold {item.is_completed ? 'line-through text-brand-text-muted' : 'text-brand-text'}">{item.title}</span>
														<button type="button" class="opacity-0 group-hover:opacity-100 transition-opacity text-brand-text-muted hover:text-red-400" onclick={() => deleteListItem(item.id)}>
															<X class="w-3.5 h-3.5" />
														</button>
													</div>
												{/each}
											</div>
											<div class="flex gap-2">
												<input
													type="text"
													bind:value={newListItemTitle}
													placeholder="Nuevo ítem..."
													class="flex-1 bg-brand-surface border border-brand-divider rounded-lg px-3 py-2 text-xs text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
													onkeydown={(e) => e.key === 'Enter' && addItemToSelectedList()}
												/>
												<button type="button" class="px-3 py-2 bg-brand-accent text-brand-bg text-xs font-bold rounded-lg hover:brightness-105 transition-all" onclick={addItemToSelectedList}>
													<Plus class="w-3.5 h-3.5" />
												</button>
											</div>
										{/if}
									{/if}
								</div>
							{/each}

							<!-- Formulario Inline / Empty State -->
							{#if showNewChecklistForm}
								<div class="mt-3 rounded-xl border border-brand-accent/30 bg-brand-surface p-4">
									<p class="text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">Nueva Checklist</p>
									<div class="flex gap-2">
										<input
											type="text"
											bind:value={newChecklistName}
											placeholder="Nombre de la checklist..."
											class="flex-1 bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
											onkeydown={async (e) => {
												if (e.key === 'Enter') {
													if (!newChecklistName.trim() || selectedTaskId === null || !supabase) return;
													const { error } = await supabase.from('task_lists').insert({ task_id: selectedTaskId, name: newChecklistName.trim() });
													if (!error) { showNewChecklistForm = false; newChecklistName = ''; await loadTaskLists(selectedTaskId); }
												}
											}}
											autofocus
										/>
										<button
											type="button"
											class="px-3 py-2 bg-brand-accent text-brand-bg text-xs font-bold rounded-lg hover:brightness-105 transition-all"
											onclick={async () => {
												if (!newChecklistName.trim() || selectedTaskId === null || !supabase) return;
												const { error } = await supabase.from('task_lists').insert({ task_id: selectedTaskId, name: newChecklistName.trim() });
												if (!error) { showNewChecklistForm = false; newChecklistName = ''; await loadTaskLists(selectedTaskId); }
											}}
										>Crear</button>
										<button type="button" class="px-3 py-2 text-brand-text-muted hover:text-brand-text text-xs rounded-lg border border-brand-divider transition-colors" onclick={() => { showNewChecklistForm = false; newChecklistName = ''; }}>Cancelar</button>
									</div>
								</div>
							{:else if taskLists.length === 0}
								<div class="rounded-xl border border-dashed border-brand-divider p-6 text-center">
									<p class="text-sm text-brand-text-muted mb-3">No hay checklists todavía.</p>
									<button type="button" class="flex items-center gap-2 text-xs font-bold text-brand-accent hover:text-brand-accent/80 transition-colors mx-auto" onclick={() => { showNewChecklistForm = true; newChecklistName = ''; }}>
										<Plus class="w-4 h-4" /> Crear primer checklist
									</button>
								</div>
							{:else}
								<button type="button" class="mt-3 flex items-center gap-2 text-xs font-bold text-brand-accent hover:text-brand-accent/80 transition-colors" onclick={() => { showNewChecklistForm = true; newChecklistName = ''; }}>
									<Plus class="w-4 h-4" /> Añadir nueva checklist
								</button>
							{/if}
						{/if}
					</div>

					<!-- Subtareas -->
					<div class="mt-8">
						<div class="flex items-center justify-between mb-4">
							<h4 class="text-base font-bold text-brand-text flex items-center gap-2">
								<ListChecks class="w-5 h-5 text-brand-accent"/> Subtareas
							</h4>
							<span class="text-[10px] font-bold text-brand-text-muted bg-brand-surface-elevated px-2 py-0.5 rounded-full">
								{subtasks.length}
							</span>
						</div>
						
						{#if subtasks.length > 0}
							<div class="space-y-2 mb-4">
								{#each subtasks as subtask}
									<div class="group flex items-center gap-3 bg-[#0d1216] border border-brand-divider p-3 rounded-lg hover:border-brand-accent/50 transition-colors cursor-pointer" onclick={() => openTaskUpdate(subtask)}>
										<div class="w-4 h-4 rounded-full border {subtask.is_completed ? 'bg-brand-accent border-brand-accent' : 'border-brand-text-muted'} flex items-center justify-center shrink-0 transition-colors">
											{#if subtask.is_completed}
												<Check class="w-3 h-3 text-brand-bg" />
											{/if}
										</div>
										<span class="text-sm {subtask.is_completed ? 'line-through text-brand-text-muted' : 'text-brand-text'} truncate flex-1">{subtask.title}</span>
										<ChevronRight class="w-4 h-4 text-brand-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
									</div>
								{/each}
							</div>
						{/if}
						
						<div class="flex items-center gap-2">
							<input 
								type="text" 
								bind:value={subtaskTitle}
								placeholder="Añadir nueva subtarea..." 
								class="flex-1 bg-transparent text-sm text-brand-text placeholder-brand-text-muted focus:outline-none border-b border-brand-divider focus:border-brand-accent py-2 transition-colors"
								onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
							/>
							<button 
								type="button"
								onclick={addSubtask}
								disabled={!subtaskTitle.trim()}
								class="shrink-0 w-8 h-8 rounded-lg bg-brand-surface-elevated flex items-center justify-center text-brand-accent disabled:opacity-50 transition-colors border border-brand-divider cursor-pointer hover:border-brand-accent"
							>
								<Plus class="w-4 h-4" />
							</button>
						</div>
					</div>

					<!-- Actividad & Comentarios -->
					<div class="mt-8 pt-6 border-t border-brand-divider">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-sm font-bold text-brand-text flex items-center gap-2">
								<MessageSquare class="w-4 h-4 text-brand-accent" /> Actividad & Comentarios
							</h3>
							<span class="text-xs text-brand-text-muted">{taskComments.length} comentarios</span>
						</div>

						<div class="flex gap-3 mb-6">
							<div class="w-8 h-8 rounded-full bg-brand-accent/20 border border-brand-accent/30 text-brand-accent flex items-center justify-center font-bold text-xs shrink-0">
								TÚ
							</div>
							<div class="flex-1 bg-[#0d1216] border border-brand-divider rounded-xl overflow-hidden focus-within:border-brand-accent transition-colors relative">
								<textarea 
									bind:value={newCommentText}
									placeholder="Escribe un comentario..." 
									class="w-full bg-transparent text-sm text-brand-text placeholder-brand-text-muted focus:outline-none p-3 min-h-[80px] resize-none"
								></textarea>
								<div class="flex items-center justify-between px-3 pb-3">
									<div class="flex gap-2">
										<button class="text-brand-text-muted hover:text-brand-text transition-colors"><AtSign class="w-4 h-4" /></button>
										<button class="text-brand-text-muted hover:text-brand-text transition-colors"><Paperclip class="w-4 h-4" /></button>
									</div>
									<button 
										onclick={addTaskComment}
										disabled={!newCommentText.trim()}
										class="px-4 py-1.5 bg-brand-accent hover:bg-brand-accent/90 text-[#0d1216] text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
									>
										Comentar
									</button>
								</div>
							</div>
						</div>

						<div class="space-y-4">
							{#each taskComments as comment}
								<div class="flex gap-3">
									<div class="w-8 h-8 rounded-full bg-brand-surface-elevated border border-brand-divider text-brand-text-muted flex items-center justify-center font-bold text-xs shrink-0 uppercase">
										{comment.user?.raw_user_meta_data?.name?.slice(0, 2) || comment.user?.email?.slice(0, 2) || '??'}
									</div>
									<div class="flex-1 bg-[#0d1216] border border-brand-divider rounded-xl p-3">
										<div class="flex items-center justify-between mb-2">
											<div class="flex items-center gap-2 text-xs">
												<span class="font-bold text-brand-text">{comment.user?.raw_user_meta_data?.name || comment.user?.email || 'Usuario'}</span>
												<span class="text-brand-text-muted">• {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
											</div>
										</div>
										<p class="text-sm text-brand-text">{comment.content}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>

				</div>

				<!-- Right Column (Sidebar) -->
				<div class="space-y-6">
					
					<!-- Fechas & Horario -->
					<div class="rounded-xl border border-brand-divider bg-[#0d1216] p-5">
						<h4 class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2 mb-4"><Calendar class="w-4 h-4 text-brand-accent" /> Fechas & Horario</h4>
						<div class="space-y-3">
							<div>
								<label class="block text-[10px] font-semibold text-brand-text-muted mb-1.5">Fecha de Inicio</label>
								<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 cursor-pointer">
									<DateTimePicker bind:value={editingDate} placeholder="Seleccionar inicio..." />
									<Calendar class="w-3.5 h-3.5 text-brand-text-muted shrink-0 ml-2" />
								</div>
							</div>
							<div>
								<label class="block text-[10px] font-semibold text-brand-text-muted mb-1.5 flex justify-between">Fecha de Vencimiento</label>
								<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-lg px-3 py-2 cursor-pointer">
									<DateTimePicker bind:value={editingEndDate} placeholder="Seleccionar fin..." />
									<Calendar class="w-3.5 h-3.5 text-brand-text-muted shrink-0 ml-2" />
								</div>
							</div>
							<button class="flex items-center gap-2 text-[10px] font-bold text-brand-accent hover:underline mt-2">
								<AlertCircle class="w-3.5 h-3.5" /> Recordatorio: 15 min antes
							</button>
						</div>
					</div>

					<!-- Miembros -->
					<div class="rounded-xl border border-brand-divider bg-[#0d1216] p-5">
						<div class="flex items-center justify-between mb-2">
							<h4 class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2"><Users class="w-4 h-4 text-brand-accent" /> Miembros</h4>
						</div>
						
						{#if contacts && contacts.length > 0}
							<!-- Mostrar miembros actuales asignados -->
							<div class="space-y-2 mb-3">
								{#each contacts.filter(c => sharedWithIds.has(c.id)) as contact (contact.id)}
									<div class="flex items-center justify-between bg-[#070b0e] border border-brand-divider rounded-lg p-2 px-3">
										<div class="flex items-center gap-2">
											<div class="w-6 h-6 rounded-full bg-brand-accent/20 text-brand-accent font-bold text-[10px] flex items-center justify-center uppercase">{contact.nickname ? contact.nickname.substring(0, 2) : contact.display_name.substring(0, 2)}</div>
											<span class="text-xs font-bold text-brand-text truncate">{contactLabel(contact)}</span>
										</div>
										<button class="text-brand-text-muted hover:text-red-400 transition-colors" onclick={() => toggleShareWithContact(contact.id)} disabled={shareBusyId === contact.id}><X class="w-4 h-4"/></button>
									</div>
								{/each}
								{#if Array.from(sharedWithIds).length === 0}
									<p class="text-[10px] text-brand-text-muted italic">Sin miembros asignados</p>
								{/if}
							</div>

							<!-- Acordeón para añadir más -->
							<details class="group">
								<summary class="flex items-center justify-between cursor-pointer list-none text-[10px] font-bold text-brand-accent hover:underline outline-none">
									<span>+ Añadir miembros</span>
									<ChevronDown class="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
								</summary>
								<div class="space-y-2 max-h-40 overflow-y-auto custom-scrollbar mt-3 border-t border-brand-divider pt-3">
									{#each contacts.filter(c => !sharedWithIds.has(c.id)) as contact (contact.id)}
										<button
											type="button"
											class="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors border-brand-divider bg-[#070b0e] hover:border-brand-accent/50"
											disabled={shareBusyId === contact.id}
											onclick={() => toggleShareWithContact(contact.id)}
										>
											<div class="flex items-center gap-2 min-w-0">
												<div class="w-6 h-6 rounded-full bg-brand-surface-elevated text-brand-text-muted font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
													{contact.nickname ? contact.nickname.substring(0, 2) : contact.display_name.substring(0, 2)}
												</div>
												<span class="text-xs font-bold text-brand-text truncate">{contactLabel(contact)}</span>
											</div>
											<span class="text-[9px] font-bold shrink-0 text-brand-text-muted hover:text-brand-accent">
												{shareBusyId === contact.id ? '...' : '+ Añadir'}
											</span>
										</button>
									{/each}
									{#if contacts.filter(c => !sharedWithIds.has(c.id)).length === 0}
										<p class="text-[10px] text-brand-text-muted text-center py-2">Todos tus contactos ya están añadidos.</p>
									{/if}
								</div>
							</details>
						{:else}
							<p class="text-[10px] text-brand-text-muted text-center py-2">No tienes contactos disponibles.</p>
						{/if}
					</div>

					<!-- Etiquetas -->
					<div class="rounded-xl border border-brand-divider bg-[#0d1216] p-5">
						<div class="flex items-center justify-between mb-4">
							<h4 class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2"><Tag class="w-4 h-4 text-brand-accent" /> Etiquetas</h4>
						</div>
						<TagSelect {tags} bind:value={editingTagId} id="edit-task-tag" />
					</div>

					<!-- Vinculaciones -->
					<div class="rounded-xl border border-brand-divider bg-[#0d1216] p-5">
						<h4 class="text-xs font-bold text-brand-text-muted uppercase tracking-wider flex items-center gap-2 mb-4"><Activity class="w-4 h-4 text-brand-accent" /> Vinculaciones Fokuz</h4>
						<button 
							class="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-brand-accent/50 text-brand-accent hover:bg-brand-accent/10 transition-colors text-[11px] font-bold"
							onclick={focusOnSelectedTask}
						>
							<Clock class="w-3.5 h-3.5" /> Enfocar con Pomodoro
						</button>
					</div>

				</div>

			</div>

			<!-- Footer -->
			<div class="p-4 border-t border-brand-divider bg-[#070b0e] rounded-b-2xl flex flex-col sm:flex-row sm:items-center justify-between mt-auto gap-4">
				<button 
					class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-xs font-bold w-full sm:w-auto"
					onclick={deleteTask}
				>
					<Trash2 class="w-4 h-4" /> Eliminar tarea
				</button>
				
				<!-- Success/Error Messages injected in footer -->
				<div class="flex-1 flex justify-center">
					{#if taskActionError}
						<p class="text-sm text-red-400 font-bold">{taskActionError}</p>
					{/if}
					{#if taskActionSuccess}
						<div class="rounded-full bg-brand-accent/20 border border-brand-accent/30 text-brand-accent text-xs font-bold px-3 py-1.5">
							{taskActionSuccess}
						</div>
					{/if}
				</div>

				<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
					<button 
						class="px-5 py-2.5 rounded-lg border border-brand-divider bg-[#0d1216] text-brand-text-muted hover:text-brand-text transition-colors text-xs font-bold w-full sm:w-auto flex justify-center items-center"
						onclick={() => showTaskUpdate = false}
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
{/if}
{#if showNewTask}
	<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-lg p-6 shadow-2xl">
			<div class="flex justify-between items-center mb-6">
				<h3 class="text-lg font-bold text-brand-text">Nueva Tarjeta</h3>
				<button class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted" onclick={() => showNewTask = false}><X class="w-5 h-5"/></button>
			</div>
			
			<div class="space-y-4 mb-6">
				<div>
					<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Título</label>
					<input 
						type="text" 
						bind:value={newTaskTitle} 
						placeholder="¿Qué necesitas hacer?" 
						class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-brand-text placeholder-brand-text-muted focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
						onkeydown={(e) => e.key === 'Enter' && addTask()}
					/>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Fecha de Inicio</label>
						<div class="flex items-center justify-between bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 cursor-pointer focus-within:border-brand-accent focus-within:ring-1 focus-within:ring-brand-accent transition-all">
							<DateTimePicker bind:value={newTaskStartDate} placeholder="dd/mm/aaaa" />
							<Calendar class="w-4 h-4 text-brand-text-muted shrink-0 ml-2" />
						</div>
					</div>
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Fecha de Fin (Opcional)</label>
						<div class="flex items-center justify-between bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-2 cursor-pointer focus-within:border-brand-accent focus-within:ring-1 focus-within:ring-brand-accent transition-all">
							<DateTimePicker bind:value={newTaskEndDate} placeholder="dd/mm/aaaa" />
							<Calendar class="w-4 h-4 text-brand-text-muted shrink-0 ml-2" />
						</div>
					</div>
				</div>
				
				{#if contacts && contacts.length > 0}
					<div>
						<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Compartir con Miembros</label>
						<div class="flex flex-wrap gap-2">
							{#each contacts as contact}
								<button 
									class="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 {newTaskSharedWith.includes(contact.id) ? 'bg-brand-accent/10 border-brand-accent text-brand-accent' : 'bg-[#0d1216] border-brand-divider text-brand-text-muted hover:bg-brand-surface-elevated'}"
									onclick={() => {
										if (newTaskSharedWith.includes(contact.id)) newTaskSharedWith = newTaskSharedWith.filter(id => id !== contact.id);
										else newTaskSharedWith = [...newTaskSharedWith, contact.id];
									}}
								>
									<div class="w-4 h-4 rounded-full bg-brand-surface-elevated flex items-center justify-center text-[8px] uppercase font-black text-brand-text">
										{contact.nickname ? contact.nickname.substring(0, 2) : contact.display_name.substring(0, 2)}
									</div>
									{contact.nickname || contact.display_name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if tags.length > 0}
					<div>
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
			</div>

			<div class="flex flex-col sm:flex-row justify-end gap-3 w-full sm:w-auto">
				<button class="w-full sm:w-auto flex justify-center items-center px-4 py-2 rounded-xl text-brand-text font-bold hover:bg-brand-surface-elevated transition-colors" onclick={() => showNewTask = false}>Cancelar</button>
				<button class="w-full sm:w-auto flex justify-center items-center px-5 py-2 bg-brand-accent text-brand-bg font-bold rounded-xl hover:brightness-105 transition-colors gap-2 shadow-[0_0_10px_var(--color-brand-accent-muted)]" onclick={addTask}>
					<Plus class="w-4 h-4"/> Crear
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showTags}
	<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[80vh]">
			<div class="flex justify-between items-center mb-6 shrink-0">
				<h3 class="text-lg font-bold text-brand-text">Gestionar Etiquetas</h3>
				<button class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted" onclick={() => showTags = false}><X class="w-5 h-5"/></button>
			</div>
			
			<div class="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 mb-6">
				{#each tags as tag (tag.id)}
					{#if tagToEdit === tag.id}
						<div class="flex flex-col gap-3 p-3 rounded-xl bg-[#0d1216] border border-brand-accent shadow-[0_0_10px_var(--color-brand-accent-muted)]">
							<input 
								type="text" 
								bind:value={editTagName} 
								placeholder="Nombre..." 
								class="w-full bg-brand-surface border border-brand-divider rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
								onkeydown={(e) => e.key === 'Enter' && saveTagEdit()}
							/>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div class="flex gap-1.5 items-center bg-brand-surface border border-brand-divider rounded-lg px-2 py-1.5">
									{#each TAG_COLORS as color}
										<button 
											class="w-4 h-4 rounded-full transition-transform {editTagColor === color ? 'scale-125 ring-2 ring-brand-text ring-offset-1 ring-offset-brand-surface' : 'hover:scale-110'}" 
											style="background-color: {color}"
											onclick={() => editTagColor = color}
										></button>
									{/each}
								</div>
								<div class="flex gap-2">
									<button class="px-3 py-1.5 bg-brand-surface text-brand-text-muted hover:text-brand-text font-bold rounded-lg text-xs border border-brand-divider transition-colors" onclick={() => tagToEdit = null}>Cancelar</button>
									<button class="px-3 py-1.5 bg-brand-accent text-brand-bg font-bold rounded-lg text-xs hover:brightness-105 transition-colors" onclick={saveTagEdit}>Guardar</button>
								</div>
							</div>
						</div>
					{:else}
						<div class="flex items-center justify-between p-3 rounded-xl bg-[#0d1216] border border-brand-divider group">
							<div class="flex items-center gap-3">
								<span class="w-3 h-3 rounded-full" style="background-color: {tag.color}"></span>
								<span class="text-sm font-semibold text-brand-text">{tag.name}</span>
							</div>
							<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button class="text-brand-text-muted hover:text-brand-text p-1.5 rounded-md hover:bg-brand-surface-elevated" onclick={() => { tagToEdit = tag.id; editTagName = tag.name; editTagColor = tag.color; }}>
									<Edit2 class="w-4 h-4" />
								</button>
								<button class="text-brand-text-muted hover:text-red-400 p-1.5 rounded-md hover:bg-brand-surface-elevated" onclick={() => tagToDelete = tag.id}>
									<Trash2 class="w-4 h-4" />
								</button>
							</div>
						</div>
					{/if}
				{:else}
					<div class="text-center py-6 text-brand-text-muted text-sm">
						No hay etiquetas creadas.
					</div>
				{/each}
			</div>

			<div class="shrink-0 pt-4 border-t border-brand-divider">
				<h4 class="text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-3">Crear nueva etiqueta</h4>
				<div class="flex flex-col gap-3">
					<input 
						type="text" 
						bind:value={newTagName} 
						placeholder="Nombre..." 
						class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
						onkeydown={(e) => e.key === 'Enter' && addTag()}
					/>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div class="flex gap-1.5 items-center bg-[#0d1216] border border-brand-divider rounded-xl px-2 py-1.5">
							{#each TAG_COLORS as color}
								<button 
									class="w-4 h-4 rounded-full transition-transform {newTagColor === color ? 'scale-125 ring-2 ring-brand-text ring-offset-1 ring-offset-[#0d1216]' : 'hover:scale-110'}" 
									style="background-color: {color}"
									onclick={() => newTagColor = color}
								></button>
							{/each}
						</div>
						<button class="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-brand-accent text-brand-bg hover:brightness-105 font-bold rounded-xl transition-colors" onclick={addTag}>
							<Plus class="w-4 h-4" /> Crear
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if tagToDelete}
	<div class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar etiqueta?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Las tareas que tenían esta etiqueta quedarán sin etiqueta. Esta acción no se puede deshacer.</p>
			<div class="flex justify-center gap-3 w-full">
				<button class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" onclick={() => tagToDelete = null}>Cancelar</button>
				<button class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]" onclick={() => { if(tagToDelete !== null) deleteTag(tagToDelete); }}>Eliminar</button>
			</div>
		</div>
	</div>
{/if}

{#if showCrearListaModal}
	<div class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col">
			<div class="flex justify-between items-center mb-6">
				<h3 class="text-lg font-bold text-brand-text">Crear nueva lista</h3>
				<button class="p-1.5 hover:bg-brand-surface-elevated rounded-lg text-brand-text-muted" onclick={() => { showCrearListaModal = false; newListName = ''; }}><X class="w-5 h-5"/></button>
			</div>
			
			<div class="space-y-4 mb-6">
				<div>
					<label class="block text-[10px] font-bold text-brand-text-muted uppercase tracking-wider mb-2">Nombre de la lista</label>
					<input 
						type="text" 
						bind:value={newListName} 
						placeholder="Ej. En Progreso, Revisión..." 
						class="w-full bg-[#0d1216] border border-brand-divider rounded-xl px-4 py-3 text-sm text-brand-text placeholder-brand-text-muted focus:border-brand-accent focus:ring-1 focus:ring-brand-accent outline-none"
						onkeydown={(e) => e.key === 'Enter' && confirmAddList()}
						autofocus
					/>
				</div>
			</div>

			<div class="flex justify-end gap-3">
				<button class="px-4 py-2 rounded-xl text-brand-text font-bold hover:bg-brand-surface-elevated transition-colors" onclick={() => { showCrearListaModal = false; newListName = ''; }}>Cancelar</button>
				<button class="px-5 py-2 bg-brand-accent text-brand-bg font-bold rounded-xl hover:brightness-105 transition-colors flex items-center gap-2 shadow-[0_0_10px_var(--color-brand-accent-muted)]" onclick={confirmAddList}>
					<Plus class="w-4 h-4"/> Crear
				</button>
			</div>
		</div>
	</div>
{/if}

{#if listToDelete}
	<div class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar esta lista?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Todas las tareas dentro de esta lista también serán eliminadas. Esta acción no se puede deshacer.</p>
			<div class="flex justify-center gap-3 w-full">
				<button class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" onclick={() => listToDelete = null}>Cancelar</button>
				<button class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]" onclick={() => { if(listToDelete !== null) confirmDeleteList(listToDelete); }}>Eliminar</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Confirmar Eliminación de Tarea -->
{#if showDeleteTaskConfirm}
	<div class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
		<div class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center">
			<div class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4">
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">¿Eliminar Tarea?</h3>
			<p class="text-sm text-brand-text-muted mb-6">Esta tarea será eliminada permanentemente y no podrá recuperarse.</p>
			<div class="flex justify-center gap-3 w-full">
				<button 
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors" 
					onclick={() => showDeleteTaskConfirm = false}>
					Cancelar
				</button>
				<button 
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]" 
					onclick={confirmDeleteTask}>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}
