# Known Limitations and Open Acceptance Gates

1. Malware scanning and content-disarm processing are not implemented. File upload is private, signed, size/type/checksum constrained, and remains an explicit scanning integration boundary.
2. A presigned file record can be abandoned when the client never uploads. A verified completion endpoint and orphan-retention job are still required.
3. The diagnostic web app is not the migrated v7 user experience.
4. Invitation onboarding does not yet provision department scopes, supervisor assignments, or student identity linkage; administrators must complete those records through a controlled workflow before granting operational access.
5. Session-cookie secret rotation currently invalidates active cookies; multi-key cookie verification is not implemented.
6. Outbox production publishing, retry/dead-letter processing, and backlog monitoring are not implemented; writes are transactionally coupled to audit creation only.
7. Institution-approved retention periods, backup infrastructure, disaster-recovery targets, monitoring destinations, and incident contacts remain deployment decisions.

The Phase 1 closure gates (clean PostgreSQL 16 migration/seed, forced RLS tenant isolation, MinIO, and integration tests) are recorded in `PHASE_1_CLOSURE_REPORT.md`; they are no longer open acceptance items.
