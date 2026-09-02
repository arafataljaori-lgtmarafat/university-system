import type { PoolClient } from 'pg';
import type { Principal } from '../../security/auth.js';
import { AuthorizationService } from '../../security/authorization.js';
import { ApiProblem } from '../../security/errors.js';
import { IdempotencyService } from '../../infrastructure/idempotency.js';
import { ObjectStorage } from '../../infrastructure/object-storage.js';

interface PresignUploadInput {
  contentType: string;
  byteSize: number;
  sha256: string;
  idempotencyKey: string;
}

interface PresignUploadOutput {
  fileId: string;
  uploadUrl: string;
  expiresInSeconds: number;
  requiredHeaders: Record<string, string>;
}

export class FilesService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly idempotency: IdempotencyService,
    private readonly storage: ObjectStorage,
  ) {}

  async presignUpload(client: PoolClient, principal: Principal, input: PresignUploadInput): Promise<PresignUploadOutput> {
    await this.authorization.assert(client, principal, 'files:access');
    const result = await this.idempotency.run(client, principal, {
      key: input.idempotencyKey,
      operation: 'file.presign-upload',
      request: { contentType: input.contentType, byteSize: input.byteSize, sha256: input.sha256.toLowerCase() },
      responseStatus: 201,
      ttlSeconds: 300,
      execute: async () => {
        const objectKey = this.storage.createObjectKey(principal.organizationId);
        const file = await client.query<{id:string}>(
          'INSERT INTO file_objects(organization_id,object_key,sha256,content_type,byte_size,created_by_account_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
          [principal.organizationId, objectKey, input.sha256.toLowerCase(), input.contentType, input.byteSize, principal.accountId],
        );
        const signed = await this.storage.signedUpload(objectKey, input.contentType, input.byteSize, input.sha256);
        return { fileId: file.rows[0].id, uploadUrl: signed.url, expiresInSeconds: 300, requiredHeaders: signed.requiredHeaders };
      },
    });
    return result.body;
  }

  async presignRead(client: PoolClient, principal: Principal, fileId: string): Promise<{readUrl:string;expiresInSeconds:number}> {
    const result = await client.query<{
      object_key:string;
      created_by_account_id:string|null;
      snapshot_id:string|null;
      department_id:string|null;
      supervisor_assignment_id:string|null;
      academic_year_id:string|null;
      academic_level_id:string|null;
      cohort_id:string|null;
      group_id:string|null;
    }>(
      'SELECT f.object_key,f.created_by_account_id,a.snapshot_id,ss.department_id,ss.supervisor_assignment_id,ss.academic_year_id,ss.academic_level_id,ss.cohort_id,ss.group_id FROM file_objects f LEFT JOIN attachments a ON a.file_object_id=f.id LEFT JOIN submission_snapshots ss ON ss.id=a.snapshot_id WHERE f.id=$1',
      [fileId],
    );
    if (!result.rowCount) throw new ApiProblem(404, 'NOT_FOUND', 'File not found.');
    const file = result.rows[0];
    if (file.created_by_account_id === principal.accountId || principal.role === 'UNIVERSITY_ADMIN') {
      await this.authorization.assert(client, principal, 'files:access');
    } else if (file.snapshot_id && file.department_id && file.supervisor_assignment_id) {
      await this.authorization.assert(client, principal, 'cases:review', {
        departmentId: file.department_id,
        assignmentId: file.supervisor_assignment_id,
        assignmentPermission: 'reviewCases',
        academicYearId: file.academic_year_id ?? undefined,
        academicLevelId: file.academic_level_id ?? undefined,
        cohortId: file.cohort_id ?? undefined,
        groupId: file.group_id ?? undefined,
      });
    } else {
      throw new ApiProblem(404, 'NOT_FOUND', 'File not found.');
    }
    return { readUrl: await this.storage.signedRead(file.object_key), expiresInSeconds: 300 };
  }
}
