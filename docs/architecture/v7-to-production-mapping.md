# v7 to Production Core Mapping

## قاعدة الترحيل

تُحفظ نسخة v7 في `reference/prototype-v7/` للقراءة فقط. لا تتحول ملفاتها إلى production code؛ بل تُترجم إلى موديولات خادمية وجداول وعقود واجهات مع ضمانات قاعدة البيانات. حالة التنفيذ في هذه الوثيقة تعني نطاق Phase 1 وليست وعدًا بواجهة migration كاملة.

| مفهوم v7 / المصدر | المعنى التجاري | Production aggregate / storage | API/use case | تفويض الخادم | التاريخ وعدم القابلية للتعديل | حالة Phase 1 |
| --- | --- | --- | --- | --- | --- | --- |
| `portal-permissions.js` / `canPerform()` | role + scope + assignment permission + state | Identity/Authorization service | جميع الأوامر الحساسة | principal خادمي، tenant/scope/state | قرارات التفويض مسجلة Audit | منفذ كخدمة مركزية واختبارات سلبية |
| `portal-domain.js` | السياق الأكاديمي والنطاق | Organizations + Academic Structure | context reads | tenant دائماً | مرجع نطاق في الأحداث | منفذ |
| `portal-students.js` | هوية الطالب والتسجيل | Students + Academic Enrollments | create/read/close enrollment | Department/University scope | enrollment history محفوظ | منفذ |
| `portal-rosters.js` | roster وعضوية واستيراد/تصدير | Rosters + Roster Memberships | import preview/commit, export | Department Admin في scope | lifecycle events + audit | منفذ للجوهر والعقود |
| `portal-groups.js` | Full Cohort / groups وتوزيع الطلاب | Distribution Policies + Academic Groups + Group Memberships | configure/move group | Department Admin في scope | عضوية منقولة/مغلقة لا تمحى | منفذ للقيود والانتقال |
| `portal-faculty.js` | ملف عضو هيئة تدريس | Faculty Profiles + Account Scopes | faculty management | University/Department scope | account status history audit | منفذ للجوهر |
| `portal-supervisor-assignments.js` | assignment وصلاحيات review/grade | Supervisor Assignments + Assignment Permissions | assign/revoke | Department scope + authority | historical assignment retained | منفذ |
| `portal-requirements.js` | requirements وإصداراتها والنشر | Requirement Sets + Versions + Requirements | draft/publish/archive | Department Admin | published versions immutable | منفذ |
| `portal-clinical-workflow.js` | workflow policy وإصدارها | Clinical Workflow Policy Versions | configure/publish | University/Department authority | snapshot future-only | منفذ للنسخ/snapshot |
| `portal-cases.js` | drafts/submissions/decisions/notes/grades | Case Sheets + Submission Snapshots + Decisions + Notes + Grade Events | submit/review/approve/grade/amend | student boundary أو supervisor assignment | snapshots/audit/grades append-only | منفذ للجوهر |
| `portal-academic-assessment.js` | rubrics/assessments/formulas/summary | Rubric Versions + Assessment Snapshots + Formula Versions + Summaries | record assessment/recalculate | scoped staff/admin | rubric/formula snapshots immutable | منفذ للعقد والنموذج |
| `portal-term-results.js` | review/approve/lock/reopen | Term Result Closures | explicit state commands | University/Department authority | locked data cannot mutate; reopen reason | منفذ |
| `portal-reports.js` | تقارير aggregate/scoped وCSV | Reporting query service + Audit events | aggregate reports/export | aggregate-only contracts | export audit; no ID DTO | منفذ للعقد |
| `portal-institutional-settings.js` | إعدادات وسياسات المؤسسة | versioned policy aggregates | policy management | University Admin | publish/audit only | منفذ للجوهر |
| استيراد مرفقات الكاسشيت | مرفقات خاصة مرتبطة بالـsubmission | File Objects + Attachments | authorize/upload URL/read URL | owner/scope authorization | metadata + checksum، بلا public URL | منفذ كبنية/عقد محلي |
| الأحداث المحلية | traceability | Audit Events + Outbox Events | internal append path | transaction-bound server actor | DB guard blocks update/delete | منفذ |

## الاختلافات المقصودة عن المرجع

يتحوّل `No Groups` في v7 إلى `FULL_COHORT`، ويظل المعنى أن عضويات Academic Group غير مسموحة. تتوقف Data arrays وLocalStorage وأرقام التعريف غير الآمنة والـbrowser permission checks عن الوجود خارج `reference/`. لا يقبل Production Core `tenantId` أو role أو permissions واردة من العميل لتقرير الصلاحية.

## مسار ترحيل البيانات لاحقًا

لا تربط Phase 1 أي بيانات كلية أو مريض حقيقية. يمكن في Phase 2 إنشاء importer منفصل ومراجعته، حيث يستقبل export مقننًا من v7 أو مصادر الكلية ويحوّله إلى staging validation ثم transaction قابلة للعكس. لا يُمنح frontend الاستيراد حق الكتابة المباشرة في جداول الإنتاج.
