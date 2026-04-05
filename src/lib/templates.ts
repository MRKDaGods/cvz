export type TemplateId = "classic" | "modern" | "executive" | "academic"

export interface CvTemplateOption {
  id: TemplateId
  name: string
  description: string
  bestFor: string
}

export const DEFAULT_TEMPLATE_ID: TemplateId = "classic"

export const CV_TEMPLATE_OPTIONS: CvTemplateOption[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Single column, clean, minimal. Jake's Resume style and the safest ATS baseline.",
    bestFor: "Most roles",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Two-column layout with a compact skills rail. Best when space efficiency matters.",
    bestFor: "Mid-level engineers",
  },
  {
    id: "executive",
    name: "Executive",
    description: "More whitespace, a stronger summary, and a leadership-first reading order.",
    bestFor: "Senior, staff, and leadership",
  },
  {
    id: "academic",
    name: "Academic",
    description: "Education, projects, and publications are surfaced earlier for research-heavy profiles.",
    bestFor: "Students and researchers",
  },
]

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && CV_TEMPLATE_OPTIONS.some((template) => template.id === value)
}

export function getTemplateOption(templateId: string | null | undefined): CvTemplateOption {
  return CV_TEMPLATE_OPTIONS.find((template) => template.id === templateId) ?? CV_TEMPLATE_OPTIONS[0]
}