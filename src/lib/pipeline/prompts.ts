/**
 * LLM prompts for the CV optimization pipeline.
 *
 * Designed for 2026 SOTA models (Opus 4.6, Sonnet 4.6, GPT-5.4+).
 * These prompts are concise, inject domain knowledge directly, and rely on
 * the model's native chain-of-thought rather than verbose hand-holding.
 *
 * Principles:
 * - Concise instructions, rich context — SOTA models need less repetition
 * - Inject actual domain knowledge (ATS internals, recruiter patterns, FAANG bar)
 * - Structured verification > repeated "don't hallucinate"
 * - Seniority-adaptive behavior at every layer
 * - Trust the model — no "act as a world-class X" theater
 */

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface FieldAnalysis {
  domain: string;
  seniority: "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | "executive";
  primarySkills: string[];
  yearsOfExperience: number | null;
  professionalYears: number | null; // full-time + part-time + contract + freelance (NOT internships)
  internshipYears: number | null;
  isCareerChanger: boolean;
  careerTrajectory: "ascending" | "lateral" | "pivoting" | "mixed";
  hasInternships: boolean;
  hasMixedExperience: boolean; // both internships and professional roles
}

export interface AiComment {
  text: string;
  fix?: string; // Concrete rewrite — the actual replacement text, not a description
  severity: "suggestion" | "important" | "critical";
  category: "impact" | "keywords" | "formatting" | "content" | "clarity" | "ats";
  bulletIndex?: number; // Pin to a specific bullet (0-indexed)
}

/** Stage 1 output. */
export interface ExtractedSections {
  fieldAnalysis: FieldAnalysis;
  sections: ExtractedSection[];
}

export interface ExtractedSection {
  type: string;
  title: string;
  content: string;
  entries?: ExtractedEntry[];
}

export interface ExtractedEntry {
  title?: string;
  organization?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  bullets?: string[];
  gpa?: string;
  degree?: string;
  field?: string;
  skills?: string[];
  level?: string;
  url?: string;
  relevance?: "high" | "medium" | "low";
  employmentType?: "full-time" | "internship" | "contract" | "freelance" | "part-time";
  durationMonths?: number;
}

/** Stage 2 output. */
export interface Keywords {
  jobTitle: string;
  equivalentTitles: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  softSkills: string[];
  industryKeywords: string[];
  experienceLevel: string;
  yearsRequired: number | null;
  educationRequirements: string[];
  certifications: string[];
  responsibilities: string[];
  dealbreakers: string[];
}

/** Stage 3 output. */
export interface OptimizationResult {
  sections: OptimizedSection[];
  scores: ScoreResult;
  keywordCoverage: {
    required: { matched: string[]; missing: string[] };
    preferred: { matched: string[]; missing: string[] };
  };
  structuralChanges?: string[];
}

export interface OptimizedSection {
  type: string;
  title: string;
  content: string;
  entries?: ExtractedEntry[];
  aiComments: AiComment[];
}

export interface ScoreResult {
  atsBefore: number;
  atsAfter: number;
  jobFitBefore: number;
  jobFitAfter: number;
  qualityBefore: number;
  qualityAfter: number;
  tierBefore: string;
  tierAfter: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeniorityGuidance(seniority: string): string {
  switch (seniority) {
    case "intern":
      return `SENIORITY — INTERN:
What wins: learning velocity, side projects, hackathons, coursework depth, initiative.
What kills: padding with fluff, claiming ownership you didn't have, listing every tech you've touched.
Technical depth > breadth. Show curiosity and shipping ability.
Include GPA if ≥3.5. Coursework and personal projects ARE your experience.
1 page MAX. Objective statement > professional summary at this level.
The bar: "this person learns fast, ships things, and won't need hand-holding."`;

    case "junior":
      return `SENIORITY — JUNIOR:
What wins: learning velocity, side projects, concrete deliverables from first roles, initiative, growth trajectory.
What kills: padding with fluff, inflating scope, claiming team-level impact you didn't drive.
If you have internships too — they show early commitment. Lead with full-time role achievements.
Technical depth > breadth. Show you can ship independently.
Include GPA if ≥3.5 and graduated within 2 years. Projects matter.
1 page MAX. Brief professional summary focusing on what you've built and where you're heading.
The bar: "this person is productive, growing fast, and delivers real work."`;

    case "mid":
      return `SENIORITY — MID-LEVEL:
What wins: feature ownership, cross-team collaboration, growing technical scope, mentoring juniors.
What kills: still sounding junior (task-level bullets), no evidence of autonomy, no quantified impact.
Show the transition: tasks → features → systems. Each role should show expanded scope.
Quantified impact is expected. "Improved latency" → "Reduced P99 latency by 200ms, improving conversion by 3%."
1 page strongly preferred. Professional summary replaces objective.
The bar: "this person delivers reliably and is clearly growing toward senior."`;

    case "senior":
      return `SENIORITY — SENIOR:
What wins: system-level thinking, architectural decisions, mentoring, cross-team influence, business impact.
What kills: still listing tasks, no evidence of technical leadership, no scope beyond your team.
Every bullet must show JUDGMENT, not just execution. Why you chose X over Y matters.
Quantified business impact is mandatory, not optional. Revenue, efficiency, reliability, scale.
1-2 pages. Summary must establish domain authority in 2 sentences.
The bar: "this person raises the bar for the entire team and makes others better."`;

    case "lead":
    case "principal":
      return `SENIORITY — ${seniority.toUpperCase()}:
What wins: technical strategy, org-wide systems, multi-team coordination, hiring/culture impact.
What kills: listing individual features, no evidence of multiplier effect, missing organizational context.
Decisions > implementations. "Defined the migration strategy for 40 services" > "migrated 3 services."
Hiring, mentoring pipelines, process improvements, and architectural standards matter.
Up to 2 pages. Summary is a leadership positioning statement.
The bar: "this person shapes how the organization builds software."`;

    case "executive":
      return `SENIORITY — EXECUTIVE:
What wins: P&L ownership, headcount growth, organizational transformation, board-level metrics.
What kills: technical minutiae, individual contributions, operational details.
Revenue, team scale, market position, strategic initiatives, partnerships.
Up to 2 pages. Summary is a leadership narrative, not a skills list.
The bar: "this person drives business outcomes through technology leadership."`;

    default:
      return "";
  }
}

function getSectionGuidance(sectionType: string): string {
  switch (sectionType) {
    case "summary":
      return `SECTION — SUMMARY:
Formula: [X years] + [domain expertise] + [signature strength] + [2-3 keywords] + [value prop]
2-3 sentences max. No first person. No "passionate/driven/results-oriented" — show, don't tell.
This is the 6-second hook. A recruiter decides whether to keep reading based on this alone.`;

    case "experience":
      return `SECTION — EXPERIENCE:
Each bullet: [Power Verb] + [what you did, at what scope] + [measurable result or business context]
3-5 bullets per role. Current role gets more, older roles fewer.
Kill duty-descriptions. "Responsible for managing deployments" → DELETE or rewrite as achievement.
Every role answers one question: "what was different because you were there?"`;

    case "education":
      return `SECTION — EDUCATION:
GPA: include only if ≥3.5/4.0 (or equivalent top-quartile at the institution).
Coursework: only for recent grads (≤2 years post-graduation). Senior+ candidates: omit.
Thesis/dissertation: include title for academic/research roles.
For senior+ candidates, education is 1-2 lines — it's just a credential check.`;

    case "skills":
      return `SECTION — SKILLS:
Categorize: Languages | Frameworks | Cloud/Infra | Databases | Tools | Methodologies.
Use industry-standard names ("PostgreSQL" not "Postgres", "Kubernetes" not "K8s").
Strongest/most relevant first in each category.
Drop skills assumed at this level (e.g., "Git" for senior+ engineers).
Discrete items only — no prose, no bars, no years-per-skill.`;

    case "projects":
      return `SECTION — PROJECTS:
Each project: [what it is] + [key technologies] + [outcome/scale/users]
Link to live demo or repo. Quantify: users, downloads, stars, performance.
Students: projects = experience. Treat them with the same rigor as work entries.
Senior+: only include if the project demonstrates something your roles don't.`;

    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// 1. Extract CV sections
// ---------------------------------------------------------------------------

export function extractSectionsPrompt(): string {
  return `Parse this CV into structured JSON. Your ONLY job is faithful extraction — do not improve, rephrase, or add anything.

RULES:
- Classify each section: personal_info, summary, experience, education, skills, projects, certifications, languages, interests, awards, publications, volunteer, references, custom.
- If content has no explicit heading but clearly belongs to a type (bullets under a company name = experience), infer the type.
- For entry-based sections (experience, education, projects, certifications, volunteer, publications, awards), decompose into individual entries with all available fields.
- Multiple roles at the same company → separate entries, not merged.
- For experience entries: classify employmentType as "full-time", "internship", "contract", "freelance", or "part-time" based on title, dates, and context. Default to "full-time" if unclear. Calculate durationMonths from start/end dates.
- Assess each entry's relevance to the candidate's primary field: "high" (core), "medium" (transferable), "low" (unrelated).
- If no summary/objective section exists, synthesize a 1-sentence placeholder from the CV's strongest signals. Tag it "[SYNTHESIZED]" at the start of content.

INPUT CLEANING:
- Strip PDF artifacts: page numbers, repeated headers/footers, watermarks.
- Fix obvious OCR errors: broken ligatures (ff→ff, fi→fi), garbled Unicode.
- Two-column layouts with interleaved text: re-linearize by column (left column first, then right).
- Preserve everything else verbatim.

FIELD ANALYSIS:
- domain: infer from job titles + skills + industry terms.
- seniority: Classify based on PROFESSIONAL experience — this includes full-time, part-time, contract, and freelance work. Internships do NOT count toward seniority.
  * intern: currently a student with ONLY internship experience (no professional roles)
  * junior: 0-2yr professional experience
  * mid: 2-5yr professional experience
  * senior: 5-10yr professional experience
  * lead: 8-12yr professional with evidence of team/tech leadership
  * principal: 12+yr professional with org-wide scope
  * executive: Director+/VP/C-level title
  CRITICAL: Part-time professional work COUNTS. A developer working part-time for 3 years at a company is NOT an intern — they're accumulating real professional experience. Only internships (explicitly labeled as internship/trainee positions) are excluded.
  A student who has 4 years of part-time professional work + some internships = MID, not junior.
  Use title + scope + responsibilities as supporting evidence alongside duration.
- primarySkills: top 5-10 by frequency and emphasis.
- yearsOfExperience: total calendar time from earliest start date to latest end date (includes all types). null if insufficient data.
- professionalYears (MUST use this exact key name, NOT "fullTimeYears"): total years of ALL professional work — full-time + part-time + contract + freelance. EXCLUDES internships only. Part-time roles count fully toward this number. Count overlapping roles only once. null if unknown.
- internshipYears: years spent in internship/trainee roles only. null if none.
- isCareerChanger: true if the candidate's recent roles are in a different domain than earlier ones.
- careerTrajectory: "ascending" (clear progression in scope/title), "lateral" (similar level moves), "pivoting" (switching domains), "mixed" (combination of internships + professional across domains).
- hasInternships: true if any role is an internship.
- hasMixedExperience: true if CV contains BOTH internships AND professional roles.

VERIFICATION: For every personal_info field (email, phone, linkedin, github, website, address), it must appear literally in the source text. If you cannot find it verbatim, omit the field entirely.
GITHUB / LINKEDIN: Store ONLY the username/handle, NOT the full URL. Strip "https://github.com/", "github.com/", "https://linkedin.com/in/", etc. Example: if CV says "github.com/johndoe", store "johndoe". If CV says "linkedin.com/in/janedoe", store "janedoe".

Output ONLY valid JSON, no fences:
{
  "fieldAnalysis": {
    "domain": "Software Engineering",
    "seniority": "mid",
    "primarySkills": ["Python", "AWS", "React"],
    "yearsOfExperience": 5,
    "professionalYears": 3,
    "internshipYears": 2,
    "isCareerChanger": false,
    "careerTrajectory": "ascending",
    "hasInternships": true,
    "hasMixedExperience": true
  },
  "sections": [
    {
      "type": "experience",
      "title": "Work Experience",
      "content": "<full raw text>",
      "entries": [
        {
          "title": "Software Engineer",
          "organization": "Acme Corp",
          "startDate": "Jan 2021",
          "endDate": "Present",
          "bullets": ["Built X resulting in Y"],
          "relevance": "high",
          "employmentType": "full-time",
          "durationMonths": 48
        }
      ]
    }
  ]
}

- "entries" only for entry-based section types. All others use "content" only.
- For personal_info: the "content" value MUST be a structured object (not a string): { "name": "John Doe", "email": "john@example.com", "github": "johndoe", "linkedin": "janedoe" }. Use ONLY the "content" key. Do NOT use a "fields" key — there is no "fields" key in the schema. GitHub and LinkedIn values must be ONLY the username — never include the domain (github.com, linkedin.com, etc.).
- Omit any field with no data. No nulls, no empty strings, no placeholders.

Parse:`;
}

// ---------------------------------------------------------------------------
// 2. Extract job description keywords
// ---------------------------------------------------------------------------

export function extractJobDescriptionKeywordsPrompt(jobDescription: string): string {
  return `Extract every hiring signal from this job description for ATS-optimized CV tailoring.

ATS DOMAIN KNOWLEDGE:
- Most ATS systems (Greenhouse, Lever, Workday, Taleo) do LITERAL string matching with basic stemming.
- "CI/CD pipelines" ≠ "continuous integration" to an ATS. Extract the EXACT phrases as written.
- Also include common synonyms/abbreviations alongside exact phrases (JD says "Kubernetes" → also include "K8s"; JD says "React.js" → also include "React").
- Section headings matter: ATS parses "Work Experience" but may miss "My Journey".
- Keyword density zones: ATS weights skills sections and recent experience most heavily.

EXTRACTION:
- jobTitle + equivalentTitles: extract the exact title, then generate 3-5 ATS-matchable variations.
- yearsRequired: parse to number (e.g., "5+ years" → 5). null if unstated.
- requiredSkills: explicitly required ("must have", "required", "X+ years of"). Extract EXACT JD phrasing.
- preferredSkills: nice-to-haves ("preferred", "bonus", "ideally", "a plus"). Exact phrasing.
- dealbreakers: non-negotiable criteria that cause instant rejection (visa requirements, mandatory certs, hard minimums).
- responsibilities: key job duties that CV bullets should mirror (ATS matches duty→achievement alignment).

Output ONLY valid JSON, no fences:
{
  "jobTitle": "<exact title from JD>",
  "equivalentTitles": ["<3-5 ATS-matchable variations>"],
  "requiredSkills": ["<exact JD phrasing for each required skill>"],
  "preferredSkills": ["<exact JD phrasing for nice-to-haves>"],
  "softSkills": ["<interpersonal skills mentioned>"],
  "industryKeywords": ["<domain terms, methodologies, architectural patterns>"],
  "experienceLevel": "<as stated>",
  "yearsRequired": 5,
  "educationRequirements": ["<as stated>"],
  "certifications": ["<as stated>"],
  "responsibilities": ["<key duties CV should address>"],
  "dealbreakers": ["<instant-reject criteria>"]
}

JOB DESCRIPTION:
${jobDescription}`;
}

// ---------------------------------------------------------------------------
// 3. General optimization (no JD provided)
// ---------------------------------------------------------------------------

export function generalOptimizationPrompt(fieldAnalysis: FieldAnalysis): string {
  return `No job description provided. Generate a keyword optimization profile for a competitive ${fieldAnalysis.seniority}-level ${fieldAnalysis.domain} professional targeting their next career move.

CANDIDATE:
- Domain: ${fieldAnalysis.domain}
- Seniority: ${fieldAnalysis.seniority}
- Skills: ${fieldAnalysis.primarySkills.join(", ")}
- Total experience: ${fieldAnalysis.yearsOfExperience ?? "unknown"} years
- Professional experience: ${fieldAnalysis.professionalYears ?? "unknown"} years
${fieldAnalysis.hasInternships ? `- Internship experience: ${fieldAnalysis.internshipYears ?? "some"} years\n` : ""}${fieldAnalysis.isCareerChanger ? "- Career changer — bridge transferable skills to new domain.\n" : ""}${fieldAnalysis.hasMixedExperience ? "- Mixed experience (internships + professional) — frame around professional years only.\n" : ""}
Think about what JDs for this person's next role actually look like. What do hiring managers at top companies write in their reqs? What separates hired candidates from rejected ones at this level? Use current 2025-2026 industry terminology.

${getSeniorityGuidance(fieldAnalysis.seniority)}

Output ONLY valid JSON matching the Keywords shape:
{
  "jobTitle": "<most likely target title>",
  "equivalentTitles": ["<3-5 variations>"],
  "requiredSkills": ${JSON.stringify(fieldAnalysis.primarySkills)},
  "preferredSkills": ["<6-10 complementary skills trending in ${fieldAnalysis.domain}>"],
  "softSkills": ["<4-6 relevant at ${fieldAnalysis.seniority} level>"],
  "industryKeywords": ["<8-12 current terms in ${fieldAnalysis.domain}>"],
  "experienceLevel": "${fieldAnalysis.seniority}",
  "yearsRequired": ${fieldAnalysis.yearsOfExperience ?? "null"},
  "educationRequirements": [],
  "certifications": ["<relevant but not required>"],
  "responsibilities": ["<5-8 core responsibilities at this level>"],
  "dealbreakers": []
}`;
}

// ---------------------------------------------------------------------------
// 4. Optimize and score CV
// ---------------------------------------------------------------------------

export function optimizeAndScoreCvPrompt(
  sections: string,
  keywords: string,
  fieldAnalysis: string,
  userNotes?: string,
): string {
  let fa: FieldAnalysis;
  try {
    fa = JSON.parse(fieldAnalysis);
  } catch {
    fa = {
      domain: "unknown",
      seniority: "mid",
      primarySkills: [],
      yearsOfExperience: null,
      professionalYears: null,
      internshipYears: null,
      isCareerChanger: false,
      careerTrajectory: "ascending",
      hasInternships: false,
      hasMixedExperience: false,
    };
  }

  return `Re-engineer this CV to maximize ATS pass-through rate, recruiter engagement, and interview conversion. Target: 95%+ on all metrics. Be aggressive — but never fabricate.

FIELD ANALYSIS:
${fieldAnalysis}

TARGET KEYWORDS:
${keywords}

CURRENT CV:
${sections}
${userNotes ? `
=== USER CORRECTIONS & ADDITIONAL CONTEXT ===
The candidate provided these notes. Treat them as GROUND TRUTH — they override anything in the CV data above.

${userNotes}

Apply ALL corrections and additions from the user's notes during optimization. For example:
- If they say they left a company, update the end date and remove "Present".
- If they mention extra skills/experience, integrate it into the relevant sections.
- If they correct a title, role, or detail, use the corrected version.
- If they provide specific metrics or context, incorporate them into bullets.
Flag each user-note-driven change in aiComments with applied=true so they can verify.
` : ''}
${getSeniorityGuidance(fa.seniority)}

=== OPTIMIZATION PROTOCOL ===

PASS 0 — CAREER INTELLIGENCE (do this FIRST, before any rewriting):
Analyze the candidate's career holistically before touching any content:

A) SENIORITY CALIBRATION:
   - Read the fieldAnalysis seniority, professionalYears, internshipYears, and careerTrajectory.
   - professionalYears includes ALL non-internship work: full-time, part-time, contract, freelance.
   - If hasInternships=true AND hasMixedExperience=true: the candidate has BOTH internships and professional roles.
     * Use professionalYears for seniority framing — this already excludes internships.
     * Frame summary and narrative around professional experience level, not total calendar time.
   - Use the correct title/seniority throughout. NEVER call someone "junior" if they have 3+ professionalYears.
     NEVER call someone "senior" if most of their experience is internships.
   - Preserve employer, title, and date boundaries exactly. Never merge achievements across roles or attribute a project to a different employer.

B) EXPERIENCE ORDERING STRATEGY:
   Determine the optimal ordering of entries within experience sections:
   - DEFAULT: Reverse chronological (most recent first) — this is what 95% of recruiters expect.
   - INTERNSHIPS: ${fa.hasInternships && fa.hasMixedExperience
    ? `This candidate has both internships and professional roles. Strategy:
     * If internships are in the SAME domain as professional work → keep them, but place AFTER all professional roles. They show early domain commitment.
     * If internships are in a DIFFERENT domain → significantly condense them (1 bullet each) or move to an "Early Career" subsection. They add noise.
     * If the candidate has 5+ professionalYears → drop internships entirely unless they're at a prestigious company or uniquely relevant.
     * NEVER interleave internships between professional roles chronologically — group them.`
    : "No mixed internship/full-time experience detected. Use standard reverse chronological."}
   - RELEVANCE OVERRIDE: If a JD is provided and an older role is MORE relevant than a recent one,
     keep reverse chronological but give the relevant role more bullets and the less relevant one fewer.

C) SECTION ORDERING STRATEGY:
   Determine optimal section order based on career stage:
   ${fa.seniority === "intern" || fa.seniority === "junior"
    ? "JUNIOR/INTERN: Education → Projects → Experience → Skills (education and projects ARE the experience)"
    : fa.seniority === "mid"
    ? "MID: Summary → Experience → Skills → Projects → Education"
    : "SENIOR+: Summary → Experience → Skills → Education (projects only if exceptionally relevant)"}
   Output sections in this order. The "order" field in each section controls display order.

D) ENTRY PRUNING:
   - Drop entries with relevance:"low" if the CV exceeds 1 page of content for junior/mid, 2 pages for senior+.
   - Condense very old roles (>10 years ago) to 1-2 bullets unless they contain unique, highly relevant experience.
   - NEVER drop entries without flagging in aiComments with the reason.

PASS 1 — SUMMARY:
Rewrite (or create) the professional summary using this formula:
"[X]-year [domain] [specialist/engineer/leader] with [signature strength]. [2-3 keyword-rich achievements]. [Value proposition]."
${fa.seniority === "intern" || fa.seniority === "junior" ? "For intern/junior: objective statement is fine. Lead with what you're seeking + what you bring." : "Establish authority in 2-3 sentences. No first person, no clichés ('passionate', 'results-driven')."}
CRITICAL: Use professionalYears (${fa.professionalYears ?? "unknown"}) for the "[X]-year" claim, NOT total yearsOfExperience. Internship years do not count.
${fa.hasMixedExperience ? `This candidate has mixed experience. Frame as: "${fa.professionalYears ?? "X"}-year ${fa.domain} professional" — do NOT add internship time to this number.` : ""}
Weave in 2-3 top required keywords naturally. This is the 6-second hook.

PASS 2 — KEYWORD INJECTION:
Cross-reference every keyword from the target list against the CV.
- Missing required keyword? Find the most natural home: an existing bullet, the skills list, or the summary. Mirror EXACT target phrasing — ATS does literal matching.
- Required keywords are non-negotiable. Every single one must appear somewhere.
- Preferred keywords: incorporate as many as naturally fit, don't force them.
- Skills section: list as discrete items, not buried in prose.
- NEVER keyword-stuff. Each keyword must appear in meaningful context.

PASS 3 — BULLET TRANSFORMATION:
Formula for every experience/project bullet:
  [Strong Verb] + [what you did, at what scope/scale] + [measurable result OR business context]

Verb blacklist: helped, assisted, worked on, was responsible for, participated in, contributed to, utilized, leveraged.
Verb upgrade: engineered, architected, spearheaded, drove, delivered, optimized, scaled, automated, orchestrated, reduced, launched, accelerated.

SENIORITY-APPROPRIATE VERBS:
${fa.seniority === "intern" || fa.seniority === "junior"
    ? "- Intern/Junior: developed, implemented, built, designed, created, integrated, tested, deployed. Avoid 'architected', 'spearheaded', 'led' unless literally true."
    : fa.seniority === "mid"
    ? "- Mid: designed, led, drove, delivered, optimized, built, automated. Show transition from task-executor to feature-owner."
    : "- Senior+: architected, spearheaded, established, scaled, mentored, drove, defined. Every bullet must show JUDGMENT and SCOPE."}

Metrics rules:
- Original has a specific number → PRESERVE IT EXACTLY. Make it bold-worthy.
- Original implies impact but no number → add qualitative result: "significantly reducing deployment time" or "enabling the team to ship 2x faster." NEVER INVENT A SPECIFIC NUMBER.
- If no hard metric exists, use verifiable scope markers from the source (service count, deployment frequency, team size, regions, customer segment, SLA, system surface, stack complexity) before vague adjectives.
- Duty-only bullet with no achievement → rewrite as achievement if possible, DELETE if not.
- Never upgrade internship, junior, or IC implementation work into leadership, architecture, or people-management ownership unless the source explicitly supports it.

Target 3-5 bullets per role. Most recent role gets the most. Consolidate overlapping bullets.
${fa.hasInternships ? "INTERNSHIP BULLETS: Keep to 1-3 bullets each. Focus on learning outcomes and concrete deliverables, not duties." : ""}

PASS 4 — ATS ARMOR:
- Headings: "Work Experience" (not "My Journey"), "Education" (not "Academic Background"), "Skills" (not "What I Know").
- Remove all first-person pronouns (I, my, me, we).
- Consistent date format: "Mon YYYY – Mon YYYY" or "Mon YYYY – Present" throughout.
- Spell out non-obvious acronyms once: "Natural Language Processing (NLP)".
- Skills as discrete comma-separated items in categorized groups.

PASS 5 — KEYWORD COVERAGE AUDIT:
After all changes, produce exact coverage:
- required.matched: which required keywords now appear in the CV
- required.missing: which ones you couldn't naturally include — each MUST be flagged as "critical" in the relevant section's aiComments
- preferred.matched / preferred.missing: same

PASS 6 — AI COMMENTS:
For EACH section, generate specific, actionable comments.

GOOD comment: "Replaced 'was responsible for deployments' with 'Orchestrated zero-downtime deployments across 12 microservices' — verify you used this exact deployment approach."
BAD comment: "Consider making this section more impactful." (← never output something this vague)

Include the "fix" field with the concrete rewrite when flagging something to verify.

CRITICAL — "applied" field:
- Set "applied": true when the change IS ALREADY IN the optimized content (e.g., you replaced a verb, added a keyword). The user just needs to verify/acknowledge.
- Set "applied": false when the comment is a SUGGESTION the user should act on (e.g., "Add a specific metric here if you know it", "Consider adding X keyword").
- If "applied" is true, the "fix" field shows what was already written. If false, "fix" shows what SHOULD be written.

CRITICAL — "question" field:
Every comment MUST include a personalized "question" — a specific, easy-to-answer question that helps the user provide the exact info needed.
- For applied=true (verify changes): ask about the specific fact you changed. Be precise.
  GOOD: "Did your team actually use event-driven architecture, or was it request-response?"
  GOOD: "Was the deployment really zero-downtime, or were there brief maintenance windows?"
  BAD: "Is this accurate?" (too vague)
- For applied=false (pending suggestions): ask for the specific data point you need to write a strong bullet.
  GOOD: "What was the latency before and after your Redis caching change? Even a rough estimate like '3x faster' works."
  GOOD: "How many microservices did your platform serve — roughly 10, 50, or 100+?"
  BAD: "Can you provide more details?" (too vague)
- Questions should be conversational, specific, and suggest answer formats (numbers, yes/no, rough ranges).

Severity:
- "critical": fabrication risk, missing dealbreaker keyword, or user MUST verify accuracy.
- "important": user could add a specific metric they know, or section is weaker than expected for this seniority.
- "suggestion": polish, alternative phrasing, nice-to-have keyword added.
Minimum 1 comment/section. Experience sections: 2-5 comments.

=== SCORING RUBRIC ===

ATS (0-100):
90-100: All required keywords present, standard headings, consistent dates, clean parseable structure.
75-89: Most keywords, minor heading/format issues.
60-74: Several required keywords missing, some non-standard headings.
40-59: Many missing keywords, significant format issues.
0-39: Fundamentally ATS-unfriendly (creative layout, missing sections, keyword-sparse).

Job Fit (0-100):
90-100: Seniority, domain, and skills precisely match. Responsibilities directly mirror the target.
75-89: Strong match, minor gaps (e.g., 4 years when 5 required, or missing 1 key skill).
60-74: Partial match — transferable skills evident but not a direct fit.
40-59: Tangentially related.
0-39: Major mismatch.

Quality (0-100):
90-100: Every bullet quantified or contextualized, strong verbs throughout, compelling narrative, zero filler.
75-89: Most bullets strong, minor filler.
60-74: Mixed — some achievements, some duty-lists.
40-59: Mostly generic.
0-39: Weak, duty-listing, no quantification.

Tier: S (90-100), A (75-89), B (60-74), C (40-59), D (0-39).
Score BEFORE (original) and AFTER (optimized).

=== TRUTH PROTOCOL ===
NEVER invent: companies, titles, degrees, dates, certifications, people.
NEVER fabricate: specific percentages, dollar amounts, user counts, team sizes, latency numbers.
MAY: rephrase, restructure, strengthen language, add qualitative impact, synthesize summary.
MAY: add "significantly", "substantially", "measurably" when context supports it.
When uncertain about a change: flag as "critical" in aiComments. Describe exactly what you changed.

Output ONLY valid JSON, no fences:
{
  "sections": [
    {
      "type": "experience",
      "title": "Work Experience",
      "content": "<full optimized text>",
      "entries": [{
        "title": "Senior Software Engineer",
        "organization": "Acme Corp",
        "startDate": "Jan 2021",
        "endDate": "Present",
        "bullets": [
          "Architected event-driven microservices platform processing 2M daily events, reducing system latency by 40%",
          "Led migration of monolithic billing system to distributed architecture, improving deployment frequency from monthly to daily"
        ],
        "relevance": "high",
        "employmentType": "full-time"
      }],
      "aiComments": [
        {
          "text": "Added 'event-driven' to bullet 1 per target keywords. Verify this accurately describes your architecture.",
          "fix": "Architected event-driven microservices platform processing 2M daily events",
          "severity": "important",
          "category": "keywords",
          "bulletIndex": 0,
          "applied": true,
          "question": "Was your microservices platform actually event-driven (e.g., Kafka, RabbitMQ), or was it REST/gRPC request-response?"
        },
        {
          "text": "Bullet 3 lacks a metric. If you know the latency improvement, add it.",
          "fix": "Reduced API response latency from 450ms to 120ms by implementing Redis caching layer",
          "severity": "important",
          "category": "impact",
          "bulletIndex": 2,
          "applied": false,
          "question": "What was the API latency before and after your caching change? Even a rough estimate like '3x faster' or 'under 200ms' is great."
        }
      ]
    }
  ],
  "scores": {
    "atsBefore": 45, "atsAfter": 93,
    "jobFitBefore": 52, "jobFitAfter": 88,
    "qualityBefore": 38, "qualityAfter": 91,
    "tierBefore": "C", "tierAfter": "S"
  },
  "keywordCoverage": {
    "required": { "matched": ["Python", "AWS", "Kubernetes"], "missing": ["Terraform"] },
    "preferred": { "matched": ["GraphQL"], "missing": ["Rust"] }
  },
  "structuralChanges": [
    "Reordered experience: full-time roles first, internships grouped at end",
    "Condensed 2 early internships from 4 bullets to 2 bullets each",
    "Set section order: Summary → Experience → Skills → Projects → Education"
  ]
}`;
}

// ---------------------------------------------------------------------------
// 5. Generate LaTeX
// ---------------------------------------------------------------------------

export function generateLatexPrompt(
  optimizedCv: string,
  templateName: string,
  templateSource: string,
  targetPageCount: number,
): string {
  return `Convert this optimized CV JSON into a compilable LaTeX document using the ${templateName} template.

TEMPLATE SOURCE — study its GUARDRAILS box, \\newcommand definitions, placeholder markers ({{NAME}}, {{EXPERIENCE}}, etc.), and package declarations carefully:
${templateSource}

CV JSON:
${optimizedCv}

TARGET PAGE COUNT: ${targetPageCount}

RULES:

1. TEMPLATE FIDELITY (CRITICAL — violations cause build rejection):
   Use the template's custom commands (\\expentry, \\eduentry, \\projentry, \\awardentry, \\achievementbox, etc.) EXACTLY as defined.
   Do NOT \\renewcommand, \\def, or redefine any command from the template.
   Do NOT add \\definecolor, \\colorlet, \\color{}, \\columncolor, \\cellcolor, colored rules, or any color commands not already in the template.
   Do NOT add packages not already in the template (no tikz, tcolorbox, fancyhdr, colortbl, tabularx, etc.).
   Do NOT change the font (\\usepackage{...font...}), \\familydefault, or \\fontenc from the template.

   Do NOT add \\titleformat, \\titlespacing, \\setlist, or \\pagestyle overrides — the template handles all styling.
   Replace {{PLACEHOLDER}} markers with CV content. Remove entire sections (heading + content) when CV has no matching data. Never leave empty sections or unreplaced placeholders.

2. CONTENT PRIORITY:
   Preserve all high-relevance and recent material by default.
   If the document cannot fit within ${targetPageCount} page(s), condense or remove only the least relevant material first: low-relevance entries, verbose older bullets, duplicated project detail, and early internship material.
   Never drop the current role, summary, skills, education credentials, or quantified high-impact achievements.

3. VISUAL TREATMENT:
   Bold all metrics: \\textbf{40\\%}, \\textbf{\\$2M}, \\textbf{10K+ users}.
   URLs must be \\href{url}{display text}. Shorten display text to prevent margin overflow.
   Classic template only — every \\item in an itemize MUST begin with \\RaggedRight (from ragged2e). Skills MUST use \\textbf{Category:} items \\\\ per category line.

4. SPECIAL CHARACTERS — escape in ALL content text (NOT in LaTeX commands):
   & → \\&  |  % → \\%  |  $ → \\$  |  # → \\#  |  _ → \\_
   Common: C# → C\\#, C++ → C++ (ok as-is), AT&T → AT\\&T, .NET → .NET (ok)

5. PAGE MANAGEMENT:
   HARD LIMIT: ${targetPageCount} page(s). This is mandatory, not aspirational. The compiled PDF MUST be exactly ${targetPageCount} page(s).
   The template already defines optimal margins, font size, and list spacing — do NOT override them.
   If content overflows, cut material in this order: old internships, verbose bullets on older roles, low-relevance projects, duplicate details.
   NEVER exceed the page limit. It is better to cut low-value content than to overflow.
   Never truncate mid-sentence or drop high-relevance content.

6. COMPILATION:
   All \\begin{} matched with \\end{}. All braces balanced. All packages declared. Must compile with latexmk -pdf.

CONTACT INFO — GITHUB & LINKEDIN:
   The template already wraps {{GITHUB}} and {{LINKEDIN}} in \href with the full domain. The placeholder value must be the bare username ONLY (e.g., "johndoe", NOT "github.com/johndoe"). If the CV JSON has a full URL, strip the domain prefix.

ANTI-HALLUCINATION:
Include ONLY content from the CV JSON. Do not add, invent, or rephrase. Only include contact info (LinkedIn, GitHub) that exists in the JSON. No filler text.

Output ONLY complete LaTeX source. No fences, no commentary. Starts with \\documentclass, ends with \\end{document}.`;
}

// ---------------------------------------------------------------------------
// 6. Refine LaTeX (visual polish)
// ---------------------------------------------------------------------------

export function refineLatexPrompt(
  latex: string,
  targetPageCount: number,
  currentPageCount?: number,
): string {
  return `Page-fit pass. The document currently compiles to ${currentPageCount ?? "too many"} page(s). HARD LIMIT: ${targetPageCount} page(s). This is a strict constraint — the output MUST compile to exactly ${targetPageCount} page(s) or fewer.

${latex}

ACTION PLAN (apply in order until it fits):

1. Shorten all \\href display text to bare minimum (e.g., "GitHub" not "github.com/user/repo").
2. Compress the contact/header row: \\small font, \\enspace separators.
3. Reduce \\vspace in entry commands to 2-3pt. Reduce \\titlespacing before sections to 4pt.
4. If STILL overflowing: remove the LEAST important entries. Candidates for removal (in order):
   - Old internships (>3 years ago)
   - Projects with low relevance
   - Verbose bullet points on older roles (condense to 1-2 bullets)
   - Certifications and awards that don't relate to the target role
   Never remove: current role, skills section, education credentials, summary/objective.
5. SPACING CONSISTENCY: Same gap before every \\section. No orphan headings. No widow lines.

STRICT CONSTRAINTS (violations cause build rejection):
- Do NOT redefine, \\renewcommand, or \\def any existing commands (\\expentry, \\eduentry, \\projentry, \\achievementbox, \\awardentry, etc.).
- Do NOT add \\definecolor, \\colorlet, \\color{}, \\columncolor, \\cellcolor, colored rules, or any color commands not already present.
- Do NOT add packages not already in the source (no tikz, tcolorbox, fancyhdr, colortbl, tabularx, etc.).
- Do NOT change the font package, \\familydefault, or \\fontenc.
- Do NOT add \\titleformat or \\setlist overrides — the template defines all styling.
- Preserve the document's visual identity exactly — only change spacing values and content.

DO NOT invent or rewrite facts. You MUST hit ${targetPageCount} page(s) — this is not best-effort.

Output ONLY complete LaTeX. No fences. \\documentclass → \\end{document}.`;
}

// ---------------------------------------------------------------------------
// 7. Extract LaTeX errors
// ---------------------------------------------------------------------------

export function extractLatexErrorsPrompt(log: string): string {
  return `Parse this latexmk compilation log. Extract errors and critical warnings.

${log}

RULES:
- Errors: lines with "!" or "Error:". Extract line number (from "l.XX"), message, snippet.
- Warnings: only "LaTeX Warning:" that affects output (undefined refs, missing packages). Ignore font substitution, overfull hbox <30pt, informational messages.
- Root-cause grouping: a missing \\end{itemize} cascades into multiple errors. Report ONLY the root cause.
- For each error, include the LIKELY CAUSE and FIX HINT in the message.

CV-specific patterns to watch for:
- Unescaped % (from "40%") → "\\%"
- Unescaped # (from "C#") → "\\#"
- Unescaped & (from "AT&T") → "\\&"
- Unescaped $ (from "$2M") → "\\$"
- Undefined command (\\experienceentry should be \\expentry per template)

Output JSON only:
{
  "errors": [
    {
      "line": 42,
      "message": "Undefined control sequence '\\\\experienceentry'. Should be '\\\\expentry' per template.",
      "snippet": "\\\\experienceentry{Acme Corp}",
      "severity": "error"
    }
  ],
  "summary": "<1-2 sentence summary>"
}

No errors: { "errors": [], "summary": "Compilation successful." }`;
}

// ---------------------------------------------------------------------------
// 8. Fix LaTeX errors
// ---------------------------------------------------------------------------

export function fixLatexErrorsPrompt(latex: string, errors: string): string {
  return `Fix ALL compilation errors. Surgical, minimal changes only — fix what's broken, touch nothing else.

LATEX:
${latex}

ERRORS:
${errors}

COMMON FIXES:
  "50% increase"          →  "50\\% increase"
  "AT&T"                  →  "AT\\&T"
  "C#"                    →  "C\\#"
  "$2M revenue"           →  "\\$2M revenue"
  "\\textbf{Name"          →  "\\textbf{Name}"
  "\\experienceentry"      →  "\\expentry" (match template's \\newcommand)
  missing \\end{itemize}   →  add after last \\item
  missing \\item in list   →  add \\item before content
  missing package          →  add \\usepackage{} to preamble
  overfull hbox from URL   →  shorten display text in \\href

POST-FIX VERIFY: All \\begin=\\end matched. All {} balanced. All packages declared.
DO NOT modify text content. DO NOT change fonts, colors, packages, or command definitions. Only fix compilation errors.

Output ONLY fixed LaTeX. No fences. \\documentclass → \\end{document}.`;
}

// ---------------------------------------------------------------------------
// 9. Refine a single section
// ---------------------------------------------------------------------------

export function refineSectionPrompt(
  section: string,
  sectionType: string,
  userInstructions: string,
  aiComments: string,
  requestMode: "rewrite" | "ask" = "rewrite",
  cvContext?: string,
): string {
  const guidance = getSectionGuidance(sectionType);

  return `${requestMode === "ask" ? "Answer a question about this CV section." : "Refine this single CV section."}${userInstructions ? " User has specific instructions — they are ABSOLUTE PRIORITY." : ""}

SECTION TYPE: ${sectionType}
REQUEST MODE: ${requestMode}
CURRENT CONTENT:
${section}
${cvContext ? `\nFULL CV CONTEXT (other sections — do not modify, use for coherence):\n${cvContext}\n` : ""}${aiComments ? `PREVIOUS AI COMMENTS (unresolved issues):\n${aiComments}\n` : ""}${userInstructions ? `USER INSTRUCTIONS (override everything else):\n${userInstructions}\n` : ""}${guidance ? `\n${guidance}\n` : ""}
RULES:
1. User instructions override all other guidelines.
2. Address unresolved critical/important AI comments.
3. Strengthen verbs, kill filler, ensure ATS-friendly format.
4. Add quantitative impact ONLY where the original supports it. Never invent numbers.
5. If user asks to add unverifiable info, include it but flag as "critical" with "User-provided — verify accuracy."
6. If REQUEST MODE is "ask", answer in "assistantMessage", keep "content" identical to CURRENT CONTENT, and do not create a new rewrite draft.
7. If REQUEST MODE is "rewrite", produce the best rewrite you can within the truth constraints.

TRUTH: Never invent facts, metrics, companies, dates, or titles. Preserve all factual details exactly.

Output JSON only:
{
  "type": "${sectionType}",
  "title": "<heading>",
  "content": "<full refined text>",
  "entries": [{ ... }],
  "assistantMessage": "<brief explanation of what changed, what stayed the same, or an answer to the user's question>",
  "changeSummary": [
    "Condensed the summary from 4 lines to 2 while keeping the same factual claims.",
    "Left the second bullet unchanged because no verifiable metric was present."
  ],
  "aiComments": [
    {
      "text": "Replaced 'was responsible for' with 'Orchestrated' in bullet 2. Verify scope is accurate.",
      "fix": "Orchestrated cross-team deployment pipeline serving 40+ microservices",
      "severity": "important",
      "category": "impact",
      "bulletIndex": 1,
      "applied": true,
      "question": "Did you orchestrate the pipeline yourself or as part of a team? And was it really 40+ microservices, or a different number?"
    }
  ]
}

Omit "entries" for non-entry sections (summary, skills, personal_info, languages, interests).
Every aiComment must describe a SPECIFIC change. No generic praise, no vague suggestions.
Always include "assistantMessage" and "changeSummary". If almost nothing changed, say so explicitly.`;
}
