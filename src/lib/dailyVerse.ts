import { formatDateInTz } from '$lib/habits';

export type DailyVerse = {
	text: string;
	reference: string;
	translation: string;
	source: 'api' | 'local';
};

/** Respaldo local en NVI (mismo versículo todo el día, zona Colombia). */
const LOCAL_VERSES: Omit<DailyVerse, 'source'>[] = [
	{
		text: 'Porque tanto amó Dios al mundo que dio a su Hijo unigénito, para que todo el que cree en él no se pierda, sino que tenga vida eterna.',
		reference: 'Juan 3:16',
		translation: 'NVI'
	},
	{
		text: 'Todo lo puedo en Cristo que me fortalece.',
		reference: 'Filipenses 4:13',
		translation: 'NVI'
	},
	{
		text: 'El Señor es mi pastor, nada me falta.',
		reference: 'Salmos 23:1',
		translation: 'NVI'
	},
	{
		text: 'Encomienda al Señor tu camino; confía en él, y él actuará.',
		reference: 'Salmos 37:5',
		translation: 'NVI'
	},
	{
		text: 'Así que no temas, porque yo estoy contigo; no te angusties, porque yo soy tu Dios. Te fortaleceré y te ayudaré; te sostendré con mi diestra victoriosa.',
		reference: 'Isaías 41:10',
		translation: 'NVI'
	},
	{
		text: 'Busquen primeramente el reino de Dios y su justicia, y todas estas cosas les serán añadidas.',
		reference: 'Mateo 6:33',
		translation: 'NVI'
	},
	{
		text: 'Vengan a mí todos ustedes que están cansados y agobiados, y yo les daré descanso.',
		reference: 'Mateo 11:28',
		translation: 'NVI'
	},
	{
		text: 'No se inquieten por nada; más bien, en toda ocasión, con oración y ruego, presenten sus peticiones a Dios y denle gracias.',
		reference: 'Filipenses 4:6',
		translation: 'NVI'
	},
	{
		text: 'Ahora bien, sabemos que Dios dispone todas las cosas para el bien de quienes lo aman, los que han sido llamados de acuerdo con su propósito.',
		reference: 'Romanos 8:28',
		translation: 'NVI'
	},
	{
		text: 'El que habita al abrigo del Altísimo se acoge a la sombra del Todopoderoso.',
		reference: 'Salmos 91:1',
		translation: 'NVI'
	},
	{
		text: 'Tu palabra es una lámpara a mis pies; es una luz en mi sendero.',
		reference: 'Salmos 119:105',
		translation: 'NVI'
	},
	{
		text: 'Confía en el Señor de todo corazón, y no en tu propia inteligencia.',
		reference: 'Proverbios 3:5',
		translation: 'NVI'
	},
	{
		text: 'Este es el día en que el Señor ha actuado; regocijémonos y alegrémonos en él.',
		reference: 'Salmos 118:24',
		translation: 'NVI'
	},
	{
		text: 'Por sobre todas las cosas, cuida tu corazón, porque de él mana la vida.',
		reference: 'Proverbios 4:23',
		translation: 'NVI'
	},
	{
		text: 'Pero los que confían en el Señor renovarán sus fuerzas; volarán como las águilas: correrán y no se fatigarán, caminarán y no se cansarán.',
		reference: 'Isaías 40:31',
		translation: 'NVI'
	},
	{
		text: 'La paz les dejo; mi paz les doy. Yo no se la doy a ustedes como la da el mundo. No se angustien ni se acobarden.',
		reference: 'Juan 14:27',
		translation: 'NVI'
	},
	{
		text: 'Por tanto, imiten a Dios, como hijos muy queridos.',
		reference: 'Efesios 5:1',
		translation: 'NVI'
	},
	{
		text: 'Más bien, sean bondadosos y compasivos unos con otros, y perdónense mutuamente, así como Dios los perdonó a ustedes en Cristo.',
		reference: 'Efesios 4:32',
		translation: 'NVI'
	},
	{
		text: 'En cambio, el fruto del Espíritu es amor, alegría, paz, paciencia, amabilidad, bondad, fidelidad, humildad y dominio propio.',
		reference: 'Gálatas 5:22-23',
		translation: 'NVI'
	},
	{
		text: 'Porque yo sé muy bien los planes que tengo para ustedes —afirma el Señor—, planes de bienestar y no de calamidad, a fin de darles un futuro y una esperanza.',
		reference: 'Jeremías 29:11',
		translation: 'NVI'
	},
	{
		text: 'Sean fuertes y valientes. No teman ni se asusten ante esas naciones, porque el Señor su Dios es quien va con ustedes; él nunca los dejará ni los abandonará.',
		reference: 'Deuteronomio 31:6',
		translation: 'NVI'
	},
	{
		text: 'Den gracias a Dios en toda situación, porque esta es su voluntad para ustedes en Cristo Jesús.',
		reference: '1 Tesalonicenses 5:18',
		translation: 'NVI'
	},
	{
		text: 'Pidan, y se les dará; busquen, y encontrarán; llamen, y se les abrirá.',
		reference: 'Mateo 7:7',
		translation: 'NVI'
	},
	{
		text: 'Porque donde esté tu tesoro, allí estará también tu corazón.',
		reference: 'Mateo 6:21',
		translation: 'NVI'
	},
	{
		text: 'El Señor es mi luz y mi salvación; ¿a quién temeré? El Señor es el baluarte de mi vida; ¿quién podrá amedrentarme?',
		reference: 'Salmos 27:1',
		translation: 'NVI'
	},
	{
		text: 'Sobre todo, ámense los unos a los otros profundamente, porque el amor cubre multitud de pecados.',
		reference: '1 Pedro 4:8',
		translation: 'NVI'
	},
	{
		text: 'Ya te lo he ordenado: ¡Sé fuerte y valiente! ¡No tengas miedo ni te desanimes! Porque el Señor tu Dios te acompañará dondequiera que vayas.',
		reference: 'Josué 1:9',
		translation: 'NVI'
	},
	{
		text: 'El corazón del hombre traza su rumbo, pero sus pasos los dirige el Señor.',
		reference: 'Proverbios 16:9',
		translation: 'NVI'
	},
	{
		text: 'Ahora están estas tres virtudes: la fe, la esperanza y el amor. Pero la más excelente de ellas es el amor.',
		reference: '1 Corintios 13:13',
		translation: 'NVI'
	},
	{
		text: 'El Señor peleará por ustedes; ustedes quédense quietos.',
		reference: 'Éxodo 14:14',
		translation: 'NVI'
	},
	{
		text: 'Pues Dios no nos ha dado un espíritu de timidez, sino de poder, de amor y de dominio propio.',
		reference: '2 Timoteo 1:7',
		translation: 'NVI'
	}
];

const cacheKey = (date: string) => `fokuz:daily-verse:nvi:${date}`;

export const getLocalDailyVerse = (date = formatDateInTz()): DailyVerse => {
	const dayIndex = Math.abs(
		date.split('-').reduce((acc, part) => acc * 31 + Number(part || 0), 0)
	);
	const verse = LOCAL_VERSES[dayIndex % LOCAL_VERSES.length]!;
	return { ...verse, source: 'local' };
};

export const readCachedDailyVerse = (date = formatDateInTz()): DailyVerse | null => {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(cacheKey(date));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as DailyVerse;
		if (!parsed?.text || !parsed?.reference) return null;
		return parsed;
	} catch {
		return null;
	}
};

export const writeCachedDailyVerse = (verse: DailyVerse, date = formatDateInTz()) => {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(cacheKey(date), JSON.stringify(verse));
	} catch {
		/* ignore quota */
	}
};

export const normalizeApiVerse = (payload: unknown): DailyVerse | null => {
	if (!payload || typeof payload !== 'object') return null;
	const data = payload as Record<string, unknown>;

	const text =
		(typeof data.text === 'string' && data.text) ||
		(typeof data.verse === 'string' && data.verse) ||
		(typeof data.content === 'string' && data.content) ||
		'';

	const book =
		(typeof data.book === 'string' && data.book) ||
		(typeof data.libro === 'string' && data.libro) ||
		'';
	const chapter = data.chapter ?? data.capitulo ?? data.ch;
	const verseNum = data.verse_number ?? data.verseNum ?? data.versiculo ?? data.vers;
	const reference =
		(typeof data.reference === 'string' && data.reference) ||
		(typeof data.ref === 'string' && data.ref) ||
		(book && chapter != null && verseNum != null ? `${book} ${chapter}:${verseNum}` : '') ||
		(typeof data.cita === 'string' && data.cita) ||
		'';

	const translation =
		(typeof data.translation === 'string' && data.translation) ||
		(typeof data.version === 'string' && data.version) ||
		(typeof data.traduccion === 'string' && data.traduccion) ||
		'NVI';

	const cleanText = text.replace(/\s+/g, ' ').trim();
	const cleanRef = reference.replace(/\s+/g, ' ').trim();
	if (!cleanText || !cleanRef) return null;

	return {
		text: cleanText,
		reference: cleanRef,
		translation: String(translation).toUpperCase(),
		source: 'api'
	};
};
