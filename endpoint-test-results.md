# Deployed endpoint checks

Base URL: https://clashless-backend-ahmadzubayer.vercel.app/
Date: 14 November 2026 at 19:56 (Asia/Dhaka)

134 endpoints covered; 255 request checks: 255 passed, 0 failed. Extra account/session checks: 12/12 passed.

Inventory verified against the deployed Swagger: 133 API operations plus Swagger UI. No local server was started.

Basic smoke checks: status codes and JSON success/error envelopes, public validation, missing authentication, authenticated reads, empty input, missing records, PDF response signature and SSE content type. Successful destructive workflows, every role rule, email delivery, OTP activation, Google OAuth, completed payments and full semester workflows were not verified. A temporary student was created, read, blocked and soft-deleted. Original admin login initially required a password change; this was completed with user approval and the new password is stored only in ignored `.env` as `UPDATED_ADMIN_PASS`.

| Endpoint | Check | HTTP | Expected | Result |
|---|---|---:|---|---|
| GET /api/analytics/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/analytics/registration-live | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/analytics | No credentials / empty public input | 401 | 401 | PASS |
| GET / | No credentials / empty public input | 200 | 200 | PASS |
| POST /api/auth/activate/request-otp | No credentials / empty public input | 400 | 400 | PASS |
| POST /api/auth/login | No credentials / empty public input | 400 | 400 | PASS |
| POST /api/auth/activate/verify | No credentials / empty public input | 400 | 400 | PASS |
| GET /api/admin/audit-logs | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/auth/me | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/auth/refresh-token | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/auth/logout | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/auth/google | No credentials / empty public input | 400 | 400 | PASS |
| POST /api/auth/forgot-password | No credentials / empty public input | 400 | 400 | PASS |
| POST /api/auth/reset-password | No credentials / empty public input | 400 | 400 | PASS |
| POST /api/auth/change-password | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/batches | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/courses | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/batches | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/courses | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/courses/{id} | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/courses/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/courses/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/admin/courses/{id}/prerequisites | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/day-patterns | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/departments | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/day-patterns | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/departments | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/exam-routines/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/exam-routines | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/departments/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/departments/{id} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/exam-routines/generate | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/exam-routines/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/exam-routines/{id}/entries/{entryId} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/exam-routines/{id}/publish | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/exam-slots | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/exam-slots | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/faculty-preferences/me | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/exam-slots/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/faculty-preferences/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/grades/me | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/grades/sections/{sectionId} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/grades/sections/{sectionId} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/faculty-preferences | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/grades/publish | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/grades/status | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/jobs/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/notifications/me | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/notifications/read-all | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/notifications/{id}/read | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/offerings | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/offerings | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/offerings/{id} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/payments/create | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/payments/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/payments | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/payments/{id}/receipt | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/payments/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/programs | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/programs | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/programs/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/programs/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/admin/programs/{id}/curriculum | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/registrations | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/registrations/{studentId} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/registrations/{studentId}/sections/{sectionId} | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/registrations/{studentId}/sections/{sectionId} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/registrations/seats/stream | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/registrations/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/registrations/offerings | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/registrations/switch | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/registrations/sections/{sectionId} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/registrations/sections/{sectionId} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/registration-windows | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/registration-windows | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/registration-windows/{id} | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/registration-windows/{id} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/results/import | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/rooms | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/rooms | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/rooms/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/routines/published/export | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/routines/published | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/routines/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/routines | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/routines/generate | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/routines/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/routines/{id}/report | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/routines/{id}/export | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/routines/{id}/publish | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/routines/{id}/entries/{entryId} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/routines/{id}/entries/swap | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/routines/{id}/entries/{entryId}/pin | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/seat-plans/me | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/seat-plans | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/seat-plans | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/seat-plans/rooms/last-used | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/seat-plans/{id}/rooms/{roomId} | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/admin/seat-plans/{id}/rooms/{roomId}/invigilators | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/admin/seat-plans/{id}/rooms | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/seat-plans/{id}/generate | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/seat-plans/{id}/swap | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/seat-plans/{id}/students | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/seat-plans/{id}/export | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/seat-plans/{id}/publish | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/seat-plans/{id}/invigilators/auto-assign | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/seat-plans/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/sections/mine | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/sections/{id}/students | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/sections | No credentials / empty public input | 401 | 401 | PASS |
| PUT /api/admin/sections/faculty-assignments | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/sections/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/sections/{id}/schedule | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/sections/{id}/cancel | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/semesters/current | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/semesters/{id}/phase | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/semesters/{id} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/semesters | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/semesters | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/semesters/{id} | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/time-slots | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/time-slots | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/time-slots/{id} | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/users/admins | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/users/students | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/users/faculties | No credentials / empty public input | 401 | 401 | PASS |
| POST /api/admin/users/import | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/users | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/admin/users/{id}/status | No credentials / empty public input | 401 | 401 | PASS |
| GET /api/admin/users/{id} | No credentials / empty public input | 401 | 401 | PASS |
| DELETE /api/admin/users/{id} | No credentials / empty public input | 401 | 401 | PASS |
| PATCH /api/users/me | No credentials / empty public input | 401 | 401 | PASS |
| GET /docs/ | No credentials / empty public input | 200 | 200 | PASS |
| GET /api/payments/bkash/callback | No credentials / empty public input | 404 | 404 | PASS |
| GET /api/analytics/me | Authenticated FACULTY read | 200 | 200/400/404 | PASS |
| GET /api/admin/audit-logs | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| GET /api/admin/analytics | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| POST /api/auth/change-password | Authenticated ANY empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/analytics/registration-live | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| POST /api/admin/batches | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/auth/me | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/batches | Authenticated ANY read | 200 | 200/400/404 | PASS |
| POST /api/admin/courses | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/courses | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/courses/{id} | Authenticated ANY read | 200 | 200/400/404 | PASS |
| PUT /api/admin/courses/{id}/prerequisites | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| PATCH /api/admin/courses/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| DELETE /api/admin/courses/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/day-patterns | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/departments | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/day-patterns | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/departments | Authenticated ANY read | 200 | 200/400/404 | PASS |
| PATCH /api/admin/departments/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| DELETE /api/admin/departments/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/exam-routines/generate | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/exam-routines/me | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| GET /api/admin/exam-routines/{id} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| PATCH /api/admin/exam-routines/{id}/entries/{entryId} | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/exam-routines | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| POST /api/admin/exam-slots | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/exam-slots | Authenticated ANY read | 200 | 200/400/404 | PASS |
| POST /api/admin/exam-routines/{id}/publish | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| PUT /api/faculty-preferences/me | Authenticated FACULTY empty input / missing ID | 400 | 400/404/409/403 | PASS |
| DELETE /api/admin/exam-slots/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| GET /api/grades/me | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| PUT /api/grades/sections/{sectionId} | Authenticated FACULTY empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/faculty-preferences | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| GET /api/faculty-preferences/me | Authenticated FACULTY read | 200 | 200/400/404 | PASS |
| POST /api/admin/grades/publish | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/grades/sections/{sectionId} | Authenticated FACULTY read | 404 | 200/400/404 | PASS |
| GET /api/admin/jobs/{id} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| GET /api/notifications/me | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/admin/grades/status | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| PATCH /api/notifications/{id}/read | Authenticated ANY empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/offerings | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/payments | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| DELETE /api/admin/offerings/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/payments/create | Authenticated STUDENT empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/payments/{id}/receipt | Authenticated STUDENT read | 404 | 200/400/404 | PASS |
| GET /api/offerings | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| GET /api/payments/{id} | Authenticated STUDENT read | 404 | 200/400/404 | PASS |
| GET /api/payments/me | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| POST /api/admin/programs | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| PATCH /api/admin/programs/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| GET /api/programs | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/programs/{id} | Authenticated ANY read | 200 | 200/400/404 | PASS |
| PUT /api/admin/programs/{id}/curriculum | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/registrations/{studentId}/sections/{sectionId} | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/registrations/{studentId} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| DELETE /api/admin/registrations/{studentId}/sections/{sectionId} | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/registrations/seats/stream | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| GET /api/admin/registrations | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| POST /api/registrations/switch | Authenticated STUDENT empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/registrations/me | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| DELETE /api/registrations/sections/{sectionId} | Authenticated STUDENT empty input / missing ID | 403 | 400/404/409/403 | PASS |
| GET /api/registrations/offerings | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| POST /api/registrations/sections/{sectionId} | Authenticated STUDENT empty input / missing ID | 403 | 400/404/409/403 | PASS |
| POST /api/admin/registration-windows | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/registration-windows | Authenticated ANY read | 200 | 200/400/404 | PASS |
| POST /api/admin/results/import | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| PATCH /api/admin/registration-windows/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| DELETE /api/admin/registration-windows/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/rooms | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/rooms | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| PATCH /api/admin/rooms/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| GET /api/routines/published/export | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| GET /api/routines/published | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/routines/me | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| POST /api/admin/routines/generate | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/routines | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| GET /api/admin/routines/{id} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| GET /api/admin/routines/{id}/report | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| PATCH /api/admin/routines/{id}/entries/{entryId} | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/routines/{id}/export | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| POST /api/admin/routines/{id}/entries/swap | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/routines/{id}/publish | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| PATCH /api/admin/routines/{id}/entries/{entryId}/pin | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| GET /api/seat-plans/{id}/rooms/{roomId} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| POST /api/admin/seat-plans | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/seat-plans | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| GET /api/admin/seat-plans/rooms/last-used | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| PUT /api/admin/seat-plans/{id}/rooms/{roomId}/invigilators | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/seat-plans/me | Authenticated STUDENT read | 200 | 200/400/404 | PASS |
| PUT /api/admin/seat-plans/{id}/rooms | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/seat-plans/{id}/swap | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/seat-plans/{id}/generate | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/seat-plans/{id}/students | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/seat-plans/{id}/export | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| POST /api/admin/seat-plans/{id}/publish | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| GET /api/admin/seat-plans/{id} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| POST /api/admin/seat-plans/{id}/invigilators/auto-assign | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| PUT /api/admin/sections/faculty-assignments | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/sections/{id}/students | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| POST /api/admin/sections | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| PATCH /api/admin/sections/{id}/schedule | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/sections/{id}/cancel | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/sections/mine | Authenticated FACULTY read | 200 | 200/400/404 | PASS |
| PATCH /api/admin/sections/{id} | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/semesters/current | Authenticated ANY read | 200 | 200/400/404 | PASS |
| PATCH /api/admin/semesters/{id}/phase | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/semesters | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/semesters | Authenticated ANY read | 200 | 200/400/404 | PASS |
| GET /api/admin/semesters/{id} | Authenticated ADMIN read | 200 | 200/400/404 | PASS |
| PATCH /api/admin/semesters/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/time-slots | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/time-slots | Authenticated ANY read | 200 | 200/400/404 | PASS |
| POST /api/admin/users/admins | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/users/faculties | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| POST /api/admin/users/students | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| PATCH /api/admin/time-slots/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| POST /api/admin/users/import | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| PATCH /api/admin/users/{id}/status | Authenticated ADMIN empty input / missing ID | 400 | 400/404/409/403 | PASS |
| GET /api/admin/users/{id} | Authenticated ADMIN read | 404 | 200/400/404 | PASS |
| DELETE /api/admin/users/{id} | Authenticated ADMIN empty input / missing ID | 404 | 400/404/409/403 | PASS |
| GET /api/admin/users | Authenticated ADMIN read | 200 | 200/400/404 | PASS |

| Extra check | HTTP | Result |
|---|---:|---|
| Admin login | 200 | PASS |
| Seeded demo admin login without password-change restriction | 200 | PASS |
| FACULTY demo login | 200 | PASS |
| STUDENT demo login | 200 | PASS |
| Create temporary student through admin endpoint | 201 | PASS |
| Read newly created student | 200 | PASS |
| Unactivated student login rejected | 403 | PASS |
| Block temporary student | 200 | PASS |
| Soft-delete temporary student (cleanup) | 200 | PASS |
| Refresh-token cookie success | 200 | PASS |
| Original admin password changed; saved only as UPDATED_ADMIN_PASS in ignored .env | 200 | PASS |
| Original admin login with updated password; password-change gate cleared | 200 | PASS |
