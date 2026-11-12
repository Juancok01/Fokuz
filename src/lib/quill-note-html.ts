/**
 * Quill 2's syntax module injects a <select> of language names into each
 * code block. Saving root.innerHTML persists that select; loading it back
 * turns the option labels into visible text:
 * "PlainBashC++C#CSSDiffHTML/XMLJavaJavaScriptMarkdownPHPPythonRubySQL"
 */

const LANGUAGE_TOKEN =
	'(?:JavaScript|HTML\\/XML|Markdown|Python|Plain|Bash|C\\+\\+|C#|CSS|Diff|Java|PHP|Ruby|SQL)';

function leakedLanguagesRe(): RegExp {
	return new RegExp(
		`PlainBashC\\+\\+C#CSSDiffHTML\\/XMLJavaJavaScriptMarkdownPHPPythonRubySQL|${LANGUAGE_TOKEN}{4,}`,
		'gi'
	);
}

function compactText(value: string): string {
	return value.replace(/\s+/g, '');
}

function isOnlyLeakedLanguages(value: string): boolean {
	const compact = compactText(value);
	if (compact.length < 12) return false;
	return compact.replace(leakedLanguagesRe(), '') === '';
}

/**
 * Quill 2 (getSemanticHTML) guarda cada espacio como &nbsp;. Eso rompe la búsqueda y
 * ensucia las vistas previas. Un &nbsp; suelto vuelve a ser un espacio normal; en rachas
 * se conserva uno menos para no perder sangrías ni espacios múltiples.
 */
export function normalizeNbsp(html: string): string {
	return html.replace(/(?:&nbsp;|\u00a0)+/g, (run) => {
		const count = (run.match(/&nbsp;|\u00a0/g) ?? []).length;
		return count === 1 ? ' ' : ' ' + '&nbsp;'.repeat(count - 1);
	});
}

/** Elementos que nunca deben venir en el contenido de una nota. */
const DANGEROUS_SELECTOR =
	'script, iframe, object, embed, link, meta, style, base, form, input, button, textarea';

/** Elimina atributos de eventos (onerror, onclick…) y URLs javascript:. */
function stripDangerousAttributes(root: ParentNode) {
	root.querySelectorAll('*').forEach((el) => {
		for (const attr of [...el.attributes]) {
			const name = attr.name.toLowerCase();
			const value = attr.value.trim().toLowerCase();
			if (name.startsWith('on')) {
				el.removeAttribute(attr.name);
			} else if (
				(name === 'href' || name === 'src' || name === 'xlink:href' || name === 'action') &&
				(value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html'))
			) {
				el.removeAttribute(attr.name);
			}
		}
	});
}

/**
 * Texto plano de una nota (para vistas previas y búsqueda): sin etiquetas y con las
 * entidades HTML (&nbsp;, &amp;, &gt;…) convertidas a sus caracteres.
 */
export function noteHtmlToText(html: string): string {
	if (!html) return '';
	const doc = document.implementation.createHTMLDocument('');
	doc.body.innerHTML = html.replace(/<\/(p|div|li|h[1-6]|pre|tr)>/gi, '$& ');
	return (doc.body.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function sanitizeNoteHtml(html: string): string {
	if (!html) return '';

	// Documento inerte: a diferencia de un <div> del documento real, aquí no se cargan
	// imágenes ni se ejecutan atributos como onerror (protección contra XSS en notas compartidas).
	const doc = document.implementation.createHTMLDocument('');
	const root = doc.body;
	root.innerHTML = html;
	root.querySelectorAll('select, .ql-ui, .ql-picker, .ql-picker-options').forEach((el) => {
		el.remove();
	});
	root.querySelectorAll(DANGEROUS_SELECTOR).forEach((el) => el.remove());
	stripDangerousAttributes(root);

	const leftovers: Element[] = [];
	root.querySelectorAll('p, div, h1, h2, h3, span, pre').forEach((el) => {
		if (el.querySelector('.ql-code-block, pre, table')) return;
		if (isOnlyLeakedLanguages(el.textContent || '')) {
			leftovers.push(el);
		}
	});
	leftovers.forEach((el) => el.remove());

	return normalizeNbsp(root.innerHTML.replace(leakedLanguagesRe(), ''));
}

export function getCleanQuillHtml(quill: { getSemanticHTML?: () => string; root: HTMLElement }): string {
	const html =
		typeof quill.getSemanticHTML === 'function' ? quill.getSemanticHTML() : quill.root.innerHTML;
	return sanitizeNoteHtml(html);
}

export function guardQuillCodeBlocks(quill: any): void {
	const Delta = quill.constructor.import('delta');
	quill.clipboard.addMatcher('SELECT', () => new Delta());
	quill.clipboard.addMatcher('OPTION', () => new Delta());
}

export function stripLeakedLanguageText(quill: {
	getText: () => string;
	deleteText: (index: number, length: number, source?: any) => unknown;
}): void {
	const text = quill.getText();
	const matches = [...text.matchAll(leakedLanguagesRe())];
	for (let i = matches.length - 1; i >= 0; i--) {
		const match = matches[i];
		if (match.index == null) continue;
		quill.deleteText(match.index, match[0].length, 'silent');
	}
}

export function loadNoteHtml(
	quill: {
		clipboard: { dangerouslyPasteHTML: (html: string) => void };
		getText: () => string;
		deleteText: (index: number, length: number, source?: any) => unknown;
	},
	html: string
): void {
	quill.clipboard.dangerouslyPasteHTML(sanitizeNoteHtml(html || ''));
	stripLeakedLanguageText(quill);
}
