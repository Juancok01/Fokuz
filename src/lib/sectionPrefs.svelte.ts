import { supabase } from '$lib/supabaseClient';

/**
 * Secciones que el usuario puede mostrar u ocultar.
 * "Inicio" y "Perfil" siempre están visibles (no aparecen aquí).
 */
export const SECTION_OPTIONS = [
	{ id: 'habitos', label: 'Hábitos', description: 'Seguimiento diario de hábitos y rachas' },
	{ id: 'tareas', label: 'Tareas', description: 'Tableros, tareas de hoy y calendario' },
	{ id: 'pomodoro', label: 'Foco (Pomodoro)', description: 'Temporizador de enfoque' },
	{ id: 'notas', label: 'Notas', description: 'Tus notas y apuntes' },
	{ id: 'finanzas', label: 'Finanzas', description: 'Ingresos, gastos, ahorros y préstamos' }
] as const;

export type SectionId = (typeof SECTION_OPTIONS)[number]['id'];

const ALL_IDS = SECTION_OPTIONS.map((s) => s.id) as SectionId[];
const STORAGE_KEY = 'fokuz:visible-sections';
const META_KEY = 'visible_sections';

const sanitize = (value: unknown): SectionId[] | null => {
	if (!Array.isArray(value)) return null;
	return ALL_IDS.filter((id) => value.includes(id));
};

const readLocal = (): SectionId[] | null => {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? sanitize(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
};

const writeLocal = (ids: SectionId[]) => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
	} catch {
		/* almacenamiento no disponible */
	}
};

class SectionPrefs {
	visible = $state<SectionId[]>(readLocal() ?? [...ALL_IDS]);
	loaded = $state(false);

	isVisible(id: SectionId) {
		return this.visible.includes(id);
	}

	/** Carga la preferencia guardada en la cuenta (sincroniza entre dispositivos). */
	async load() {
		if (!supabase) {
			this.loaded = true;
			return;
		}
		const {
			data: { session }
		} = await supabase.auth.getSession();
		const fromAccount = sanitize(session?.user?.user_metadata?.[META_KEY]);
		if (fromAccount) {
			this.visible = fromAccount;
			writeLocal(fromAccount);
		}
		this.loaded = true;
	}

	/** Guarda localmente y en la cuenta del usuario. Devuelve un mensaje de error si falla. */
	async save(ids: SectionId[]): Promise<string | null> {
		const clean = sanitize(ids) ?? [];
		this.visible = clean;
		writeLocal(clean);
		if (!supabase) return null;
		const { error } = await supabase.auth.updateUser({ data: { [META_KEY]: clean } });
		return error ? error.message : null;
	}
}

export const sectionPrefs = new SectionPrefs();
