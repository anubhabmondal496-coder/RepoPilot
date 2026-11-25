import { z } from 'zod';

/**
 * Zod Schemas for RepoPilot Agent Brain and Verification Layer
 * Conforming to Diagram.png specifications.
 */

// 1. Bug Verification Schema
export const BugSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const BugItemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  category: z.enum(['security', 'dependency', 'gitignore', 'contract', 'syntax', 'general']),
  file: z.string(),
  line: z.number().int().nonnegative().optional(),
  description: z.string(),
  severity: BugSeveritySchema,
  suggestedFix: z.string().optional(),
  autoFixable: z.boolean().default(true)
});

export const BugReportSchema = z.object({
  scannedAt: z.string(),
  workspaceRoot: z.string(),
  totalBugs: z.number().int().nonnegative(),
  bugs: z.array(BugItemSchema)
});

export type BugItem = z.infer<typeof BugItemSchema>;
export type BugReport = z.infer<typeof BugReportSchema>;

// 2. API Route Contract Schema
export const ApiRouteContractSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
  path: z.string(),
  sourceFile: z.string(),
  line: z.number().int().nonnegative().optional(),
  matchedByFrontend: z.boolean().default(false),
  parameters: z.array(z.string()).default([])
});

export const ContractReportSchema = z.object({
  backendRoutes: z.array(ApiRouteContractSchema),
  frontendCalls: z.array(z.object({
    method: z.string(),
    url: z.string(),
    sourceFile: z.string(),
    line: z.number().int().nonnegative().optional()
  })),
  missingRoutes: z.array(z.string()),
  unmatchedFrontendCalls: z.array(z.string()),
  isHealthy: z.boolean()
});

export type ApiRouteContract = z.infer<typeof ApiRouteContractSchema>;
export type ContractReport = z.infer<typeof ContractReportSchema>;

// 3. Technical Project Specs & Architecture Schema
export const ProjectSpecsSchema = z.object({
  title: z.string(),
  tagline: z.string().optional(),
  summary: z.string(),
  techStack: z.array(z.string()),
  architectureDiagramUrl: z.string().url().optional(),
  routes: z.array(z.object({
    endpoint: z.string(),
    method: z.string(),
    description: z.string().optional()
  })).default([]),
  hardwarePins: z.array(z.object({
    pin: z.string(),
    function: z.string(),
    type: z.string().optional()
  })).default([]),
  quickstart: z.array(z.string()).default([])
});

export type ProjectSpecs = z.infer<typeof ProjectSpecsSchema>;

// 4. AI Judge Q&A Schema
export const JudgeQnAItemSchema = z.object({
  id: z.string(),
  question: z.string(),
  category: z.enum(['Architecture', 'Security', 'Scalability', 'Viability', 'Hard Questions']),
  expectedAnswer: z.string(),
  rubricCriteria: z.array(z.string()),
  weight: z.number().min(1).max(10).default(5)
});

export const JudgeSessionSchema = z.object({
  projectName: z.string(),
  generatedAt: z.string(),
  overallScoreTarget: z.number().min(0).max(100).default(90),
  questions: z.array(JudgeQnAItemSchema)
});

export type JudgeQnAItem = z.infer<typeof JudgeQnAItemSchema>;
export type JudgeSession = z.infer<typeof JudgeSessionSchema>;

// 5. Hackathon Portal Submission Schema (Playwright Automator)
export const PortalSubmissionSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  tagline: z.string().max(120, 'Tagline should be concise (<= 120 chars)'),
  description: z.string().min(20, 'Description must be comprehensive'),
  repositoryUrl: z.string().url('Valid Git repository URL required'),
  demoUrl: z.string().url().optional().or(z.literal('')),
  videoUrl: z.string().url().optional().or(z.literal('')),
  tracks: z.array(z.string()).default([]),
  techStack: z.array(z.string()),
  builtWith: z.array(z.string()).default([]),
  submittedAt: z.string().optional()
});

export type PortalSubmission = z.infer<typeof PortalSubmissionSchema>;

// 6. Safe Validation Utilities
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): { success: boolean; data: T; errors?: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errorMessages = result.error.issues.map((e) => `${e.path.map(String).join('.')}: ${e.message}`);
  return { success: false, data: fallback, errors: errorMessages };
}
