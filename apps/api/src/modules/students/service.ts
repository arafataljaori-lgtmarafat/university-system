import type { PoolClient } from 'pg';
import { assertOptimisticLock } from '@dentpilot/domain';
import type { Principal } from '../../security/auth.js';
import { ApiProblem } from '../../security/errors.js';
import { AuthorizationService } from '../../security/authorization.js';
import { AuditService } from '../audit/service.js';
import { IdempotencyService } from '../../infrastructure/idempotency.js';

export class StudentsService {
  constructor(private readonly authorization: AuthorizationService, private readonly audit: AuditService, private readonly idempotency: IdempotencyService) {}
  async list(client: PoolClient, principal: Principal, departmentId?: string): Promise<unknown[]> {
    await this.authorization.assert(client,principal,'students:read',{departmentId});
    const result=await client.query('SELECT DISTINCT s.id,s.student_number,s.display_name,s.status,s.revision FROM students s LEFT JOIN academic_enrollments ae ON ae.student_id=s.id AND ae.status=\'ACTIVE\' LEFT JOIN roster_memberships rm ON rm.enrollment_id=ae.id AND rm.status=\'ACTIVE\' LEFT JOIN rosters r ON r.id=rm.roster_id AND r.status=\'ACTIVE\' WHERE $1::boolean OR EXISTS (SELECT 1 FROM account_scopes ac WHERE ac.account_id=$2 AND ac.department_id=r.department_id AND (ac.academic_year_id IS NULL OR ac.academic_year_id=r.academic_year_id) AND (ac.academic_level_id IS NULL OR ac.academic_level_id=r.academic_level_id) AND (ac.cohort_id IS NULL OR ac.cohort_id=r.cohort_id) AND ($3::uuid IS NULL OR r.department_id=$3)) ORDER BY s.display_name',[principal.role==='UNIVERSITY_ADMIN',principal.accountId,departmentId ?? null]);
    return result.rows;
  }
  async closeEnrollment(client: PoolClient, principal: Principal, enrollmentId: string, expectedRevision: number, reason: string, idempotencyKey: string, correlationId: string): Promise<void> {
    await this.idempotency.run(client, principal, {
      key: idempotencyKey,
      operation: 'enrollment.close',
      request: { enrollmentId, expectedRevision, reason },
      responseStatus: 204,
      execute: async () => {
    const existing = await client.query<{revision:number; status:'ACTIVE'|'CLOSED'; student_id:string;academic_year_id:string;academic_level_id:string;cohort_id:string}>('SELECT revision,status,student_id,academic_year_id,academic_level_id,cohort_id FROM academic_enrollments WHERE id=$1 FOR UPDATE',[enrollmentId]);
    if (!existing.rowCount) throw new ApiProblem(404,'NOT_FOUND','Enrollment not found.');
    assertOptimisticLock(expectedRevision,existing.rows[0].revision); if (existing.rows[0].status !== 'ACTIVE') throw new ApiProblem(409,'ILLEGAL_TRANSITION','Enrollment is not active.');
    const rosters=await client.query<{department_id:string}>('SELECT r.department_id FROM roster_memberships rm JOIN rosters r ON r.id=rm.roster_id WHERE rm.enrollment_id=$1 AND rm.status=\'ACTIVE\' AND r.status=\'ACTIVE\' FOR UPDATE OF r',[enrollmentId]);
    if (principal.role!=='UNIVERSITY_ADMIN' && !rosters.rowCount) throw new ApiProblem(403,'FORBIDDEN','An enrollment without an active roster requires university authority.');
    for (const departmentId of new Set(rosters.rows.map((roster)=>roster.department_id))) await this.authorization.assert(client,principal,'rosters:manage',{departmentId,academicYearId:existing.rows[0].academic_year_id,academicLevelId:existing.rows[0].academic_level_id,cohortId:existing.rows[0].cohort_id});
    await client.query("UPDATE roster_memberships SET status='CLOSED',closed_at=now(),reason=$2 WHERE enrollment_id=$1 AND status='ACTIVE'",[enrollmentId,reason]);
    await client.query("UPDATE group_memberships SET status='CLOSED',removed_at=now(),reason=$2 WHERE enrollment_id=$1 AND status='ACTIVE'",[enrollmentId,reason]);
    await client.query("UPDATE academic_enrollments SET status='CLOSED',closed_at=now(),close_reason=$2,revision=revision+1 WHERE id=$1",[enrollmentId,reason]);
    await this.audit.append(client,principal,{action:'ENROLLMENT_CLOSED',entityType:'academic_enrollment',entityId:enrollmentId,correlationId,reason});
        return {};
      },
    });
  }
}
