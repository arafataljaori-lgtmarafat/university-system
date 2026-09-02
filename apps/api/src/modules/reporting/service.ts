import type { PoolClient } from 'pg';
import type { AggregateReportDto } from '@dentpilot/contracts';
import type { Principal } from '../../security/auth.js';
import { AuthorizationService } from '../../security/authorization.js';

export class ReportingService {
  constructor(private readonly authorization: AuthorizationService) {}
  async aggregate(client: PoolClient, principal: Principal, academicYearId: string): Promise<AggregateReportDto> {
    await this.authorization.assert(client,principal,'reports:aggregate',{academicYearId});
    const scoped=principal.role==='UNIVERSITY_ADMIN'?null:await client.query<{department_id:string}>('SELECT DISTINCT department_id FROM account_scopes WHERE account_id=$1 AND department_id IS NOT NULL AND (academic_year_id IS NULL OR academic_year_id=$2)',[principal.accountId,academicYearId]);
    const departmentIds=scoped===null?null:scoped.rows.map((row)=>row.department_id);
    const students=await client.query<{count:string}>("SELECT count(DISTINCT ae.student_id) FROM academic_enrollments ae WHERE ae.academic_year_id=$1 AND ae.status='ACTIVE' AND ($2::uuid[] IS NULL OR EXISTS (SELECT 1 FROM roster_memberships rm JOIN rosters r ON r.id=rm.roster_id WHERE rm.enrollment_id=ae.id AND rm.status='ACTIVE' AND r.department_id=ANY($2::uuid[])))",[academicYearId,departmentIds]);
    const cases=await client.query<{count:string}>("SELECT count(*) FROM submission_snapshots ss JOIN case_sheets cs ON cs.id=ss.case_sheet_id AND cs.latest_snapshot_id=ss.id WHERE ss.academic_year_id=$1 AND ($2::uuid[] IS NULL OR ss.department_id=ANY($2::uuid[]))",[academicYearId,departmentIds]);
    const pending=await client.query<{count:string}>("SELECT count(*) FROM submission_snapshots ss JOIN case_sheets cs ON cs.id=ss.case_sheet_id AND cs.latest_snapshot_id=ss.id WHERE ss.academic_year_id=$1 AND cs.current_status IN ('SUBMITTED','REVISION_REQUESTED') AND ($2::uuid[] IS NULL OR ss.department_id=ANY($2::uuid[]))",[academicYearId,departmentIds]);
    return { organizationId:principal.organizationId, academicYearId, totalStudents:Number(students.rows[0].count), totalSubmittedCases:Number(cases.rows[0].count), pendingClinicalDecisions:Number(pending.rows[0].count), generatedAt:new Date().toISOString() };
  }
}
