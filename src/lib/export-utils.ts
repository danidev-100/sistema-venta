import * as XLSX from "xlsx";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type ExportColumn = {
  header: string;
  key: string;
};

// ──────────────────────────────────────────────
// PDF Export (via browser print dialog)
// ──────────────────────────────────────────────

function buildTableHtml(
  headers: string[],
  rows: string[][],
  title: string,
): string {
  const headerRow = headers
    .map((h) => `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #000;font-size:12px;font-weight:bold;">${h}</th>`)
    .join("");

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:4px 10px;border-bottom:1px solid #ccc;font-size:11px;">${cell}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; padding: 20px; color: #000; }
    h1 { font-size: 16px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    @media print { body { padding: 10px; } button { display: none; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

function printHtml(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "none";
  iframe.title = "print-frame";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.log("print error:", err);
    }
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 500);
}

export function exportTableToPdf<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  title: string,
): void {
  const headers = columns.map((c) => c.header);
  const rows = data.map((item) =>
    columns.map((c) => {
      const val = item[c.key];
      return val == null ? "—" : String(val);
    }),
  );

  const html = buildTableHtml(headers, rows, title);
  printHtml(html);
}

// ──────────────────────────────────────────────
// Excel Export
// ──────────────────────────────────────────────

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
): void {
  const headers = columns.map((c) => c.header);
  const rows = data.map((item) =>
    columns.map((c) => {
      const val = item[c.key];
      return val == null ? "" : val;
    }),
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");

  const safeName = filename.replace(/[<>:"/\\|?*]/g, "_");
  XLSX.writeFile(wb, `${safeName}.xlsx`);
}
