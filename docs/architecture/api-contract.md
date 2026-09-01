# API Contract — Phase 1

## قواعد عامة

تستخدم API السابقة `/api/v1`. تستخدم كل استجابة خطأ المغلف `{ error: { code, message, requestId, details? } }`. لا يقبل أي endpoint حساس role أو permission أو tenantId من العميل لتحديد الوصول. تحمي mutation endpoints عبر session cookie و`x-csrf-token` المطابق.

| Endpoint | الاستخدام | التفويض والحماية |
| --- | --- | --- |
| `GET /health/live` | تحقق عملية الخدمة. | عام؛ لا يكشف تبعيات. |
| `GET /health/ready` | تحقق PostgreSQL وobject storage. | عام؛ لا يكشف أسرارًا. |
| `POST /api/v1/auth/login` | جلسة مؤسسة. | organizationId + email/password، rate-limited؛ cookie آمنة. |
| `POST /api/v1/auth/logout` | إلغاء الجلسة. | session + CSRF. |
| `GET /api/v1/session` | principal التشخيصي الأدنى. | session فقط. |
| `POST /api/v1/invitations` | إنشاء دعوة. | University/Department authority + CSRF؛ token لا يعود في الإنتاج. |
| `POST /api/v1/invitations/redeem` | redeem أحادي الاستعمال. | token hash/expiry/revocation. |
| `GET /api/v1/students` | قائمة الطالب في scope. | `students:read` وdepartment scope. |
| `POST /api/v1/enrollments/:id/close` | إغلاق التسجيل والعضويات في transaction. | `rosters:manage` + CSRF + revision/reason/idempotency. |
| `POST /api/v1/groups/memberships` | نقل/إسناد group. | `groups:manage` + policy/context guards + CSRF. |
| `POST /api/v1/student/submissions` | submit draft خاص للطالب. | student owner + CSRF + idempotency؛ snapshot immutable. |
| `GET /api/v1/staff/submissions/:id` | عرض submission مؤسسية فقط. | `cases:review` + scope؛ لا draft endpoint هنا. |
| `POST /api/v1/staff/submissions/:id/revision-requests` | طلب revision. | active assignment + `reviewCases` + CSRF. |
| `POST /api/v1/staff/submissions/:id/grades` | grade/amend grade. | active assignment + `grade` + CSRF؛ reason للتعديل. |
| `POST /api/v1/term-results/:id/{reviewed,approved,locked,reopened}` | state commands للنتائج. | role/scope + CSRF؛ reopen reason. |
| `GET /api/v1/reports/aggregate` | مقاييس aggregate-only. | `reports:aggregate`؛ DTO لا يحمل student name/id. |
| `POST /api/v1/files/presign-upload` | URL رفع خاص قصير. | principal + CSRF؛ size/type/checksum. |
| `GET /api/v1/files/:id/presign-read` | URL قراءة خاص قصير. | principal + file authorization؛ 5 دقائق. |

يمكن استكشاف OpenAPI الفعلي عبر `GET /openapi.json` أو واجهة `/docs`. عقود الطالب لا تعرض ملاحظات المشرف أو audit internals أو requirement drafts أو بيانات التحكم المؤسسية.
