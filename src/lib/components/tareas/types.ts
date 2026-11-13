// Tipos compartidos por el tablero de tareas y sus componentes.
export type TaskTag = { id: number; name: string; color: string };

export type Contact = {
	id: string;
	email: string;
	display_name: string;
	nickname: string;
};

export type TaskList = {
	id: number;
	task_id: number;
	name: string;
	item_count?: number;
	done_count?: number;
};

export type TaskListItem = {
	id: number;
	list_id: number;
	title: string;
	is_completed: boolean;
	order_index: number;
};

export type TaskPanel = 'menu' | 'novedad' | 'share' | 'listas';
