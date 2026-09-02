import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type ProductionCore } from '../../apps/api/src/app.js';

const env={NODE_ENV:'test',DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/unused',MINIO_ENDPOINT:'http://127.0.0.1:1',MINIO_ACCESS_KEY:'test-access',MINIO_SECRET_KEY:'test-secret-value',SESSION_COOKIE_SECRET:'test-only-cookie-secret-with-32-characters',CORS_ORIGIN:'http://localhost:5173'};
const requiredPaths:Record<string,string[]>= {
  '/health/live':['get'], '/health/ready':['get'], '/openapi.json':['get'],
  '/api/v1/auth/login':['post'], '/api/v1/auth/logout':['post'], '/api/v1/session':['get'],
  '/api/v1/invitations':['post'], '/api/v1/invitations/redeem':['post'], '/api/v1/students':['get'],
  '/api/v1/enrollments/{id}/close':['post'], '/api/v1/groups/memberships':['post'], '/api/v1/student/submissions':['post'],
  '/api/v1/staff/submissions/{id}':['get'], '/api/v1/staff/submissions/{id}/revision-requests':['post'], '/api/v1/staff/submissions/{id}/grades':['post'],
  '/api/v1/staff/submissions/{id}/approve-start':['post'], '/api/v1/staff/submissions/{id}/approve-final':['post'],
  '/api/v1/term-results/{id}/reviewed':['post'], '/api/v1/term-results/{id}/approved':['post'], '/api/v1/term-results/{id}/locked':['post'], '/api/v1/term-results/{id}/reopened':['post'],
  '/api/v1/reports/aggregate':['get'], '/api/v1/files/presign-upload':['post'], '/api/v1/files/{id}/presign-read':['get'],
};
let core:ProductionCore;

describe('Phase 1 API contract without external dependencies',()=>{
  beforeAll(async()=>{core=await buildApp(env,{initializeObjectStorage:false});});
  afterAll(async()=>core.app.close());

  it('publishes every route with summaries and explicit status responses',async()=>{
    const response=await core.app.inject('/openapi.json'); expect(response.statusCode).toBe(200); const document=response.json();
    for(const [path,methods] of Object.entries(requiredPaths)) for(const method of methods) {
      expect(document.paths[path]?.[method],`${method.toUpperCase()} ${path}`).toBeDefined();
      expect(document.paths[path][method].summary).toBeTruthy();
      expect(Object.keys(document.paths[path][method].responses).length).toBeGreaterThan(0);
    }
  });

  it('rejects boundary mass assignment before database access',async()=>{
    const response=await core.app.inject({method:'POST',url:'/api/v1/auth/login',payload:{organizationId:'11111111-1111-4111-8111-111111111111',email:'admin@example.test',password:'long-enough-password',role:'UNIVERSITY_ADMIN'}});
    expect(response.statusCode).toBe(400); expect(response.json().error.code).toBe('VALIDATION_ERROR'); expect(response.json().error.requestId).toBeTruthy();
  });

  it('uses the safe error envelope for unauthenticated sensitive routes',async()=>{
    const response=await core.app.inject({method:'POST',url:'/api/v1/groups/memberships',payload:{groupId:'11111111-1111-4111-8111-111111111111',enrollmentId:'11111111-1111-4111-8111-111111111112',departmentId:'11111111-1111-4111-8111-111111111113',studentId:'11111111-1111-4111-8111-111111111114',idempotencyKey:'contract-test-key-0001'}});
    expect(response.statusCode).toBe(401); expect(response.json()).toMatchObject({error:{code:'AUTHENTICATION_REQUIRED'}}); expect(response.json().error.requestId).toBeTruthy();
  });

  it('keeps aggregate report schema free of student and clinical identity fields',async()=>{
    const document=(await core.app.inject('/openapi.json')).json(); const schema=document.paths['/api/v1/reports/aggregate'].get.responses['200'].content['application/json'].schema; const serialized=JSON.stringify(schema).toLowerCase();
    expect(serialized).not.toContain('studentid'); expect(serialized).not.toContain('displayname'); expect(serialized).not.toContain('patient');
  });
});
