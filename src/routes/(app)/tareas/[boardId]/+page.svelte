<script lang="ts">
	import LinkNoteModal from "$lib/components/tareas/LinkNoteModal.svelte";
	import AddColumnModal from "$lib/components/tareas/AddColumnModal.svelte";
	import TagsModal from "$lib/components/tareas/TagsModal.svelte";
	import NewTaskModal from "$lib/components/tareas/NewTaskModal.svelte";
	import TaskDetailModal from "$lib/components/tareas/TaskDetailModal.svelte";
	import CalendarView from "$lib/components/tareas/CalendarView.svelte";
	import ListView from "$lib/components/tareas/ListView.svelte";
	import KanbanView from "$lib/components/tareas/KanbanView.svelte";
	import BoardToolbar from "$lib/components/tareas/BoardToolbar.svelte";
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
		Settings,
		Filter,
		Timer,
		CheckSquare,
		Paperclip,
		MessageSquare,
		Flame,
		ChevronDown,
		Kanban,
		LayoutList,
		Zap,
		ChevronLeft,
		ChevronRight,
		Edit2,
		Clock,
		Users,
		ThumbsUp,
		Lock,
		AlignLeft,
		Activity,
		Check,
		AlertCircle,
		AtSign,
	} from "@lucide/svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { untrack } from "svelte";
	import { supabase } from "$lib/supabaseClient";
	import { dndzone } from "svelte-dnd-action";
	import logo from "$lib/assets/Logo_Fokuz.png";
	import TagSelect from "$lib/components/TagSelect.svelte";
	import Toast from "$lib/components/Toast.svelte";
	import DateTimePicker from "$lib/components/DateTimePicker.svelte";
	import RichTextEditor from "$lib/components/RichTextEditor.svelte";
	import { linkPomodoroTask, pomodoroUI } from "$lib/pomodoro.svelte";
	import {
		composeDateTime,
		splitEndFields,
		hasDeadline,
		defaultEndTime,
		findOverlappingTasks,
		localDayString,
		overlapMessage,
		splitDateTime,
		START_TIME_SQL_HINT,
		taskRangeLabel,
	} from "$lib/taskTime";
	import {
		buildCalendarDays,
		formatLocalDate,
		getDeadlineStyles,
		tasksOnDate,
	} from "$lib/boardUtils";

	import type { Contact, TaskTag } from "$lib/components/tareas/types";

	// Estado de la aplicación usando las Runes de Svelte 5
	let tasks = $state<any[]>([]);
	let tags = $state<TaskTag[]>([]);
	let contacts = $state<Contact[]>([]);
	let tasksLoading = $state(false);
	let boardId = $derived(page.params.boardId);
	let currentBoard = $state<any>(null);
	let allBoards = $state<any[]>([]);
	let showBoardDropdown = $state(false);
	let viewMode = $state("kanban");
	let boardLists = $state<any[]>([]);
	let calendarCurrentMonth = $state(new Date());
	// Grilla del mes y tareas por día: lógica pura en $lib/boardUtils (con pruebas)
	let boardCalendarDays = $derived(buildCalendarDays(calendarCurrentMonth));
	const getTasksForCalendarDate = (d: Date) => tasksOnDate(tasks, d);

	function nextCalMonth() {
		calendarCurrentMonth = new Date(
			calendarCurrentMonth.getFullYear(),
			calendarCurrentMonth.getMonth() + 1,
			1,
		);
	}
	function prevCalMonth() {
		calendarCurrentMonth = new Date(
			calendarCurrentMonth.getFullYear(),
			calendarCurrentMonth.getMonth() - 1,
			1,
		);
	}

	$effect(() => {
		if (boardId) loadBoard(boardId);
	});

	async function loadBoard(id: string) {
		const { data } = await supabase!
			.from("boards")
			.select("*")
			.eq("id", id)
			.single();
		currentBoard = data;
		const { data: boardsData } = await supabase!
			.from("boards")
			.select("*")
			.order("created_at", { ascending: true });
		allBoards = boardsData || [];
	}
	let tasksRefreshing = $state(false);
	let tasksFetchId = 0;
	let loadedDateStr = $state<string | null>(null);

	// Inicializar la fecha a las 00:00:00 sin mutaciones externas para evitar warnings en Svelte 5
	const initDate = new Date();
	initDate.setHours(0, 0, 0, 0);
	let selectedDate = $state(initDate);

	let showNewTask = $state(false);
	let showTaskUpdate = $state(false);
	let showDeleteTaskConfirm = $state(false);
	let showTaskOptions = $state(false);
	let showCalendar = $state(false);
	let calendarMode = $state<"navigate" | "moveTask">("navigate");
	let showTags = $state(false);
	let showFilter = $state(false);
	let filterTagIds = $state<number[]>([]);
	let filterSharedWithIds = $state<string[]>([]);
	let filterSharedOnly = $state(false);
	let filterHasLists = $state(false);
	let filterHasNovedad = $state(false);
	let filterStatus = $state<"all" | "pending" | "completed">("all");
	let showCrearListaModal = $state(false);
	let newTaskTitle = $state("");
	let newTaskStartDate = $state(composeDateTime(localDayString()));
	let newTaskEndDate = $state("");
	let newTaskSharedWith = $state<string[]>([]);
	let selectedTagId = $state<number | null>(null);
	let newTagName = $state("");
	let newTagColor = $state("#feef4c");
	let tagToDelete = $state<number | null>(null);
	let tagToEdit = $state<number | null>(null);
	let editTagName = $state("");
	let editTagColor = $state("");
	let openListMenuId = $state<number | null>(null);
	let listToEdit = $state<number | null>(null);
	let editListTitle = $state("");
	let listToDelete = $state<number | null>(null);

	const TAG_COLORS = [
		"#feef4c",
		"#7dd3fc",
		"#f9a8d4",
		"#86efac",
		"#fdba74",
		"#c4b5fd",
	];

	// Estado para editar la tarea
	let selectedTaskId = $state<number | null>(null);
	let selectedTaskTitle = $state("");
	let subtaskTitle = $state("");
	let selectedTaskLinkedNoteId = $state<string | null>(null);
	let selectedTaskLinkedNoteTitle = $state<string | null>(null);

	// Estado para modal de vincular nota
	let showLinkNoteModal = $state(false);
	let linkableFolders = $state<any[]>([]);
	let linkableNotes = $state<any[]>([]);
	let linkNotesLoading = $state(false);
	let linkModalSearchQuery = $state("");

	let subtasks = $derived(
		tasks.filter((t) => t.parent_task_id === selectedTaskId),
	);
	let editingNovedad = $state("");
	let editingDescription = $state("");
	let editingDate = $state("");
	let editingEndDate = $state("");
	let editingTagId = $state<number | null>(null);
	let newListName = $state("");
	let sharedWithIds = $state(new Set<string>());
	let shareBusyId = $state<string | null>(null);
	let taskActionError = $state("");
	let taskActionSuccess = $state("");
	let showTaskCreatedToast = $state(false);

	const contactLabel = (contact: Contact) =>
		(contact.nickname || "").trim() || contact.display_name;

	// Variables para el calendario custom
	let calMonth = $state(initDate.getMonth());
	let calYear = $state(initDate.getFullYear());
	let daysWithActiveTasks = $state(new Set<string>());

	const monthNames = [
		"Enero",
		"Febrero",
		"Marzo",
		"Abril",
		"Mayo",
		"Junio",
		"Julio",
		"Agosto",
		"Septiembre",
		"Octubre",
		"Noviembre",
		"Diciembre",
	];

	let calendarDays = $derived.by(() => {
		let days = [];
		const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
		const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0 = Sunday
		for (let i = 0; i < firstDay; i++) days.push(null);
		for (let i = 1; i <= totalDays; i++) days.push(i);
		return days;
	});

	const prevMonth = () => {
		if (calMonth === 0) {
			calMonth = 11;
			calYear--;
		} else calMonth--;
	};

	const nextMonth = () => {
		if (calMonth === 11) {
			calMonth = 0;
			calYear++;
		} else calMonth++;
	};

	const closeCalendar = () => {
		showCalendar = false;
		calendarMode = "navigate";
	};

	const openMoveTaskCalendar = () => {
		if (selectedTaskId === null) return;
		showTaskOptions = false;
		calendarMode = "moveTask";
		const task = tasks.find((t) => t.id === selectedTaskId);
		const dateStr =
			typeof task?.date === "string"
				? task.date
				: formatDateString(selectedDate);
		const [y, m, d] = dateStr.split("-").map(Number);
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

		const { error } = await supabase
			.from("tasks")
			.update({ date: dateStr })
			.eq("id", taskId);

		if (error) {
			tasks = previous;
			taskActionError = error.message;
		}
	};

	const selectCalendarDate = async (day: number) => {
		const d = new Date(calYear, calMonth, day);
		d.setHours(0, 0, 0, 0);

		if (calendarMode === "moveTask") {
			await moveTaskToDate(d);
			return;
		}

		selectedDate = d;
		closeCalendar();
	};

	const formatDayKey = (year: number, month: number, day: number) => {
		const m = String(month + 1).padStart(2, "0");
		const d = String(day).padStart(2, "0");
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
			.from("tasks")
			.select("date")
			.eq("is_completed", false)
			.gte("date", start)
			.lte("date", end);

		if (error) {
			console.warn(
				"Error al cargar días con tareas activas:",
				error.message,
			);
			return;
		}

		daysWithActiveTasks = new Set((data ?? []).map((t) => t.date));
	};

	// Sincronizar el calendario con la fecha seleccionada al abrir (solo navegación)
	$effect(() => {
		if (showCalendar && calendarMode === "navigate") {
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
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	const fetchTags = async () => {
		if (!supabase) {
			tags = [];
			return;
		}

		const { data, error } = await supabase
			.from("tags")
			.select("id, name, color")
			.eq("board_id", Number(boardId))
			.order("name", { ascending: true });

		if (error) {
			console.warn("Error al cargar etiquetas:", error.message);
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
			.from("contacts")
			.select("id, nickname, contact_user_id")
			.order("created_at", { ascending: false });

		if (rowsResult.error && /nickname/i.test(rowsResult.error.message)) {
			rowsResult = (await supabase
				.from("contacts")
				.select("id, contact_user_id")
				.order("created_at", { ascending: false })) as any;
		}

		if (rowsResult.error) {
			console.warn(
				"Error al cargar contactos:",
				rowsResult.error.message,
			);
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
			.from("profiles")
			.select("id, email, display_name")
			.in("id", ids);

		const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
		contacts = rows.map((row) => {
			const profile = profileMap.get(row.contact_user_id);
			return {
				id: row.contact_user_id,
				email: profile?.email ?? "Contacto",
				nickname: ((row as any).nickname || "").trim(),
				display_name:
					(profile?.display_name || "").trim() ||
					(profile?.email ? profile.email.split("@")[0] : "Contacto"),
			};
		});
	};

	const normalizeSharedTasks = (sharedData: unknown): any[] => {
		if (Array.isArray(sharedData)) return sharedData;
		if (typeof sharedData === "string") {
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
			data: { session },
		} = await supabase.auth.getSession();
		const me = session?.user?.id;
		if (!me) return [];

		const { data: shares, error: sharesError } = await supabase
			.from("task_shares")
			.select("task_id")
			.eq("shared_with", me);

		if (sharesError) {
			console.warn("Error al cargar shares:", sharesError.message);
			return [];
		}

		const ids = [...new Set((shares ?? []).map((row) => row.task_id))];
		if (ids.length === 0) return [];

		const { data, error } = await supabase
			.from("tasks")
			.select("*, tags(id, name, color)")
			.in("id", ids)
			.eq("board_id", Number(boardId))
			.order("order_index", { ascending: true });

		if (error) {
			console.warn(
				"Error al cargar tareas compartidas (fallback):",
				error.message,
			);
			return [];
		}

		return data ?? [];
	};

	let boardListsError = $state("");

	const fetchBoardLists = async () => {
		if (!supabase) return;
		const { data, error } = await supabase
			.from("board_lists")
			.select("*")
			.eq("board_id", Number(boardId))
			.order("order_index", { ascending: true });
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
				console.warn(
					"Supabase no está configurado. Las tareas no se pueden cargar.",
				);
				if (requestId === tasksFetchId) {
					tasks = [];
					loadedDateStr = dateStr;
				}
				return;
			}

			const [ownResult, sharedResult] = await Promise.all([
				supabase
					.from("tasks")
					.select("*, tags(id, name, color)")
					.eq("board_id", Number(boardId))
					.order("order_index", { ascending: true }),
				/* supabase.rpc('get_shared_tasks_for_date', { target_date: dateStr }) */ {
					data: [],
					error: null,
				},
			]);

			if (requestId !== tasksFetchId) return;

			if (ownResult.error)
				alert("Error al cargar: " + ownResult.error.message);

			let merged = ownResult.data ?? [];

			let sharedList = normalizeSharedTasks(sharedResult.data);
			if (sharedResult.error) {
				console.warn(
					"Error al cargar tareas compartidas:",
					(sharedResult.error as any).message,
				);
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
					merged = [
						...merged,
						{ ...shared, is_shared: true, is_shared_with_me: true },
					];
					existingIds.add(shared.id);
				} else {
					merged = merged.map((t) =>
						t.id === shared.id
							? { ...t, is_shared: true, is_shared_with_me: true }
							: t,
					);
				}
			}

			// Marcar tareas compartidas y resolver "Compartida con: alias"
			const taskIds = merged.map((t) => t.id);
			const taskIdsWithLists = new Set<number>();
			if (taskIds.length > 0) {
				const [{ data: shareRows }, { data: listRows }] =
					await Promise.all([
						supabase
							.from("task_shares")
							.select("task_id, shared_with")
							.in("task_id", taskIds),
						supabase
							.from("task_lists")
							.select("task_id")
							.in("task_id", taskIds),
					]);

				if (requestId !== tasksFetchId) return;

				for (const row of listRows ?? []) {
					taskIdsWithLists.add(row.task_id);
				}

				const rows = shareRows ?? [];
				const sharedOutIds = new Set(rows.map((row) => row.task_id));
				const sharedUserIds = [
					...new Set(rows.map((row) => row.shared_with)),
				];

				const nameByUserId = new Map<string, string>();
				for (const contact of contacts) {
					nameByUserId.set(contact.id, contactLabel(contact));
				}

				const missingIds = sharedUserIds.filter(
					(id) => !nameByUserId.has(id),
				);
				if (missingIds.length > 0) {
					const { data: profiles } = await supabase
						.from("profiles")
						.select("id, email, display_name")
						.in("id", missingIds);

					if (requestId !== tasksFetchId) return;

					for (const profile of profiles ?? []) {
						nameByUserId.set(
							profile.id,
							(profile.display_name || "").trim() ||
								profile.email.split("@")[0],
						);
					}
				}

				const labelsByTask = new Map<number, string[]>();
				const idsByTask = new Map<number, string[]>();
				for (const row of rows) {
					const labels = labelsByTask.get(row.task_id) ?? [];
					labels.push(
						nameByUserId.get(row.shared_with) || "contacto",
					);
					labelsByTask.set(row.task_id, labels);

					const ids = idsByTask.get(row.task_id) ?? [];
					ids.push(row.shared_with);
					idsByTask.set(row.task_id, ids);
				}

				merged = merged.map((t) => {
					const labels = labelsByTask.get(t.id) ?? [];
					const sharedIds = idsByTask.get(t.id) ?? [];
					const isShared =
						Boolean(t.is_shared) ||
						receivedSharedIds.has(t.id) ||
						sharedOutIds.has(t.id);
					return {
						...t,
						is_shared: isShared,
						shared_with_labels: labels,
						shared_with_ids: sharedIds,
						has_lists: taskIdsWithLists.has(t.id),
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
		tasks = tasks.map((t) =>
			t.id === taskId ? { ...t, has_lists: hasLists } : t,
		);
	};

	const getTaskTag = (task: any): TaskTag | null => {
		if (task?.tags && !Array.isArray(task.tags)) return task.tags;
		if (task?.tag_id) return tags.find((t) => t.id === task.tag_id) ?? null;
		return null;
	};

	const sharedWithText = (task: any) => {
		if (task?.is_shared_with_me) return "Compartida contigo";
		const labels = (task?.shared_with_labels ?? []) as string[];
		if (labels.length === 0) return task?.is_shared ? "Compartida" : "";
		if (labels.length === 1) return `Compartida con: ${labels[0]}`;
		if (labels.length === 2)
			return `Compartida con: ${labels[0]} y ${labels[1]}`;
		return `Compartida con: ${labels[0]} y ${labels.length - 1} más`;
	};

	const refreshTaskShareLabels = (taskId: number, sharedIds: Set<string>) => {
		const ids = [...sharedIds];
		const labels = ids.map((id) => {
			const contact = contacts.find((c) => c.id === id);
			return contact ? contactLabel(contact) : "contacto";
		});
		tasks = tasks.map((t) =>
			t.id === taskId
				? {
						...t,
						is_shared:
							labels.length > 0 || Boolean(t.is_shared_with_me),
						shared_with_labels: labels,
						shared_with_ids: ids,
					}
				: t,
		);
	};

	const addTag = async () => {
		const name = newTagName.trim();
		if (!name) return;

		if (!supabase) {
			alert("Supabase no está configurado.");
			return;
		}

		const { data, error } = await supabase
			.from("tags")
			.insert([{ name, color: newTagColor, board_id: Number(boardId) }])
			.select("id, name, color")
			.single();

		if (error) {
			alert("Error al crear etiqueta: " + error.message);
			return;
		}

		if (data)
			tags = [...tags, data].sort((a, b) => a.name.localeCompare(b.name));
		newTagName = "";
		newTagColor = "#feef4c";
	};

	const saveTagEdit = async () => {
		if (!tagToEdit) return;
		const name = editTagName.trim();
		if (!name) return;

		if (supabase) {
			const { error } = await supabase
				.from("tags")
				.update({ name, color: editTagColor })
				.eq("id", tagToEdit);
			if (error) {
				alert("Error al actualizar etiqueta: " + error.message);
				return;
			}
		}

		tags = tags.map((t) =>
			t.id === tagToEdit ? { ...t, name, color: editTagColor } : t,
		);
		tagToEdit = null;
	};

	const deleteTag = async (tagId: number) => {
		if (supabase) {
			const { error } = await supabase
				.from("tags")
				.delete()
				.eq("id", tagId);
			if (error) {
				alert("Error al eliminar etiqueta: " + error.message);
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
				.from("tasks")
				.update({ is_completed: task.is_completed })
				.eq("id", id);
			if (error) {
				task.is_completed = previous;
				alert("Error al actualizar: " + error.message);
				return;
			}
		}

		if (showCalendar) await fetchActiveTaskDays();
	};

	const openNewTask = () => {
		newTaskTitle = "";
		selectedTagId = null;
		showNewTask = true;
	};

	async function getTimedTasksForDay(day: string) {
		if (!supabase) return [];
		const { data } = await supabase
			.from("tasks")
			.select("id, title, date, end_date, start_time, end_time, is_completed");
		return (data ?? []).filter(
			(task) => (task.date || task.end_date || "").substring(0, 10) === day,
		);
	}

	const addTask = async () => {
		if (!newTaskTitle.trim()) return;

		const tag = tags.find((t) => t.id === selectedTagId) ?? null;
		const start = splitDateTime(newTaskStartDate);
		const date = start.date || localDayString();
		const startTime = start.time || "09:00";
		const { endDate: newEndDate, endTime } = splitEndFields(
			date,
			startTime,
			newTaskEndDate,
		);

		if (supabase) {
			const dayTasks = await getTimedTasksForDay(date);
			const conflicts = findOverlappingTasks(
				dayTasks,
				date,
				startTime,
				endTime,
			);
			if (conflicts.length) {
				alert(
					overlapMessage(conflicts) + " Elige otro horario para crearla.",
				);
				return;
			}
		}

		const payload = {
			title: newTaskTitle.trim(),
			is_completed: false,
			board_id: Number(boardId),
			status: "backlog",
			order_index: tasks.length,
			novedad: "",
			date,
			start_time: startTime,
			end_time: endTime,
			end_date: newEndDate,
			tag_id: selectedTagId,
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
				has_lists: false,
			},
		];

		newTaskTitle = "";
		selectedTagId = null;
		newTaskStartDate = composeDateTime(localDayString());
		newTaskEndDate = "";
		newTaskSharedWith = [];
		showNewTask = false;

		if (!supabase) return;

		const { data, error } = await supabase
			.from("tasks")
			.insert([payload])
			.select("*, tags(id, name, color)");

		if (error) {
			tasks = tasks.filter((t) => t.id !== tempId);
			const missingTime = /start_time|end_time/i.test(error.message);
			alert(
				"Error al crear tarea: " +
					(missingTime ? START_TIME_SQL_HINT : error.message),
			);
			return;
		}

		if (data?.[0]) {
			const createdTask = data[0];
			let finalTask = {
				...createdTask,
				has_lists: false,
				is_shared: sharedWithIds.length > 0,
				shared_with_ids: sharedWithIds,
			};

			if (sharedWithIds.length > 0) {
				const sharesToInsert = sharedWithIds.map((contactId) => ({
					task_id: createdTask.id,
					shared_with: contactId,
				}));
				// Ejecutamos silenciosamente
				supabase
					.from("task_shares")
					.insert(sharesToInsert)
					.then(({ error: shareError }) => {
						if (shareError)
							console.error("Error sharing task:", shareError);
					});

				// Automatically share board
				const boardSharesToUpsert = sharedWithIds.map((contactId) => ({
					board_id: Number(boardId),
					shared_with: contactId,
				}));
				supabase
					.from("board_shares")
					.upsert(boardSharesToUpsert, {
						onConflict: "board_id, shared_with",
					})
					.then(({ error: boardShareError }) => {
						if (boardShareError)
							console.error(
								"Error sharing board:",
								boardShareError,
							);
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
			.from("task_shares")
			.select("shared_with")
			.eq("task_id", taskId);

		if (error) {
			console.warn("Error al cargar compartidos:", error.message);
			return;
		}

		sharedWithIds = new Set((data ?? []).map((row) => row.shared_with));
	};

	const openLinkNoteModal = async () => {
		showLinkNoteModal = true;
		linkNotesLoading = true;
		if (supabase) {
			const [foldersRes, notesRes] = await Promise.all([
				supabase
					.from("note_folders")
					.select("id, name")
					.order("created_at", { ascending: true }),
				supabase
					.from("notes")
					.select("id, folder_id, title")
					.order("updated_at", { ascending: false }),
			]);
			linkableFolders = foldersRes.data || [];
			linkableNotes = notesRes.data || [];
		}
		linkNotesLoading = false;
	};

	const linkNoteToTask = async (note: any) => {
		if (!selectedTaskId || !supabase) return;
		const { error } = await supabase
			.from("tasks")
			.update({ linked_note_id: note.id })
			.eq("id", selectedTaskId);
		if (!error) {
			selectedTaskLinkedNoteId = note.id;
			selectedTaskLinkedNoteTitle = note.title;
			showLinkNoteModal = false;
			const t = tasks.find((x) => x.id === selectedTaskId);
			if (t) t.linked_note_id = note.id;
			taskActionSuccess = "Nota vinculada correctamente";
			setTimeout(() => (taskActionSuccess = ""), 3000);
		} else {
			taskActionError = error.message.includes("linked_note_id")
				? "Falta crear la columna 'linked_note_id' tipo UUID en la tabla tasks en Supabase."
				: error.message;
		}
	};

	const unlinkNoteFromTask = async () => {
		if (!selectedTaskId || !supabase) return;
		const { error } = await supabase
			.from("tasks")
			.update({ linked_note_id: null })
			.eq("id", selectedTaskId);
		if (!error) {
			selectedTaskLinkedNoteId = null;
			selectedTaskLinkedNoteTitle = null;
			const t = tasks.find((x) => x.id === selectedTaskId);
			if (t) t.linked_note_id = null;
			taskActionSuccess = "Nota desvinculada";
			setTimeout(() => (taskActionSuccess = ""), 3000);
		} else {
			taskActionError = error.message;
		}
	};

	const openTaskUpdate = async (task: any) => {
		try {
			selectedTaskId = task.id;
			selectedTaskTitle = task.title || "";
			editingNovedad = task.novedad || "";
			editingDescription = task.description || "";

			selectedTaskLinkedNoteId = task.linked_note_id || null;
			selectedTaskLinkedNoteTitle = null;
			if (selectedTaskLinkedNoteId && supabase) {
				const { data } = await supabase
					.from("notes")
					.select("title")
					.eq("id", selectedTaskLinkedNoteId)
					.single();
				if (data) selectedTaskLinkedNoteTitle = data.title;
			}

			editingDate = task.date
				? composeDateTime(task.date, task.start_time)
				: "";

			editingEndDate = "";
			if (task.end_date) {
				editingEndDate = composeDateTime(
					task.end_date,
					task.end_time || splitDateTime(task.end_date).time || "23:59",
				);
			} else if (task.end_time && task.date) {
				editingEndDate = composeDateTime(task.date, task.end_time);
			}
			openedHadTime = Boolean(task.start_time);
			openedEditingDate = editingDate;
			openedEditingEndDate = editingEndDate;
			editingTagId = task.tag_id ?? getTaskTag(task)?.id ?? null;
			taskActionError = "";
			taskActionSuccess = "";
			showTaskOptions = false;
			showTaskUpdate = true;
			await loadTaskShares(task.id);
		} catch (e) {
			console.error("Error al abrir tarea:", e);
			alert(
				"Error al abrir tarea: " + ((e as Error).message || String(e)),
			);
		}
	};

	// Valores de fecha mostrados al abrir la tarea (para no inventar horas/fechas al guardar)
	let openedHadTime = false;
	let openedEditingDate = "";
	let openedEditingEndDate = "";

	const saveTaskDetails = async () => {
		if (selectedTaskId === null) return;

		const title = selectedTaskTitle.trim();
		if (!title) {
			taskActionError = "El título no puede estar vacío.";
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
			start_time: tasks[taskIndex].start_time,
			end_time: tasks[taskIndex].end_time,
			end_date: tasks[taskIndex].end_date,
		};
		const nextTag = tags.find((t) => t.id === editingTagId) ?? null;

		const start = splitDateTime(editingDate);
		const date = start.date || editingDate || null;
		// Una tarea sin hora sigue sin hora si el usuario no tocó las fechas
		const keepUntimed =
			!openedHadTime &&
			editingDate === openedEditingDate &&
			editingEndDate === openedEditingEndDate;
		const startTime: string | null = keepUntimed ? null : start.time || "09:00";
		const endFields = startTime
			? splitEndFields(date ?? "", startTime, editingEndDate)
			: { endDate: tasks[taskIndex].end_date ?? null, endTime: null };
		const endTime = endFields.endTime;
		const endDate = endFields.endDate;

		if (date && startTime && endTime && supabase) {
			const dayTasks = await getTimedTasksForDay(date);
			const conflicts = findOverlappingTasks(
				dayTasks,
				date,
				startTime,
				endTime,
				selectedTaskId,
			);
			if (conflicts.length) {
				taskActionError =
					overlapMessage(conflicts) + " Elige otro horario.";
				return;
			}
		}

		tasks[taskIndex].title = title;
		tasks[taskIndex].tag_id = editingTagId;
		tasks[taskIndex].tags = nextTag;
		tasks[taskIndex].novedad = editingNovedad;
		tasks[taskIndex].description = editingDescription;
		tasks[taskIndex].date = date;
		tasks[taskIndex].start_time = startTime;
		tasks[taskIndex].end_time = endTime;
		tasks[taskIndex].end_date = endDate;
		selectedTaskTitle = title;
		taskActionError = "";

		if (supabase) {
			const { error } = await supabase
				.from("tasks")
				.update({
					title,
					tag_id: editingTagId,
					novedad: editingNovedad,
					description: editingDescription,
					date,
					start_time: startTime,
					end_time: endTime,
					end_date: endDate,
				})
				.eq("id", selectedTaskId);
			if (error) {
				tasks[taskIndex].title = previous.title;
				tasks[taskIndex].tag_id = previous.tag_id;
				tasks[taskIndex].tags = previous.tags;
				tasks[taskIndex].novedad = previous.novedad;
				tasks[taskIndex].description = previous.description;
				tasks[taskIndex].date = previous.date;
				tasks[taskIndex].start_time = previous.start_time;
				tasks[taskIndex].end_time = previous.end_time;
				tasks[taskIndex].end_date = previous.end_date;
				selectedTaskTitle = previous.title;
				taskActionError = /start_time|end_time/i.test(error.message)
					? START_TIME_SQL_HINT
					: error.message;
				return;
			}
		}

		taskActionSuccess = "Tarea actualizada.";
	};

	const saveNovedad = async () => {
		if (selectedTaskId === null) return;

		const taskIndex = tasks.findIndex((t) => t.id === selectedTaskId);
		if (taskIndex !== -1) {
			const previous = tasks[taskIndex].novedad;
			tasks[taskIndex].novedad = editingNovedad;
			if (supabase) {
				const { error } = await supabase
					.from("tasks")
					.update({ novedad: editingNovedad })
					.eq("id", selectedTaskId);
				if (error) {
					tasks[taskIndex].novedad = previous;
					taskActionError = error.message;
					return;
				}
			}
		}
		taskActionSuccess = "Novedad guardada.";
	};

	const toggleShareWithContact = async (contactId: string) => {
		if (!supabase || selectedTaskId === null) return;

		shareBusyId = contactId;
		taskActionError = "";
		taskActionSuccess = "";

		try {
			const alreadyShared = sharedWithIds.has(contactId);

			if (alreadyShared) {
				const { error } = await supabase
					.from("task_shares")
					.delete()
					.eq("task_id", selectedTaskId)
					.eq("shared_with", contactId);

				if (error) {
					taskActionError = error.message;
					return;
				}

				const next = new Set(sharedWithIds);
				next.delete(contactId);
				sharedWithIds = next;
				refreshTaskShareLabels(selectedTaskId, next);
				taskActionSuccess = "Se dejó de compartir con ese contacto.";
			} else {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				const me = session?.user?.id;
				if (!me) {
					taskActionError = "Debes iniciar sesión.";
					return;
				}

				const { error } = await supabase.from("task_shares").insert({
					task_id: selectedTaskId,
					shared_with: contactId,
					shared_by: me,
				});

				if (error) {
					taskActionError =
						/task_shares|schema cache|does not exist/i.test(
							error.message,
						)
							? "Falta crear la tabla task_shares en Supabase. Ejecuta el SQL 005_task_shares.sql"
							: error.message;
					return;
				}

				// Automatically share board
				await supabase.from("board_shares").upsert(
					{
						board_id: Number(boardId),
						shared_with: contactId,
					},
					{ onConflict: "board_id, shared_with" },
				);

				const next = new Set(sharedWithIds);
				next.add(contactId);
				sharedWithIds = next;
				refreshTaskShareLabels(selectedTaskId, next);
				taskActionSuccess = "Tarea compartida.";
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
			const { error } = await supabase
				.from("tasks")
				.delete()
				.eq("id", taskId);
			if (error) {
				tasks = previous;
				alert("Error al eliminar la tarea: " + error.message);
				return;
			}
		}

		if (showCalendar) await fetchActiveTaskDays();
	};

	const setDate = (offset: number) => {
		const d = new Date();
		d.setDate(d.getDate() + offset);
		d.setHours(0, 0, 0, 0);
		selectedDate = d;
	};

	const isSameDay = (a: Date, b: Date) =>
		a.getDate() === b.getDate() &&
		a.getMonth() === b.getMonth() &&
		a.getFullYear() === b.getFullYear();

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
				? "bg-brand-accent text-brand-bg font-semibold"
				: "text-brand-text-muted hover:text-brand-text"
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
				tag_id: t.tag_id ?? null,
			}));
			await supabase.from("tasks").upsert(updates);
		}
	};

	// Cálculo de progreso
	let progress = $derived(
		tasks.length > 0
			? Math.round(
					(tasks.filter((t) => t.is_completed).length /
						tasks.length) *
						100,
				)
			: 0,
	);

	let hasActiveFilters = $derived(
		filterStatus !== "all" ||
			filterTagIds.length > 0 ||
			filterSharedWithIds.length > 0 ||
			filterSharedOnly ||
			filterHasLists ||
			filterHasNovedad,
	);

	let filteredTasks = $derived.by(() => {
		if (!hasActiveFilters) return tasks;

		return tasks.filter((task) => {
			if (filterStatus === "pending" && task.is_completed) return false;
			if (filterStatus === "completed" && !task.is_completed)
				return false;

			if (filterTagIds.length > 0) {
				const tag = getTaskTag(task);
				if (!tag || !filterTagIds.includes(tag.id)) return false;
			}

			if (
				filterHasNovedad &&
				!(typeof task.novedad === "string" && task.novedad.trim())
			) {
				return false;
			}

			if (filterHasLists && !task.has_lists) return false;

			if (filterSharedOnly || filterSharedWithIds.length > 0) {
				if (!task.is_shared) return false;
				if (filterSharedWithIds.length > 0) {
					const sharedIds = (task.shared_with_ids ?? []) as string[];
					if (
						!filterSharedWithIds.some((id) =>
							sharedIds.includes(id),
						)
					)
						return false;
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
		filterStatus = "all";
		filterTagIds = [];
		filterSharedWithIds = [];
		filterSharedOnly = false;
		filterHasLists = false;
		filterHasNovedad = false;
	};

	const focusOnSelectedTask = () => {
		if (selectedTaskId == null) return;
		linkPomodoroTask(selectedTaskId, selectedTaskTitle || "Tarea");
		showTaskOptions = false;
		showTaskUpdate = false;
		pomodoroUI.isMaximized = true;
	};

	const topLevelTasks = $derived(tasks.filter((t) => !t.parent_task_id));
	const topLevelCompleted = $derived(
		topLevelTasks.filter((t) => t.is_completed).length,
	);

	// --- KANBAN LOGIC ---
	let kanbanState = $derived.by(() => {
		const cols: Record<string, any[]> = {};
		boardLists.forEach((l) => (cols[l.id] = []));
		tasks.forEach((t) => {
			// Las subtareas se ven dentro de su tarea padre, no como tarjetas sueltas
			if (t.parent_task_id) return;
			// Apply "Solo mías" filter
			if (filterSharedOnly) {
				const isMine =
					t.is_shared === false ||
					(t.shared_with_ids && t.shared_with_ids.length > 0);
				if (!isMine) return; // Super simple heuristic for now
			}

			let targetList = t.list_id;
			if (!targetList && boardLists.length > 0)
				targetList = boardLists[0].id;

			if (cols[targetList]) cols[targetList].push(t);
		});
		Object.keys(cols).forEach((k) =>
			cols[k].sort((a, b) => a.order_index - b.order_index),
		);
		return cols;
	});

	let boardItems: Record<string, any[]> = $state({});

	$effect(() => {
		boardItems = kanbanState;
	});

	function handleDndConsiderCards(e: any, colId: string) {
		boardItems[colId] = e.detail.items;
	}
	function handleDndFinalizeCards(e: any, colId: string) {
		boardItems[colId] = e.detail.items;
		boardItems[colId].forEach(async (t: any, i: number) => {
			if (t.order_index !== i || t.list_id !== colId) {
				const updates = { order_index: i, list_id: colId };
				const tempTasks = [...tasks];
				tasks = tasks.map((tt) =>
					tt.id === t.id ? { ...tt, ...updates } : tt,
				);
				if (supabase) {
					const { error } = await supabase
						.from("tasks")
						.update(updates)
						.eq("id", t.id);
					if (error) {
						tasks = tempTasks;
						console.error(error);
					}
				}
			}
		});
	}

	function handleDndConsiderColumns(e: any) {
		boardLists = e.detail.items;
	}

	async function handleDndFinalizeColumns(e: any) {
		boardLists = e.detail.items;
		if (supabase) {
			const updates = boardLists.map((l, index) => ({
				id: l.id,
				board_id: Number(boardId),
				name: l.name,
				order_index: index,
				color: l.color,
			}));
			await supabase.from("board_lists").upsert(updates);
		}
	}

	const addList = () => {
		showCrearListaModal = true;
	};

	const confirmAddList = async () => {
		const name = newListName.trim();
		if (!name) return;
		const orderIndex = boardLists.length;
		const { data, error } = await supabase!
			.from("board_lists")
			.insert({
				board_id: Number(boardId),
				name,
				order_index: orderIndex,
				color: "bg-brand-surface",
			})
			.select()
			.single();
		if (data) {
			boardLists = [...boardLists, data];
			showCrearListaModal = false;
			newListName = "";
		}
	};

	const addSubtask = async () => {
		if (!subtaskTitle.trim() || selectedTaskId === null || !supabase)
			return;

		const title = subtaskTitle.trim();
		const listId = boardLists[0]?.id; // Default to first list or we can use current list
		const currentTask = tasks.find((t) => t.id === selectedTaskId);
		const targetListId = currentTask ? currentTask.list_id : listId;
		const taskDate = currentTask?.date || formatDateString(new Date());

		const { data, error } = await supabase
			.from("tasks")
			.insert({
				board_id: Number(boardId),
				list_id: targetListId,
				title,
				is_completed: false,
				order_index: 0,
				parent_task_id: selectedTaskId,
				date: taskDate,
			})
			.select("*, tags(id, name, color)")
			.single();

		if (error) {
			console.error("Error creating subtask:", error);
			alert("Error al crear subtarea: " + error.message);
		}

		if (data && !error) {
			tasks = [...tasks, data];
			subtaskTitle = "";
		}
	};

	const saveListEdit = async () => {
		if (!listToEdit) return;
		const name = editListTitle.trim();
		if (!name) return;

		if (supabase) {
			const { error } = await supabase
				.from("board_lists")
				.update({ name })
				.eq("id", listToEdit);
			if (error) {
				alert("Error al actualizar la lista: " + error.message);
				return;
			}
		}
		boardLists = boardLists.map((l) =>
			l.id === listToEdit ? { ...l, name } : l,
		);
		listToEdit = null;
	};

	const confirmDeleteList = async (listId: number) => {
		if (supabase) {
			const { error } = await supabase
				.from("board_lists")
				.delete()
				.eq("id", listId);
			if (error) {
				alert("Error al eliminar la lista: " + error.message);
				return;
			}
		}
		boardLists = boardLists.filter((l) => l.id !== listId);
		listToDelete = null;
		await fetchTasks();
	};
	// -------------------------
</script>

<svelte:head>
	<title>{currentBoard?.title ?? "Tablero"} · Fokuz</title>
</svelte:head>

<div class="flex-1 flex flex-col h-full bg-[#070b0e] overflow-hidden">
	<!-- Top Toolbar -->
	<BoardToolbar
		{addList}
		{allBoards}
		{boardId}
		{currentBoard}
		bind:showBoardDropdown
		bind:showTags
		bind:viewMode
	/>

	{#if viewMode === "kanban"}
		<KanbanView
			{addList}
			{boardItems}
			{boardLists}
			{boardListsError}
			{contacts}
			bind:editListTitle
			{handleDndConsiderCards}
			{handleDndConsiderColumns}
			{handleDndFinalizeCards}
			{handleDndFinalizeColumns}
			bind:listToDelete
			bind:listToEdit
			bind:openListMenuId
			{openNewTask}
			{openTaskUpdate}
			{saveListEdit}
			{toggleTask}
		/>
	{:else if viewMode === "lista"}
		<ListView {boardItems} {boardLists} {openNewTask} {openTaskUpdate} />
	{:else if viewMode === "calendario"}
		<CalendarView
			{boardCalendarDays}
			bind:calendarCurrentMonth
			{getTasksForCalendarDate}
			bind:newTaskStartDate
			{nextCalMonth}
			{openTaskUpdate}
			{prevCalMonth}
			bind:showNewTask
		/>
	{/if}

	<footer
		class="shrink-0 h-14 md:h-10 border-t border-brand-divider bg-[#070b0e] px-4 md:px-6 flex flex-col md:flex-row md:items-center justify-center md:justify-between text-[11px] font-medium relative z-10 gap-2 md:gap-0"
	>
		<div
			class="flex items-center justify-center md:justify-start gap-4 md:gap-6"
		>
			<span class="flex items-center gap-2 text-brand-text font-bold"
				><Kanban class="w-3.5 h-3.5 text-brand-text-muted" />
				{topLevelTasks.length}
				{topLevelTasks.length === 1 ? "tarea" : "tareas"} en este tablero</span
			>
			<span class="flex items-center gap-2 text-brand-accent font-bold"
				><span
					class="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_5px_var(--color-brand-accent)]"
				></span>
				{topLevelCompleted}
				{topLevelCompleted === 1 ? "completada" : "completadas"}</span
			>
		</div>
	</footer>
</div>

<!-- Modals Block -->

<!-- Detalle de la Tarea Modal (Fullscreen-ish) -->
{#if showTaskUpdate}
	{@const selectedTask = tasks.find((t) => t.id === selectedTaskId) || {}}
	<TaskDetailModal
		{setTaskHasLists}
		{addSubtask}
		{boardLists}
		{contactLabel}
		{contacts}
		{currentBoard}
		{deleteTask}
		bind:editingDate
		bind:editingDescription
		bind:editingEndDate
		bind:editingNovedad
		bind:editingTagId
		{focusOnSelectedTask}
		{openLinkNoteModal}
		{openTaskUpdate}
		{saveNovedad}
		{saveTaskDetails}
		{selectedTask}
		{selectedTaskLinkedNoteId}
		{selectedTaskLinkedNoteTitle}
		bind:selectedTaskTitle
		{shareBusyId}
		{sharedWithIds}
		bind:showTags
		bind:showTaskOptions
		bind:showTaskUpdate
		bind:subtaskTitle
		{subtasks}
		{tags}
		{taskActionError}
		{taskActionSuccess}
		{tasks}
		{toggleShareWithContact}
		{toggleTask}
		{unlinkNoteFromTask}
	/>
{/if}
{#if showNewTask}
	<NewTaskModal
		{addTask}
		{contacts}
		bind:newTaskEndDate
		bind:newTaskSharedWith
		bind:newTaskStartDate
		bind:newTaskTitle
		bind:selectedTagId
		bind:showNewTask
		{tags}
	/>
{/if}

{#if showTags}
	<TagsModal
		{TAG_COLORS}
		{addTag}
		bind:editTagColor
		bind:editTagName
		bind:newTagColor
		bind:newTagName
		{saveTagEdit}
		bind:showTags
		bind:tagToDelete
		bind:tagToEdit
		{tags}
	/>
{/if}

{#if tagToDelete}
	<div
		class="fixed inset-0 bg-black/80 z-60 flex items-center justify-center backdrop-blur-sm p-4"
	>
		<div
			class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center"
		>
			<div
				class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4"
			>
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">
				¿Eliminar etiqueta?
			</h3>
			<p class="text-sm text-brand-text-muted mb-6">
				Las tareas que tenían esta etiqueta quedarán sin etiqueta. Esta
				acción no se puede deshacer.
			</p>
			<div class="flex justify-center gap-3 w-full">
				<button
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors"
					onclick={() => (tagToDelete = null)}>Cancelar</button
				>
				<button
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]"
					onclick={() => {
						if (tagToDelete !== null) deleteTag(tagToDelete);
					}}>Eliminar</button
				>
			</div>
		</div>
	</div>
{/if}

{#if showCrearListaModal}
	<AddColumnModal {confirmAddList} bind:newListName bind:showCrearListaModal />
{/if}

{#if listToDelete}
	<div
		class="fixed inset-0 bg-black/80 z-60 flex items-center justify-center backdrop-blur-sm p-4"
	>
		<div
			class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center"
		>
			<div
				class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4"
			>
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">
				¿Eliminar esta lista?
			</h3>
			<p class="text-sm text-brand-text-muted mb-6">
				Todas las tareas dentro de esta lista también serán eliminadas.
				Esta acción no se puede deshacer.
			</p>
			<div class="flex justify-center gap-3 w-full">
				<button
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors"
					onclick={() => (listToDelete = null)}>Cancelar</button
				>
				<button
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]"
					onclick={() => {
						if (listToDelete !== null)
							confirmDeleteList(listToDelete);
					}}>Eliminar</button
				>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Vincular Nota -->
{#if showLinkNoteModal}
	<LinkNoteModal
		bind:linkModalSearchQuery
		{linkNoteToTask}
		{linkNotesLoading}
		{linkableFolders}
		{linkableNotes}
		bind:showLinkNoteModal
	/>
{/if}

<!-- Modal Confirmar Eliminación de Tarea -->
{#if showDeleteTaskConfirm}
	<div
		class="fixed inset-0 bg-black/80 z-60 flex items-center justify-center backdrop-blur-sm p-4"
	>
		<div
			class="bg-brand-surface border border-brand-divider rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center"
		>
			<div
				class="w-12 h-12 rounded-full bg-red-400/20 text-red-400 flex items-center justify-center mb-4"
			>
				<AlertTriangle class="w-6 h-6" />
			</div>
			<h3 class="text-lg font-bold text-brand-text mb-2">
				¿Eliminar Tarea?
			</h3>
			<p class="text-sm text-brand-text-muted mb-6">
				Esta tarea será eliminada permanentemente y no podrá
				recuperarse.
			</p>
			<div class="flex justify-center gap-3 w-full">
				<button
					class="flex-1 px-4 py-2 rounded-xl text-brand-text font-bold bg-[#0d1216] hover:bg-brand-surface-elevated border border-brand-divider transition-colors"
					onclick={() => (showDeleteTaskConfirm = false)}
				>
					Cancelar
				</button>
				<button
					class="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]"
					onclick={confirmDeleteTask}
				>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}
