import type { PoolClient } from 'pg';
import type { AggregateReportDto } from '@dentpilot/contracts';
import type { Principal } from '../../security/auth.js';
import { AuthorizationService } from '../../security/authorization.js';

export class ReportingService {
  constructor(private readonly authorization: AuthorizationService) {}
  async aggregate(client: PoolClient, principal: Principal, academicYearId: string): Promise<AggregateReportDto> {
    await this.authorization.assert(client,principal,'reports:aggregate');
    const students=await client.query<{count:string}>('SELECT count(*) FROM students WHERE status=\'ACTIVE\'');
    const cases=await client.query<{count:string}>('SELECT count(*) FROM submission_snapshots WHERE status IN (\'SUBMITTED\',\'REVISION_REQUESTED\',\'APPROVED_START\',\'APPROVED_FINAL\',\'GRADED\')');
    const pending=await client.query<{count:string}>('SELECT count(*) FROM submission_snapshots WHERE status IN (\'SUBMITTED\',\'REVISION_REQUESTED\')');
    return { organizationId:principal.organizationId, academicYearId, totalStudents:Number(students.rows[0].count), totalSubmittedCases:Number(cases.rows[0].count), pendingClinicalDecisions:Number(pending.rows[0].count), generatedAt:new Date().toISOString() };
  }
}
