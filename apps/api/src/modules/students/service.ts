import type { PoolClient } from 'pg';
import { assertOptimisticLock } from '@dentpilot/domain';
import type { Principal } from '../../security/auth.js';
import { ApiProblem } from '../../security/errors.js';
import { AuthorizationService } from '../../security/authorization.js';
import { AuditService } from '../audit/service.js';

export class StudentsService {
  constructor(private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}
  async list(client: PoolClient, principal: Principal, departmentId?: string): Promise<unknown[]> { await this.authorization.assert(client,principal,'students:read',{departmentId}); const result=await client.query('SELECT s.id,s.student_number,s.display_name,s.status,s.revision FROM students s ORDER BY s.display_name'); return result.rows; }
  async closeEnrollment(client: PoolClient, principal: Principal, enrollmentId: string, expectedRevision: number, reason: string, correlationId: string): Promise<void> {
    const existing = await client.query<{revision:number; status:'ACTIVE'|'CLOSED'; student_id:string}>('SELECT revision,status,student_id FROM academic_enrollments WHERE id=$1 FOR UPDATE',[enrollmentId]);
    if (!existing.rowCount) throw new ApiProblem(404,'NOT_FOUND','Enrollment not found.');
    assertOptimisticLock(expectedRevision,existing.rows[0].revision); if (existing.rows[0].status !== 'ACTIVE') throw new ApiProblem(409,'ILLEGAL_TRANSITION','Enrollment is not active.');
    await this.authorization.assert(client,principal,'rosters:manage');
    await client.query("UPDATE roster_memberships SET status='CLOSED',closed_at=now(),reason=$2 WHERE enrollment_id=$1 AND status='ACTIVE'",[enrollmentId,reason]);
    await client.query("UPDATE group_memberships SET status='CLOSED',removed_at=now(),reason=$2 WHERE enrollment_id=$1 AND status='ACTIVE'",[enrollmentId,reason]);
    await client.query("UPDATE academic_enrollments SET status='CLOSED',closed_at=now(),close_reason=$2,revision=revision+1 WHERE id=$1",[enrollmentId,reason]);
    await this.audit.append(client,principal,{action:'ENROLLMENT_CLOSED',entityType:'academic_enrollment',entityId:enrollmentId,correlationId,reason});
  }
}
