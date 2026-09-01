import type { PoolClient } from 'pg';
import { assertTermResultTransition } from '@dentpilot/domain';
import type { Principal } from '../../security/auth.js';
import { ApiProblem } from '../../security/errors.js';
import { AuthorizationService } from '../../security/authorization.js';
import { AuditService } from '../audit/service.js';

export class ResultsService {
  constructor(private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}
  async transition(client: PoolClient, principal: Principal, closureId: string, target: 'REVIEWED'|'APPROVED'|'LOCKED'|'REOPENED', reason: string | undefined, correlationId: string): Promise<void> {
    const result=await client.query<{status:'DRAFT'|'REVIEWED'|'APPROVED'|'LOCKED'|'REOPENED';department_id:string}>('SELECT status,department_id FROM term_result_closures WHERE id=$1 FOR UPDATE',[closureId]); if(!result.rowCount) throw new ApiProblem(404,'NOT_FOUND','Term result closure not found.'); const row=result.rows[0];
    await this.authorization.assert(client,principal,target==='LOCKED'?'term-results:lock':'term-results:approve',{departmentId:row.department_id}); assertTermResultTransition(row.status,target,reason);
    await client.query('UPDATE term_result_closures SET status=$2,revision=revision+1,updated_at=now(),approved_by_account_id=CASE WHEN $2=\'APPROVED\' THEN $3 ELSE approved_by_account_id END,locked_by_account_id=CASE WHEN $2=\'LOCKED\' THEN $3 ELSE locked_by_account_id END,reopened_by_account_id=CASE WHEN $2=\'REOPENED\' THEN $3 ELSE reopened_by_account_id END,reopen_reason=CASE WHEN $2=\'REOPENED\' THEN $4 ELSE reopen_reason END WHERE id=$1',[closureId,target,principal.accountId,reason??null]);
    await this.audit.append(client,principal,{action:`TERM_RESULT_${target}`,entityType:'term_result_closure',entityId:closureId,departmentId:row.department_id,correlationId,reason});
  }
}
