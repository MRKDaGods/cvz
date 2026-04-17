import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const SECTION_TITLE_FALLBACKS: Record<string, string> = {
  personal_info: "Personal Info",
  contact: "Contact",
  summary: "Professional Summary",
  objective: "Objective",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  publications: "Publications",
  volunteer: "Volunteer Experience",
  interests: "Interests",
  languages: "Languages",
  other: "Other",
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface SectionContentPayload {
  content: unknown
  entries?: unknown[]
}

function isSectionContentPayload(value: unknown): value is SectionContentPayload {
  return !!value && typeof value === "object" && "content" in value
}

/**
 * Strip markdown code fences (```json ... ```) from LLM responses.
 * Returns the inner content if fences are found, otherwise the original text.
 */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return text;
  // Remove opening fence line (```json, ```latex, etc.)
  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline === -1) return text;
  let inner = trimmed.slice(firstNewline + 1);
  // Remove closing fence
  if (inner.trimEnd().endsWith("```")) {
    inner = inner.trimEnd().slice(0, -3);
  }
  return inner.trim();
}

/**
 * Extract a JSON object from a possibly dirty LLM response.
 * Tries stripCodeFences first, then falls back to finding the first { ... } block.
 */
export function extractJSON(text: string): Record<string, unknown> {
  // Try the clean path first
  const stripped = stripCodeFences(text);
  try {
    return JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    // Fall through
  }

  // Find the first balanced { ... } block (brace-counting).
  // This handles cases where the LLM outputs JSON then repeats it.
  const start = text.indexOf("{");
  if (start === -1) throw new SyntaxError("No JSON object found in response");

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
      }
    }
  }

  // Fallback: first { to last } (original behaviour)
  const end = text.lastIndexOf("}");
  if (end > start) {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  }

  throw new SyntaxError("No JSON object found in response");
}

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  return []
}

export function formatSectionTitle(type: unknown): string {
  const rawType = typeof type === "string" ? type.trim() : ""
  if (!rawType) return "Untitled"

  const normalizedType = rawType.toLowerCase()
  const mapped = SECTION_TITLE_FALLBACKS[normalizedType]
  if (mapped) return mapped

  return normalizedType
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Untitled"
}

export function normalizeSectionTitle(title: unknown, type: unknown): string {
  const normalizedTitle = typeof title === "string" ? title.trim() : ""
  return normalizedTitle || formatSectionTitle(type)
}

export function parseSectionContent(value: unknown): SectionContentPayload {
  if (typeof value !== "string") {
    return isSectionContentPayload(value)
      ? {
          content: value.content,
          entries: Array.isArray(value.entries) ? value.entries : undefined,
        }
      : { content: value }
  }

  const trimmed = value.trim()
  if (!trimmed) return { content: "" }

  try {
    const parsed = JSON.parse(trimmed)
    if (isSectionContentPayload(parsed)) {
      return {
        content: parsed.content,
        entries: Array.isArray(parsed.entries) ? parsed.entries : undefined,
      }
    }

    return { content: parsed }
  } catch {
    return { content: value }
  }
}

export function serializeSectionContent(content: unknown, entries?: unknown[]): string {
  const payload: SectionContentPayload = { content }
  if (Array.isArray(entries) && entries.length > 0) {
    payload.entries = entries
  }
  return JSON.stringify(payload)
}

export function formatSectionContentPreview(value: unknown): string {
  const payload = parseSectionContent(value)
  const content = payload.content
  const entries = payload.entries

  // If we have structured entries, prefer those over raw content text
  // (the LLM returns both: "content" as raw text + "entries" as structured data)
  const hasEntries = Array.isArray(entries) && entries.length > 0

  const parts: string[] = []

  // Format main content — skip if entries exist (they contain the same info)
  if (!hasEntries && content != null) {
    if (typeof content === "string") {
      const trimmed = content.trim()
      if (trimmed) {
        // Try to parse as JSON object for personal_info style content
        try {
          const parsed = JSON.parse(trimmed)
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            parts.push(formatObjectAsLines(parsed))
          } else {
            parts.push(trimmed)
          }
        } catch {
          parts.push(trimmed)
        }
      }
    } else if (typeof content === "object" && content !== null) {
      // Structured content (e.g. personal_info fields)
      parts.push(formatObjectAsLines(content as Record<string, unknown>))
    }
  }

  // Format entries (experience, education, projects, etc.)
  if (hasEntries) {
    for (const entry of entries) {
      if (entry && typeof entry === "object") {
        parts.push(formatEntryPreview(entry as Record<string, unknown>))
      }
    }
  }

  return parts.filter(Boolean).join("\n\n")
}

function formatObjectAsLines(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, " $1")
      if (Array.isArray(v)) return `${label}: ${v.join(", ")}`
      return `${label}: ${String(v)}`
    })
    .join("\n")
}

function formatEntryPreview(entry: Record<string, unknown>): string {
  const lines: string[] = []

  // Title line: "Software Engineer at Acme Corp" or "Project Name"
  const title = entry.title ?? entry.degree ?? entry.name ?? entry.position ?? entry.role
  const org = entry.organization ?? entry.company ?? entry.institution ?? entry.school
  if (title && org) {
    lines.push(`${title} — ${org}`)
  } else if (title) {
    lines.push(String(title))
  } else if (org) {
    lines.push(String(org))
  }

  // Date range + location
  const dateParts: string[] = []
  if (entry.startDate) {
    dateParts.push(String(entry.startDate))
    dateParts.push("–")
    dateParts.push(entry.endDate ? String(entry.endDate) : "Present")
  }
  if (entry.location) dateParts.push(`· ${entry.location}`)
  if (dateParts.length > 0) lines.push(dateParts.join(" "))

  // Field / GPA for education
  if (entry.field) lines.push(String(entry.field))
  if (entry.gpa) lines.push(`GPA: ${entry.gpa}`)

  // URL for projects/publications
  if (typeof entry.url === "string" && entry.url.trim()) lines.push(entry.url.trim())
  if (typeof entry.link === "string" && entry.link.trim()) lines.push(entry.link.trim())

  // Technologies for projects
  const tech = entry.technologies ?? entry.tech ?? entry.techStack ?? entry.stack
  if (Array.isArray(tech) && tech.length > 0) {
    lines.push(`Tech: ${tech.join(", ")}`)
  } else if (typeof tech === "string" && tech.trim()) {
    lines.push(`Tech: ${tech.trim()}`)
  }

  // Description / content
  if (typeof entry.description === "string" && entry.description.trim()) {
    lines.push(entry.description.trim())
  } else if (typeof entry.content === "string" && entry.content.trim()) {
    lines.push(entry.content.trim())
  }

  // Bullets
  if (Array.isArray(entry.bullets)) {
    for (const b of entry.bullets) {
      if (typeof b === "string" && b.trim()) lines.push(`• ${b.trim()}`)
    }
  }

  // Links (e.g. project repos)
  if (Array.isArray(entry.links)) {
    for (const l of entry.links) {
      if (typeof l === "string" && l.trim()) lines.push(l.trim())
    }
  }

  // Skills list
  if (Array.isArray(entry.skills) && entry.skills.length > 0) {
    lines.push(`Skills: ${entry.skills.join(", ")}`)
  }

  return lines.join("\n")
}
