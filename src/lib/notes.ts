import { supabase } from '$lib/supabaseClient';

export interface Note {
	id: string;
	user_id: string;
	parent_id: string | null;
	title: string;
	content: string;
	created_at: string;
	updated_at: string;
	
	// Virtual fields for UI
	is_shared?: boolean;
	is_shared_with_me?: boolean;
}

export interface Contact {
	id: string;
	email: string;
	display_name: string;
}

export type InsertNote = Partial<Omit<Note, 'id' | 'created_at' | 'updated_at' | 'user_id'>>;

export async function fetchRootNotes() {
	const { data, error } = await supabase
		.from('notes')
		.select('*')
		.is('parent_id', null)
		.order('updated_at', { ascending: false });

	if (error) throw error;
	return data as Note[];
}

export async function fetchNote(id: string) {
	const { data, error } = await supabase
		.from('notes')
		.select('*')
		.eq('id', id)
		.single();

	if (error) throw error;
	return data as Note;
}

export async function fetchSubnotes(parentId: string) {
	const { data, error } = await supabase
		.from('notes')
		.select('*')
		.eq('parent_id', parentId)
		.order('created_at', { ascending: true });

	if (error) throw error;
	return data as Note[];
}

export async function createNote(note: InsertNote) {
	const { data, error } = await supabase
		.from('notes')
		.insert(note)
		.select()
		.single();

	if (error) throw error;
	return data as Note;
}

export async function updateNote(id: string, updates: Partial<Note>) {
	const { data, error } = await supabase
		.from('notes')
		.update(updates)
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data as Note;
}

export async function deleteNote(id: string) {
	const { error } = await supabase
		.from('notes')
		.delete()
		.eq('id', id);

	if (error) throw error;
}

export async function fetchMyContacts() {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return [];
	
	const { data, error } = await supabase
		.from('contacts')
		.select(`
			contact_user_id,
			profiles!contacts_contact_user_id_fkey (id, email, display_name)
		`)
		.eq('user_id', user.id);

	if (error) throw error;
	
	return (data || []).map((row: any) => ({
		id: row.profiles.id,
		email: row.profiles.email,
		display_name: row.profiles.display_name || row.profiles.email
	})) as Contact[];
}

export async function fetchNoteShares(noteId: string) {
	const { data, error } = await supabase
		.from('note_shares')
		.select('shared_with')
		.eq('note_id', noteId);
	if (error) throw error;
	return data.map(d => d.shared_with) as string[];
}

export async function shareNote(noteId: string, contactId: string) {
	const { error } = await supabase
		.from('note_shares')
		.insert({ note_id: noteId, shared_with: contactId });
	if (error) throw error;
}

export async function unshareNote(noteId: string, contactId: string) {
	const { error } = await supabase
		.from('note_shares')
		.delete()
		.eq('note_id', noteId)
		.eq('shared_with', contactId);
	if (error) throw error;
}
