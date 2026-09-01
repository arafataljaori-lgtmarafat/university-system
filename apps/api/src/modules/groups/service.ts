import type { PoolClient } from 'pg';
import { assertGroupMembership } from '@dentpilot/domain';
import type { Principal } from '../../security/auth.js';
import { ApiProblem } from '../../security/errors.js';
import { AuthorizationService } from '../../security/authorization.js';
import { AuditService } from '../audit/service.js';

export class GroupsService {
  constructor(private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}
  async assignMembership(client: PoolClient, principal: Principal, input: { groupId:string; enrollmentId:string; departmentId:string; studentId:string; correlationId:string }): Promise<void> {
    await this.authorization.assert(client,principal,'groups:manage',{departmentId:input.departmentId});
    const policy=await client.query<{mode:'FULL_COHORT'|'GROUPS_ENABLED'}>('SELECT mode FROM department_distribution_policies WHERE department_id=$1 AND organization_id=$2',[input.departmentId,principal.organizationId]);
    if (!policy.rowCount) throw new ApiProblem(404,'NOT_FOUND','Distribution policy not found.');
    const existing=await client.query('SELECT id FROM group_memberships WHERE enrollment_id=$1 AND department_id=$2 AND status=\'ACTIVE\' FOR UPDATE',[input.enrollmentId,input.departmentId]);
    assertGroupMembership(policy.rows[0].mode,existing.rowCount ?? 0);
    if (existing.rowCount) await client.query("UPDATE group_memberships SET status='REMOVED',removed_at=now(),reason='Moved within department distribution' WHERE id=$1",[existing.rows[0].id]);
    await client.query('INSERT INTO group_memberships(organization_id,group_id,department_id,student_id,enrollment_id) VALUES($1,$2,$3,$4,$5)',[principal.organizationId,input.groupId,input.departmentId,input.studentId,input.enrollmentId]);
    await this.audit.append(client,principal,{action:'GROUP_MEMBERSHIP_ASSIGNED',entityType:'group_membership',departmentId:input.departmentId,correlationId:input.correlationId});
  }
}
