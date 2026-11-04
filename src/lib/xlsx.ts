// Generador mínimo de archivos Excel (.xlsx) en el navegador, sin dependencias.
// Un .xlsx es un ZIP con XML (SpreadsheetML). Aquí se escribe el ZIP sin compresión.

export type CellValue = string | number | Date | null | undefined;
export type CellKind = 'text' | 'money' | 'date' | 'percent';

export interface SheetColumn {
	header: string;
	width?: number; // ancho en caracteres
	kind?: CellKind;
}

export interface Sheet {
	name: string;
	/** filas de título encima de la tabla (texto en negrita) */
	title?: string[];
	columns: SheetColumn[];
	rows: CellValue[][];
	/** fila final en negrita (ej. totales) */
	totals?: CellValue[];
}

// Índices de estilo (deben coincidir con cellXfs en styles.xml)
const S = { text: 0, header: 1, money: 2, date: 3, percent: 4, title: 5, totalText: 6, totalMoney: 7, subtitle: 8 };

const esc = (v: string) =>
	v
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		// caracteres de control no válidos en XML
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function colName(i: number): string {
	let n = i + 1;
	let s = '';
	while (n > 0) {
		const r = (n - 1) % 26;
		s = String.fromCharCode(65 + r) + s;
		n = Math.floor((n - 1) / 26);
	}
	return s;
}

/** Fecha → número de serie de Excel (días desde 1899-12-30), sin desfase de zona horaria */
function excelDate(d: Date): number {
	const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
	return utc / 86400000 + 25569;
}

function cell(ref: string, value: CellValue, style: number): string {
	if (value === null || value === undefined || value === '') return style ? `<c r="${ref}" s="${style}"/>` : '';
	if (value instanceof Date) return `<c r="${ref}" s="${style}"><v>${excelDate(value)}</v></c>`;
	if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
	return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`;
}

const styleFor = (kind: CellKind | undefined) =>
	kind === 'money' ? S.money : kind === 'date' ? S.date : kind === 'percent' ? S.percent : S.text;

function sheetXml(sheet: Sheet, filterRanges: string[]): string {
	const rows: string[] = [];
	let r = 0;

	for (const [i, line] of (sheet.title ?? []).entries()) {
		r++;
		rows.push(`<row r="${r}">${cell(`A${r}`, line, i === 0 ? S.title : S.subtitle)}</row>`);
	}
	if (sheet.title?.length) r++; // fila en blanco

	r++;
	const headerRow = r;
	rows.push(
		`<row r="${r}">${sheet.columns.map((c, i) => cell(`${colName(i)}${r}`, c.header, S.header)).join('')}</row>`
	);

	for (const data of sheet.rows) {
		r++;
		rows.push(
			`<row r="${r}">${sheet.columns.map((c, i) => cell(`${colName(i)}${r}`, data[i], styleFor(c.kind))).join('')}</row>`
		);
	}
	const lastDataRow = r;

	if (sheet.totals) {
		r++;
		rows.push(
			`<row r="${r}">${sheet.columns
				.map((c, i) => cell(`${colName(i)}${r}`, sheet.totals![i], c.kind === 'money' ? S.totalMoney : S.totalText))
				.join('')}</row>`
		);
	}

	const lastCol = colName(sheet.columns.length - 1);
	const cols = sheet.columns
		.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`)
		.join('');
	const hasFilter = sheet.rows.length > 0;
	filterRanges.push(hasFilter ? `$A$${headerRow}:$${lastCol}$${lastDataRow}` : '');
	const filter = hasFilter ? `<autoFilter ref="A${headerRow}:${lastCol}${lastDataRow}"/>` : '';

	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
		`<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
		`<cols>${cols}</cols>` +
		`<sheetData>${rows.join('')}</sheetData>` +
		filter +
		'</worksheet>'
	);
}

const STYLES =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
	'<numFmts count="3">' +
	'<numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0;[Red]&quot;-$&quot; #,##0"/>' +
	'<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>' +
	'<numFmt numFmtId="166" formatCode="0.0%"/>' +
	'</numFmts>' +
	'<fonts count="4">' +
	'<font><sz val="11"/><name val="Calibri"/></font>' +
	'<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
	'<font><b/><sz val="14"/><name val="Calibri"/></font>' +
	'<font><b/><sz val="11"/><name val="Calibri"/></font>' +
	'</fonts>' +
	'<fills count="4">' +
	'<fill><patternFill patternType="none"/></fill>' +
	'<fill><patternFill patternType="gray125"/></fill>' +
	'<fill><patternFill patternType="solid"><fgColor rgb="FF0B624C"/></patternFill></fill>' +
	'<fill><patternFill patternType="solid"><fgColor rgb="FFE6F4EE"/></patternFill></fill>' +
	'</fills>' +
	'<borders count="2"><border/><border><top style="thin"><color rgb="FF0B624C"/></top></border></borders>' +
	'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
	'<cellXfs count="9">' +
	'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' + // 0 texto
	'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' + // 1 encabezado
	'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 2 dinero
	'<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 3 fecha
	'<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + // 4 porcentaje
	'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + // 5 título
	'<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' + // 6 total texto
	'<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' + // 7 total dinero
	'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' + // 8 subtítulo
	'</cellXfs>' +
	'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
	'</styleSheet>';

function workbookFiles(sheets: Sheet[]): Record<string, string> {
	const filterRanges: string[] = [];
	const sheetXmls = sheets.map((s) => sheetXml(s, filterRanges));
	// Excel limita nombres de hoja a 31 caracteres y prohíbe : \ / ? * [ ]
	const names = sheets.map((s, i) => (s.name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || `Hoja${i + 1}`));
	const files: Record<string, string> = {
		'[Content_Types].xml':
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
			'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
			'<Default Extension="xml" ContentType="application/xml"/>' +
			'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
			'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
			sheets
				.map(
					(_, i) =>
						`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
				)
				.join('') +
			'</Types>',
		'_rels/.rels':
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
			'</Relationships>',
		'xl/workbook.xml':
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
			`<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
			(filterRanges.some(Boolean)
				? `<definedNames>${filterRanges
						.map((ref, i) =>
							ref
								? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i].replace(/'/g, "''"))}'!${ref}</definedName>`
								: ''
						)
						.join('')}</definedNames>`
				: '') +
			'</workbook>',
		'xl/_rels/workbook.xml.rels':
			'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
			'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
			sheets
				.map(
					(_, i) =>
						`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
				)
				.join('') +
			`<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
			'</Relationships>',
		'xl/styles.xml': STYLES
	};
	sheetXmls.forEach((xml, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = xml));
	return files;
}

// ---------- ZIP (método "store", sin compresión) ----------

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(data: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function zip(files: Record<string, string>): Uint8Array {
	const enc = new TextEncoder();
	const now = new Date();
	const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
	const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const [name, content] of Object.entries(files)) {
		const nameBytes = enc.encode(name);
		const data = enc.encode(content);
		const crc = crc32(data);

		const local = new Uint8Array(30 + nameBytes.length + data.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		lv.setUint16(4, 20, true);
		lv.setUint16(6, 0x0800, true); // nombres en UTF-8
		lv.setUint16(8, 0, true); // store
		lv.setUint16(10, dosTime, true);
		lv.setUint16(12, dosDate, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, data.length, true);
		lv.setUint32(22, data.length, true);
		lv.setUint16(26, nameBytes.length, true);
		lv.setUint16(28, 0, true);
		local.set(nameBytes, 30);
		local.set(data, 30 + nameBytes.length);
		locals.push(local);

		const central = new Uint8Array(46 + nameBytes.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true);
		cv.setUint16(6, 20, true);
		cv.setUint16(8, 0x0800, true);
		cv.setUint16(10, 0, true);
		cv.setUint16(12, dosTime, true);
		cv.setUint16(14, dosDate, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, data.length, true);
		cv.setUint32(24, data.length, true);
		cv.setUint16(28, nameBytes.length, true);
		cv.setUint32(42, offset, true);
		central.set(nameBytes, 46);
		centrals.push(central);

		offset += local.length;
	}

	const centralSize = centrals.reduce((s, c) => s + c.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, centrals.length, true);
	ev.setUint16(10, centrals.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);

	const out = new Uint8Array(offset + centralSize + end.length);
	let p = 0;
	for (const part of [...locals, ...centrals, end]) {
		out.set(part, p);
		p += part.length;
	}
	return out;
}

export function buildXlsx(sheets: Sheet[]): Uint8Array {
	return zip(workbookFiles(sheets));
}

export function downloadXlsx(filename: string, sheets: Sheet[]) {
	const bytes = buildXlsx(sheets);
	const blob = new Blob([bytes as BlobPart], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
