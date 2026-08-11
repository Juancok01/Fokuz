import { json } from '@sveltejs/kit';
import { getLocalDailyVerse, normalizeApiVerse } from '$lib/dailyVerse';
import { formatDateInTz } from '$lib/habits';
import type { RequestHandler } from './$types';

const API_URL = 'https://api-biblia-py.onrender.com/daily/nvi';

export const GET: RequestHandler = async () => {
	const date = formatDateInTz();
	const local = getLocalDailyVerse(date);

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 7000);

		const response = await fetch(API_URL, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});
		clearTimeout(timeout);

		if (!response.ok) {
			return json(local, {
				headers: { 'Cache-Control': 'public, max-age=300' }
			});
		}

		const payload = await response.json();
		const verse = normalizeApiVerse(payload) ?? local;

		return json(verse, {
			headers: { 'Cache-Control': 'public, max-age=3600' }
		});
	} catch {
		return json(local, {
			headers: { 'Cache-Control': 'public, max-age=300' }
		});
	}
};
