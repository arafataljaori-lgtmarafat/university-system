import type { PoolClient } from 'pg';
import type { Principal } from './auth.js';
import { ApiProblem } from './errors.js';

export type Permission = 'students:read' | 'rosters:manage' | 'groups:manage' | 'requirements:publish' | 'cases:review' | 'cases:grade' | 'term-results:approve' | 'term-results:lock' | 'reports:aggregate' | 'files:access';
const rolePermissions: Record<Principal['role'], readonly Permission[]> = {
  UNIVERSITY_ADMIN: ['students:read','rosters:manage','groups:manage','requirements:publish','cases:review','cases:grade','term-results:approve','term-results:lock','reports:aggregate','files:access'],
  DEPARTMENT_ADMIN: ['students:read','rosters:manage','groups:manage','requirements:publish','reports:aggregate','files:access'],
  CLINICAL_SUPERVISOR: ['students:read','cases:review','cases:grade','files:access'],
  STUDENT_INTEGRATION: ['files:access'],
};

export class AuthorizationService {
  async assert(client: PoolClient, principal: Principal, permission: Permission, context: { departmentId?: string; assignmentId?: string; assignmentPermission?: 'reviewCases' | 'grade'; studentId?: string } = {}): Promise<void> {
    if (!rolePermissions[principal.role].includes(permission)) throw new ApiProblem(403, 'FORBIDDEN', 'Permission denied.');
    if (context.departmentId && principal.role !== 'UNIVERSITY_ADMIN' && !principal.departmentIds.includes(context.departmentId)) throw new ApiProblem(403, 'FORBIDDEN', 'Department scope denied.');
    if (principal.role === 'STUDENT_INTEGRATION' && context.studentId && context.studentId !== principal.studentId) throw new ApiProblem(403, 'FORBIDDEN', 'Student ownership denied.');
    if (context.assignmentPermission && principal.role === 'CLINICAL_SUPERVISOR') {
      const assignment = await client.query<{granted:boolean}>('SELECT sap.granted FROM supervisor_assignments sa JOIN supervisor_assignment_permissions sap ON sap.assignment_id=sa.id WHERE sa.id=$1 AND sa.supervisor_account_id=$2 AND sa.status=\'ACTIVE\' AND sap.permission=$3', [context.assignmentId,principal.accountId,context.assignmentPermission]);
      if (assignment.rows[0]?.granted !== true) throw new ApiProblem(403, 'FORBIDDEN', 'Assignment permission denied.');
    }
  }
}
