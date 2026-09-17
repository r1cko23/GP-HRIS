/**
 * Green / white Finance sheet chrome — matches GP-Client cutoff / transmittal export.
 * Uses xlsx-js-style (RGB hex without alpha prefix).
 */

import type { WorkSheet } from "xlsx-js-style";
import XLSX from "xlsx-js-style";

/** Palette aligned with GP-Client payroll-cutoff-export-excel.ts */
export const GP_SHEET = {
  titleFill: "E8F5E9",
  titleText: "1B5E20",
  headerFill: "2E7D32",
  headerText: "FFFFFF",
  metaLabelFill: "ECEFF1",
  metaLabelText: "37474F",
  metaValueFill: "FFFFFF",
  metaValueText: "263238",
  zebra: "F5F7FA",
  white: "FFFFFF",
  border: "B0BEC5",
  totalsFill: "E8F5E9",
  totalsText: "1B5E20",
  bodyText: "263238",
  sectionFill: "455A64",
} as const;

const thin = (rgb = GP_SHEET.border) => ({
  style: "thin" as const,
  color: { rgb },
});

export const gpBorderAll = {
  top: thin(),
  left: thin(),
  bottom: thin(),
  right: thin(),
};

function solidFill(rgb: string) {
  return { patternType: "solid" as const, fgColor: { rgb } };
}

export function styleTitleCell(cell: XLSX.CellObject | undefined) {
  if (!cell) return;
  cell.s = {
    font: { bold: true, sz: 14, color: { rgb: GP_SHEET.titleText } },
    fill: solidFill(GP_SHEET.titleFill),
    alignment: { vertical: "center", horizontal: "left", indent: 1 },
  };
}

export function styleMetaLabelCell(cell: XLSX.CellObject | undefined) {
  if (!cell) return;
  cell.s = {
    font: { bold: true, sz: 10, color: { rgb: GP_SHEET.metaLabelText } },
    fill: solidFill(GP_SHEET.metaLabelFill),
    alignment: { vertical: "center", horizontal: "left", indent: 1 },
    border: gpBorderAll,
  };
}

export function styleMetaValueCell(cell: XLSX.CellObject | undefined) {
  if (!cell) return;
  cell.s = {
    font: { sz: 10, color: { rgb: GP_SHEET.metaValueText } },
    fill: solidFill(GP_SHEET.metaValueFill),
    alignment: { vertical: "center", horizontal: "left", indent: 1 },
    border: gpBorderAll,
  };
}

export function styleHeaderRow(
  ws: WorkSheet,
  rowIndex0: number,
  colCount: number
) {
  for (let c = 0; c < colCount; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex0, c });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 10, color: { rgb: GP_SHEET.headerText } },
      fill: solidFill(GP_SHEET.headerFill),
      alignment: {
        vertical: "center",
        horizontal: "center",
        wrapText: true,
      },
      border: gpBorderAll,
    };
  }
}

export function styleDataRows(
  ws: WorkSheet,
  startRow0: number,
  endRow0Inclusive: number,
  colCount: number,
  opts?: { moneyCols?: Set<number>; textCols?: Set<number> }
) {
  const moneyCols = opts?.moneyCols ?? new Set<number>();
  const textCols = opts?.textCols ?? new Set<number>();
  for (let r = startRow0; r <= endRow0Inclusive; r += 1) {
    const zebra = (r - startRow0) % 2 === 1;
    const fill = zebra ? GP_SHEET.zebra : GP_SHEET.white;
    for (let c = 0; c < colCount; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      let cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell) {
        cell = { t: "s", v: "" };
        ws[addr] = cell;
      }
      const isMoney = moneyCols.has(c) && typeof cell.v === "number";
      const isText = textCols.has(c) || typeof cell.v === "string";
      cell.s = {
        font: { sz: 10, color: { rgb: GP_SHEET.bodyText } },
        fill: solidFill(fill),
        alignment: {
          vertical: "center",
          horizontal: isText && !isMoney ? "left" : "right",
          indent: isText && !isMoney ? 1 : 0,
        },
        border: gpBorderAll,
        ...(isMoney ? { numFmt: "#,##0.00" } : {}),
      };
    }
  }
}

export function styleTotalsRow(
  ws: WorkSheet,
  rowIndex0: number,
  colCount: number,
  opts?: { moneyCols?: Set<number> }
) {
  const moneyCols = opts?.moneyCols ?? new Set<number>();
  for (let c = 0; c < colCount; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex0, c });
    let cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) {
      cell = { t: "s", v: "" };
      ws[addr] = cell;
    }
    const isMoney = moneyCols.has(c) && typeof cell.v === "number";
    cell.s = {
      font: { bold: true, sz: 10, color: { rgb: GP_SHEET.totalsText } },
      fill: solidFill(GP_SHEET.totalsFill),
      alignment: {
        vertical: "center",
        horizontal: isMoney ? "right" : "left",
        indent: isMoney ? 0 : 1,
      },
      border: gpBorderAll,
      ...(isMoney ? { numFmt: "#,##0.00" } : {}),
    };
  }
}

export function styleSectionBanner(
  ws: WorkSheet,
  rowIndex0: number,
  colCount: number
) {
  for (let c = 0; c < colCount; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: rowIndex0, c });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, sz: 11, color: { rgb: GP_SHEET.headerText } },
      fill: solidFill(GP_SHEET.sectionFill),
      alignment: { vertical: "center", horizontal: "left", indent: 1 },
      border: gpBorderAll,
    };
  }
}

/** Ensure !ref covers styled range. */
export function ensureSheetRef(
  ws: WorkSheet,
  rowCount: number,
  colCount: number
) {
  if (rowCount <= 0 || colCount <= 0) return;
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rowCount - 1, c: colCount - 1 },
  });
}

export function setColWidths(ws: WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

/**
 * Size columns from cell content so Excel opens without dragging to see values.
 * Caps width so wide sheets stay usable.
 */
export function autofitColWidths(
  ws: WorkSheet,
  opts?: {
    min?: number;
    max?: number;
    pad?: number;
    colCount?: number;
    /** Prefer these widths when larger than content (e.g. money columns). */
    floors?: number[];
  }
) {
  const min = opts?.min ?? 8;
  const max = opts?.max ?? 42;
  const pad = opts?.pad ?? 2;
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const colCount = opts?.colCount ?? range.e.c - range.s.c + 1;
  const floors = opts?.floors ?? [];
  const widths: number[] = [];
  for (let c = 0; c < colCount; c += 1) {
    let maxLen = floors[c] ?? min;
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as
        | XLSX.CellObject
        | undefined;
      if (!cell || cell.v == null || cell.v === "") continue;
      let s: string;
      if (typeof cell.v === "number") {
        s = cell.v.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else {
        s = String(cell.v);
      }
      maxLen = Math.max(maxLen, [...s].length + pad);
    }
    widths.push(Math.min(max, Math.max(min, maxLen)));
  }
  setColWidths(ws, widths);
}

/**
 * Style a typical report table sheet:
 * optional title at (0,0), header row, data rows, optional totals row.
 */
export function applyGpTableSheetStyles(
  ws: WorkSheet,
  input: {
    titleRow?: number;
    headerRow: number;
    dataStartRow: number;
    dataEndRow: number;
    totalsRow?: number;
    colCount: number;
    moneyCols?: number[];
    textCols?: number[];
    colWidths?: number[];
  }
) {
  const money = new Set(input.moneyCols ?? []);
  const text = new Set(input.textCols ?? []);
  if (input.titleRow != null) {
    styleTitleCell(
      ws[XLSX.utils.encode_cell({ r: input.titleRow, c: 0 })] as
        | XLSX.CellObject
        | undefined
    );
  }
  styleHeaderRow(ws, input.headerRow, input.colCount);
  if (input.dataEndRow >= input.dataStartRow) {
    styleDataRows(ws, input.dataStartRow, input.dataEndRow, input.colCount, {
      moneyCols: money,
      textCols: text,
    });
  }
  if (input.totalsRow != null) {
    styleTotalsRow(ws, input.totalsRow, input.colCount, { moneyCols: money });
  }
  if (input.colWidths) setColWidths(ws, input.colWidths);
  ensureSheetRef(
    ws,
    Math.max(
      input.totalsRow ?? 0,
      input.dataEndRow,
      input.headerRow,
      input.titleRow ?? 0
    ) + 1,
    input.colCount
  );
}
