import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl=process.env.DATABASE_URL ?? 'postgresql://dentpilot_app:development-only-change-me@localhost:5432/dentpilot';
const orgA='11111111-1111-4111-8111-111111111111'; const snapshot='11111111-1111-4111-8111-111111111137';
let client: pg.Client;
async function tenant(org:string): Promise<void> { await client.query('BEGIN'); await client.query("SELECT set_config('app.organization_id',$1,true)",[org]); }
async function rollback(): Promise<void> { await client.query('ROLLBACK'); }

describe('PostgreSQL production invariants',()=>{
  beforeAll(async()=>{client=new pg.Client({connectionString:databaseUrl}); await client.connect();}); afterAll(async()=>client.end());
  it('uses RLS to block cross-tenant enumeration',async()=>{ const orgB=crypto.randomUUID(); await client.query('INSERT INTO organizations(id,name,slug) VALUES($1,$2,$3)',[orgB,'Institution B',`b-${orgB}`]); await tenant(orgB); await client.query('INSERT INTO colleges(organization_id,name) VALUES($1,$2)',[orgB,'B College']); await rollback(); await tenant(orgA); const rows=await client.query('SELECT id FROM colleges WHERE organization_id=$1',[orgB]); expect(rows.rowCount).toBe(0); await rollback(); });
  it('rejects duplicate active enrollment in the same context',async()=>{ await tenant(orgA); await expect(client.query("INSERT INTO academic_enrollments(organization_id,student_id,academic_year_id,academic_level_id,cohort_id) VALUES('11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111124','11111111-1111-4111-8111-111111111115','11111111-1111-4111-8111-111111111117','11111111-1111-4111-8111-111111111118')")).rejects.toThrow(); await rollback(); });
  it('rejects group membership where policy is Full Cohort',async()=>{ await tenant(orgA); const group=crypto.randomUUID(); await client.query("INSERT INTO academic_groups(id,organization_id,department_id,academic_year_id,academic_level_id,name) VALUES($1,$2,'11111111-1111-4111-8111-111111111114','11111111-1111-4111-8111-111111111115','11111111-1111-4111-8111-111111111117','Forbidden Group')",[group,orgA]); await expect(client.query("INSERT INTO group_memberships(organization_id,group_id,department_id,student_id,enrollment_id) VALUES($1,$2,'11111111-1111-4111-8111-111111111114','11111111-1111-4111-8111-111111111124','11111111-1111-4111-8111-111111111125')",[orgA,group])).rejects.toThrow('invalid group membership'); await rollback(); });
  it('rejects direct mutation and deletion of a submission snapshot',async()=>{ await tenant(orgA); await expect(client.query('UPDATE submission_snapshots SET payload=$2 WHERE id=$1',[snapshot,{tampered:true}])).rejects.toThrow('immutable record'); await rollback(); await tenant(orgA); await expect(client.query('DELETE FROM submission_snapshots WHERE id=$1',[snapshot])).rejects.toThrow('immutable record'); await rollback(); });
  it('rejects direct audit history mutation and deletion',async()=>{ await tenant(orgA); const audit=await client.query<{id:string}>('SELECT id FROM audit_events LIMIT 1'); await expect(client.query('UPDATE audit_events SET action=$2 WHERE id=$1',[audit.rows[0].id,'TAMPERED'])).rejects.toThrow('immutable record'); await rollback(); await tenant(orgA); const nextAudit=await client.query<{id:string}>('SELECT id FROM audit_events LIMIT 1'); await expect(client.query('DELETE FROM audit_events WHERE id=$1',[nextAudit.rows[0].id])).rejects.toThrow('immutable record'); await rollback(); });
});
