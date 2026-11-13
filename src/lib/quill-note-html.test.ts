// @vitest-environment jsdom
// jsdom solo ejecuta atributos de eventos (onerror, ontoggle…) con runScripts; así las pruebas
// de XSS fallarían de verdad si el HTML se procesara en el documento real.
// @vitest-environment-options {"jsdom":{"runScripts":"dangerously"}}
import { afterEach, describe, expect, it } from 'vitest';
import { normalizeNbsp, noteHtmlToText, sanitizeNoteHtml } from './quill-note-html';

/** Carga XSS que jsdom sí ejecuta: <details open> dispara ontoggle al crearse en un documento con scripts. */
const XSS = `<details open ontoggle="document.body.setAttribute('data-xss', '1')"></details>`;
const xssRan = async () => {
	await new Promise((r) => setTimeout(r, 100));
	return document.body.getAttribute('data-xss') === '1';
};

describe('normalizeNbsp (los espacios no se guardan como &nbsp;)', () => {
	it('un &nbsp; suelto vuelve a ser un espacio', () => {
		expect(normalizeNbsp('Guardado&nbsp;manual&nbsp;QA')).toBe('Guardado manual QA');
	});

	it('en rachas conserva espacios múltiples / sangrías', () => {
		expect(normalizeNbsp('a&nbsp;&nbsp;&nbsp;b')).toBe('a &nbsp;&nbsp;b');
	});

	it('también normaliza el carácter U+00A0', () => {
		expect(normalizeNbsp('a b')).toBe('a b');
	});
});

describe('sanitizeNoteHtml (seguridad de notas compartidas)', () => {
	afterEach(() => {
		document.body.removeAttribute('data-xss');
	});

	it('quita atributos de eventos (onerror, onclick…)', () => {
		const out = sanitizeNoteHtml('<p onclick="alert(1)">hola</p><img src="x" onerror="alert(1)">');
		expect(out).not.toMatch(/onclick|onerror/i);
		expect(out).toContain('hola');
	});

	it('elimina scripts, iframes y formularios', () => {
		const out = sanitizeNoteHtml('<p>ok</p><script>alert(1)</script><iframe src="https://x"></iframe><form><input></form>');
		expect(out).toBe('<p>ok</p>');
	});

	it('quita enlaces javascript:', () => {
		const out = sanitizeNoteHtml('<a href="javascript:alert(1)">link</a><a href="https://fokuz.app">ok</a>');
		expect(out).not.toContain('javascript:');
		expect(out).toContain('href="https://fokuz.app"');
	});

	it('no ejecuta código al procesar el HTML (documento inerte)', async () => {
		const out = sanitizeNoteHtml(XSS);
		expect(await xssRan()).toBe(false);
		expect(out).not.toMatch(/ontoggle/i);
	});

	it('control: la misma carga SÍ se ejecuta en un div del documento real', async () => {
		document.createElement('div').innerHTML = XSS;
		expect(await xssRan()).toBe(true);
	});

	it('conserva el formato normal de la nota', () => {
		const html = '<h2>Título</h2><ol><li data-list="checked">Hecho</li></ol><p><strong>negrita</strong> y <em>cursiva</em></p>';
		expect(sanitizeNoteHtml(html)).toBe(html);
	});

	it('quita el selector de lenguajes que Quill filtraba en los bloques de código', () => {
		const out = sanitizeNoteHtml('<p>texto</p><p>PlainBashC++C#CSSDiffHTML/XMLJavaJavaScriptMarkdownPHPPythonRubySQL</p>');
		expect(out).toBe('<p>texto</p>');
	});

	it('normaliza los &nbsp; guardados antes del arreglo', () => {
		expect(sanitizeNoteHtml('<p>Escribir&nbsp;a&nbsp;la&nbsp;señora</p>')).toBe('<p>Escribir a la señora</p>');
	});

	it('nota vacía → cadena vacía', () => {
		expect(sanitizeNoteHtml('')).toBe('');
	});
});

describe('noteHtmlToText (vista previa y búsqueda)', () => {
	it('decodifica entidades: ya no se ve "&nbsp;" ni "&gt;"', () => {
		expect(noteHtmlToText('<p>whoami --&gt; nombre&nbsp;de&nbsp;usuario</p>')).toBe('whoami --> nombre de usuario');
	});

	it('separa párrafos y elementos de lista con espacio', () => {
		expect(noteHtmlToText('<p>Baño</p><ul><li>Espejo</li><li>Tuercas</li></ul>')).toBe('Baño Espejo Tuercas');
	});

	it('una frase con espacios se puede buscar', () => {
		const text = noteHtmlToText('<p>Guardado&nbsp;manual&nbsp;QA</p>').toLowerCase();
		expect(text.includes('guardado manual')).toBe(true);
	});

	it('no ejecuta código al generar la vista previa', async () => {
		noteHtmlToText(XSS + 'texto');
		expect(await xssRan()).toBe(false);
		document.body.removeAttribute('data-xss');
	});
});
