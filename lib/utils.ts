import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"])
const KEEP_UPPER = new Set([
  "it",
  "hr",
  "am",
  "as",
  "ot",
  "sss",
  "tin",
  "bir",
  "dtr",
  "sil",
  "lwop",
  "gps",
  "pdf",
  "id",
])

/** Title-case names and nouns (Juan Dela Cruz, Quezon City). Not for UI chrome. */
export function toTitleCaseWords(value: string): string {
  return value.replace(/[A-Za-z]+(?:'[A-Za-z]+)*/g, (word) => {
    const lower = word.toLowerCase()
    if (NAME_SUFFIXES.has(lower)) {
      if (lower === "jr" || lower === "sr") {
        return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
      }
      return lower.toUpperCase()
    }
    if (KEEP_UPPER.has(lower)) return lower.toUpperCase()
    return lower
      .split("'")
      .map((part) =>
        part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part
      )
      .join("'")
  })
}