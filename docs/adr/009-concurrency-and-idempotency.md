# ADR 009 — Optimistic Concurrency and Idempotency

## Context

قد يعيد العميل طلب الإرسال أو تتزامن تعديلات إدارية على التسجيلات والسياسات والنتائج، ولا يجوز للصمت أن يستبدل قرارًا أحدث أو يكرر حدثًا حساسًا.

## Decision

تحمل المجاميع الإدارية mutable revision. تقارن الأوامر revision/ETag المتوقع وتعيد conflict عند القدم. تحفظ endpoints الحساسة idempotency key مقيّدًا بالمؤسسة والفاعل مع response محفوظة وفترة انتهاء، وتستخدم المعاملات وlocking عند الانتقالات متعددة السجلات.

## Consequences

يجب أن يتعامل العميل مع 409 بإعادة القراءة. لا تتحول idempotency إلى global shared token، ولا تُستخدم لمنح صلاحية أو لإخفاء سوء تصميم الانتقال.
