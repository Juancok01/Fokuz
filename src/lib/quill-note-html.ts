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

export function sanitizeNoteHtml(html: string): string {
	if (!html) return '';

	const root = document.createElement('div');
	root.innerHTML = html;
	root.querySelectorAll('select, .ql-ui, .ql-picker, .ql-picker-options').forEach((el) => {
		el.remove();
	});

	const leftovers: Element[] = [];
	root.querySelectorAll('p, div, h1, h2, h3, span, pre').forEach((el) => {
		if (el.querySelector('.ql-code-block, pre, table')) return;
		if (isOnlyLeakedLanguages(el.textContent || '')) {
			leftovers.push(el);
		}
	});
	leftovers.forEach((el) => el.remove());

	return root.innerHTML.replace(leakedLanguagesRe(), '');
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
	deleteText: (index: number, length: number, source?: string) => void;
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
		deleteText: (index: number, length: number, source?: string) => void;
	},
	html: string
): void {
	quill.clipboard.dangerouslyPasteHTML(sanitizeNoteHtml(html || ''));
	stripLeakedLanguageText(quill);
}
