import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { FilesService } from '../../apps/api/src/modules/files/service.js';
import { AuthorizationService } from '../../apps/api/src/security/authorization.js';
import type { Principal } from '../../apps/api/src/security/auth.js';
import type { IdempotencyService } from '../../apps/api/src/infrastructure/idempotency.js';
import type { ObjectStorage } from '../../apps/api/src/infrastructure/object-storage.js';

const owner:Principal={accountId:'11111111-1111-4111-8111-111111111119',organizationId:'11111111-1111-4111-8111-111111111111',collegeId:'11111111-1111-4111-8111-111111111112',role:'DEPARTMENT_ADMIN',departmentIds:['11111111-1111-4111-8111-111111111114']};
const other={...owner,accountId:'11111111-1111-4111-8111-111111111120'};
const storage={createObjectKey:()=>`${owner.organizationId}/opaque`,signedUpload:async()=>({url:'http://signed-upload',requiredHeaders:{}}),signedRead:async()=>('http://signed-read')} as unknown as ObjectStorage;
const idempotency={run:async(_client:unknown,_principal:unknown,command:{execute:()=>Promise<unknown>;responseStatus:number})=>({body:await command.execute(),responseStatus:command.responseStatus,replayed:false})} as unknown as IdempotencyService;

describe('file object authorization',()=>{
  it('returns a file ID but never exposes a raw object key',async()=>{
    const client={query:async()=>({rows:[{id:'11111111-1111-4111-8111-111111111199'}],rowCount:1})} as unknown as PoolClient;
    const result=await new FilesService(new AuthorizationService(),idempotency,storage).presignUpload(client,owner,{contentType:'application/pdf',byteSize:10,sha256:'a'.repeat(64),idempotencyKey:'file-test-key-0001'});
    expect(result.fileId).toBeTruthy(); expect(result).not.toHaveProperty('objectKey');
  });

  it('allows the creating account to read its private file',async()=>{
    const client={query:async()=>({rows:[{object_key:`${owner.organizationId}/opaque`,created_by_account_id:owner.accountId,snapshot_id:null,department_id:null,supervisor_assignment_id:null}],rowCount:1})} as unknown as PoolClient;
    await expect(new FilesService(new AuthorizationService(),idempotency,storage).presignRead(client,owner,'11111111-1111-4111-8111-111111111199')).resolves.toEqual({readUrl:'http://signed-read',expiresInSeconds:300});
  });

  it('hides an unattached private file from another tenant account',async()=>{
    const client={query:async()=>({rows:[{object_key:`${owner.organizationId}/opaque`,created_by_account_id:owner.accountId,snapshot_id:null,department_id:null,supervisor_assignment_id:null}],rowCount:1})} as unknown as PoolClient;
    await expect(new FilesService(new AuthorizationService(),idempotency,storage).presignRead(client,other,'11111111-1111-4111-8111-111111111199')).rejects.toMatchObject({statusCode:404,code:'NOT_FOUND'});
  });
});
