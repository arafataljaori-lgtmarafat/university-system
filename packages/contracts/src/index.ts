export const API_PREFIX = '/api/v1';

export type ErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'CSRF_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'ACCOUNT_DISABLED'
  | 'INVITATION_INVALID'
  | 'IMMUTABLE_RECORD'
  | 'ILLEGAL_TRANSITION';

export interface ApiError {
  error: { code: ErrorCode; message: string; requestId: string; details?: Record<string, string[]> };
}

export interface SessionActorDto {
  accountId: string;
  organizationId: string;
  collegeId: string;
  role: 'UNIVERSITY_ADMIN' | 'DEPARTMENT_ADMIN' | 'CLINICAL_SUPERVISOR' | 'STUDENT_INTEGRATION';
  departmentIds: string[];
}

export interface AggregateReportDto {
  organizationId: string;
  academicYearId: string;
  totalStudents: number;
  totalSubmittedCases: number;
  pendingClinicalDecisions: number;
  generatedAt: string;
}

export interface StudentSubmissionDto {
  snapshotId: string;
  status: 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED_START' | 'APPROVED_FINAL' | 'GRADED';
  submittedAt: string;
  studentVisibleFeedback?: string;
}

export interface CreateDraftInput {
  templateVersionId: string;
  enrollmentId: string;
  payload: Record<string, unknown>;
}

export interface SubmitCaseInput {
  idempotencyKey: string;
  draftId: string;
}

export interface GradeCaseInput {
  grade: number;
  comment: string;
  idempotencyKey: string;
}

export interface AmendGradeInput extends GradeCaseInput {
  reason: string;
}

export interface ReopenTermResultInput {
  reason: string;
  idempotencyKey: string;
}
