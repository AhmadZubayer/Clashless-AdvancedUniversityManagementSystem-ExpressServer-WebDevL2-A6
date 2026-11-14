# Total endpoints: 134

Base URL: https://clashless-backend-ahmadzubayer.vercel.app/

Use real IDs instead of sample UUIDs. Protected requests use `Authorization: Bearer <accessToken>`; refresh uses the `refreshToken` cookie. JSON unless form-data is specified. Each method + path counts once; Swagger UI counts as one endpoint.

New staff must change their temporary password before using protected endpoints. Live check results: [endpoint-test-results.md](endpoint-test-results.md).

## GET /

Access: Public

Health check.

Body: None.

## GET /api/analytics/me

Access: Faculty, Student

My dashboard.

Body: None.

## GET /api/admin/analytics/registration-live

Access: Admin, Super Admin

Live registration view.

Body: None.

## GET /api/admin/analytics

Access: Admin, Super Admin

Admin dashboard.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## GET /api/admin/audit-logs

Access: Admin, Super Admin

Who changed what, when and why (newest first).

Sample query: `?page=1&limit=1`

Body: None.

## POST /api/auth/activate/request-otp

Access: Public

Send a 10-minute activation OTP to an eligible student; generic response, 3 sends per 15 minutes.

Sample body: `{"email":"student@uni.edu"}`

## POST /api/auth/activate/verify

Access: Public

Activate an existing student; five wrong tries invalidate the OTP; issues cookies.

Sample body: `{"email":"student@uni.edu","otp":"123456","password":"ExamplePass123!"}`

## POST /api/auth/login

Access: Public

Email/password login; inactive students must activate.

Sample body: `{"email":"student@uni.edu","password":"ExamplePass123!"}`

## GET /api/auth/me

Access: Any logged-in user

User without password plus role profile, student program, batch, CGPA and earned credits.

Body: None.

## POST /api/auth/refresh-token

Access: Refresh-token cookie

Refresh cookies; rejects revoked versions and inactive accounts.

Body: None.

## POST /api/auth/logout

Access: Any logged-in user

Revoke every session and clear cookies.

Body: None.

## POST /api/auth/google

Access: Public

Verify Google identity and link an existing university-domain student; never creates users.

Sample body: `{"idToken":"<Google ID token>"}`

## POST /api/auth/forgot-password

Access: Public

Send a 5-minute password reset OTP; generic response, same send limit.

Sample body: `{"email":"student@uni.edu"}`

## POST /api/auth/reset-password

Access: Public

Consume OTP and replace password; revoke every existing session.

Sample body: `{"email":"student@uni.edu","otp":"123456","newPassword":"NewExample123!"}`

## POST /api/auth/change-password

Access: Any logged-in user

Check current password, clear first-login restriction, revoke old sessions and issue fresh cookies.

Sample body: `{"currentPassword":"ExamplePass123!","newPassword":"NewExample123!"}`

## GET /api/batches

Access: Any logged-in user

List batches with pagination and code search.

Sample query: `?page=1&limit=10`

Body: None.

## POST /api/admin/batches

Access: Admin, Super Admin

Create a unique batch and derive intake year and term from its code.

Sample body: `{"code":"23-3"}`

## GET /api/courses

Access: Any logged-in user

Paginated course catalogue with department, type and name/code search.

Sample query: `?type=THEORY&page=1&limit=10`

Body: None.

## GET /api/courses/{id}

Access: Any logged-in user

Course with prerequisite grades and curriculum terms.

Body: None.

## POST /api/admin/courses

Access: Admin, Super Admin

Create a course with unique uppercase code and half-credit increments.

Sample body: `{"code":"CSE101","title":"Example course","credits":3,"type":"THEORY","departmentId":"11111111-1111-4111-8111-111111111111"}`

## PATCH /api/admin/courses/{id}

Access: Admin, Super Admin

Update course; credits/type locked while offered after PLANNING and before CLOSED.

Sample body: `{"code":"CSE101","title":"Example course","credits":3,"type":"THEORY","departmentId":"11111111-1111-4111-8111-111111111111"}`

## DELETE /api/admin/courses/{id}

Access: Admin, Super Admin

Soft delete a course only when no non-CLOSED semester offers it.

Body: None.

## PUT /api/admin/courses/{id}/prerequisites

Access: Admin, Super Admin

Replace prerequisites atomically; rejects self-dependency and any graph cycle.

Sample body: `[{"prerequisiteId":"11111111-1111-4111-8111-111111111111","minGrade":"A"}]`

## GET /api/day-patterns

Access: Any logged-in user

List weekly day patterns with optional type and code search.

Sample query: `?type=THEORY&page=1&limit=10`

Body: None.

## POST /api/admin/day-patterns

Access: Admin, Super Admin

Create unique code; THEORY has two distinct days and LAB has one day.

Sample body: `{"code":"ST","type":"THEORY","days":["SUN","TUE"]}`

## GET /api/departments

Access: Any logged-in user

List non-deleted departments with pagination and name/code search.

Sample query: `?page=1&limit=10`

Body: None.

## POST /api/admin/departments

Access: Admin, Super Admin

Create a department with a unique uppercase code.

Sample body: `{"code":"CSE101","name":"Example name"}`

## PATCH /api/admin/departments/{id}

Access: Admin, Super Admin

Update department name or uppercase unique code.

Sample body: `{"code":"CSE101","name":"Example name"}`

## DELETE /api/admin/departments/{id}

Access: Admin, Super Admin

Soft delete only when no non-deleted courses or faculty remain.

Body: None.

## GET /api/exam-routines/me

Access: Student, Faculty

My exams.

Body: None.

## GET /api/admin/exam-routines

Access: Admin, Super Admin

List exam routine versions.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=1`

Body: None.

## POST /api/admin/exam-routines/generate

Access: Admin, Super Admin

Generate the exam routine (background job).

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","maxStudentsPerSlot":1}`

## GET /api/admin/exam-routines/{id}

Access: Admin, Super Admin

View a version grouped by slot, with its report.

Body: None.

## PATCH /api/admin/exam-routines/{id}/entries/{entryId}

Access: Admin, Super Admin

Move the exam of one course to another slot (DRAFT only).

Sample body: `{"examSlotId":"11111111-1111-4111-8111-111111111111"}`

## POST /api/admin/exam-routines/{id}/publish

Access: Admin, Super Admin

Publish a draft exam routine.

Body: None.

## GET /api/exam-slots

Access: Any logged-in user

List exam slots of a semester.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## POST /api/admin/exam-slots

Access: Admin, Super Admin

Create exam slots.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","slots":[{"date":"2026-12-20","startMinute":540,"endMinute":660}]}`

## DELETE /api/admin/exam-slots/{id}

Access: Admin, Super Admin

Remove an exam slot.

Body: None.

## PUT /api/faculty-preferences/me

Access: Faculty

Replace own preferences during PLANNING before any routine version exists.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","items":[{"day":"SAT","timeSlotId":"11111111-1111-4111-8111-111111111111","kind":"PREFERRED"}]}`

## GET /api/faculty-preferences/me

Access: Faculty

List own preferences.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=10`

Body: None.

## GET /api/admin/faculty-preferences

Access: Admin, Super Admin

List teachers' semester preferences.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=10`

Body: None.

## GET /api/grades/me

Access: Student

My results.

Body: None.

## PUT /api/grades/sections/{sectionId}

Access: Faculty

Submit or edit grades for a section.

Sample body: `{"grades":[{"enrollmentId":"11111111-1111-4111-8111-111111111111","grade":"A"}]}`

## GET /api/grades/sections/{sectionId}

Access: Faculty, Admin, Super Admin

A section's grade sheet.

Body: None.

## GET /api/admin/grades/status

Access: Admin, Super Admin

Who has not submitted grades.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## POST /api/admin/grades/publish

Access: Admin, Super Admin

Publish results.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111"}`

## GET /api/admin/jobs/{id}

Access: Admin, Super Admin

Poll generation job status and progress.

Body: None.

## GET /api/notifications/me

Access: Any logged-in user

My notifications, newest first.

Sample query: `?page=1&limit=1`

Body: None.

## PATCH /api/notifications/read-all

Access: Any logged-in user

Mark all my notifications as read.

Body: None.

## PATCH /api/notifications/{id}/read

Access: Any logged-in user

Mark one of my notifications as read.

Body: None.

## GET /api/offerings

Access: Admin, Super Admin, Faculty

Staff course offerings with teacher, room, days, times, enrolledCount and capacity per section.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=10`

Body: None.

## POST /api/admin/offerings

Access: Admin, Super Admin

Offer a course in PLANNING with sections numbered 1 through N in one transaction.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","courseId":"11111111-1111-4111-8111-111111111111","sectionCount":1,"capacity":40}`

## DELETE /api/admin/offerings/{id}

Access: Admin, Super Admin

Remove an offering and its sections during PLANNING, preserving enrollment history.

Body: None.

## GET /api/admin/payments

Access: Admin, Super Admin

List all payments.

Sample query: `?page=1&limit=1`

Body: None.

## POST /api/payments/create

Access: Student

Start a bKash payment for my current semester registration.

Sample body: `{"amount":18400,"provider":"BKASH"}`

## GET /api/payments/me

Access: Student

List my payments, newest first.

Body: None.

## GET /api/payments/{id}/receipt

Access: Student, Admin, Super Admin

Receipt PDF of a completed payment.

Body: None.

## GET /api/payments/{id}

Access: Student, Admin, Super Admin

Get one payment (students only their own).

Body: None.

## GET /api/programs

Access: Any logged-in user

Paginated programs with optional department and name/code search.

Sample query: `?page=1&limit=10`

Body: None.

## GET /api/programs/{id}

Access: Any logged-in user

Program including curriculum courses ordered by term.

Body: None.

## POST /api/admin/programs

Access: Admin, Super Admin

Create a program with positive fees and an existing department.

Sample body: `{"code":"CSE101","name":"Example name","departmentId":"11111111-1111-4111-8111-111111111111","totalCreditsRequired":148,"perCreditFee":6000,"semesterFee":10000}`

## PATCH /api/admin/programs/{id}

Access: Admin, Super Admin

Update program; fees cannot change during REGISTRATION.

Sample body: `{"code":"CSE101","name":"Example name","departmentId":"11111111-1111-4111-8111-111111111111","totalCreditsRequired":148,"perCreditFee":6000,"semesterFee":10000}`

## PUT /api/admin/programs/{id}/curriculum

Access: Admin, Super Admin

Replace the entire curriculum atomically with existing non-deleted courses.

Sample body: `[{"courseId":"11111111-1111-4111-8111-111111111111","term":1}]`

## GET /api/admin/registrations

Access: Admin, Super Admin

List student bills with batch, payment and risk filters.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=10`

Body: None.

## GET /api/admin/registrations/{studentId}

Access: Admin, Super Admin

Student bill with all enrollment history and payments.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## POST /api/admin/registrations/{studentId}/sections/{sectionId}

Access: Admin, Super Admin

Manually enroll with explicit bypasses during REGISTRATION or CLASSES.

Sample body: `{"reason":"Administrative correction","bypass":[]}`

## DELETE /api/admin/registrations/{studentId}/sections/{sectionId}

Access: Admin, Super Admin

Manually remove during REGISTRATION or CLASSES without a window check.

Sample body: `{"reason":"Administrative correction"}`

## GET /api/registrations/seats/stream

Access: Student, Admin, Super Admin

Stream current-semester seat changes to students and admins.

Body: None.

## GET /api/registrations/me

Access: Student

Current semester, own batch window, bill and enrolled sections.

Body: None.

## GET /api/registrations/offerings

Access: Student

Cached catalog with live seats and per-student selection flags.

Sample query: `?page=1&limit=10`

Body: None.

## POST /api/registrations/switch

Access: Student

Switch between sections of the same offering without losing the source seat on failure.

Sample body: `{"fromSectionId":"11111111-1111-4111-8111-111111111111","toSectionId":"22222222-2222-4222-8222-222222222222"}`

## DELETE /api/registrations/sections/{sectionId}

Access: Student

Unselect inside the batch window; retain any overpaid credit.

Body: None.

## POST /api/registrations/sections/{sectionId}

Access: Student

Select a scheduled section inside the student's batch window.

Body: None.

## GET /api/registration-windows

Access: Any logged-in user

List semester windows; students see only their own batch; each row includes serverTime.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=10`

Body: None.

## POST /api/admin/registration-windows

Access: Admin, Super Admin

Create one batch window per semester in PLANNING or REGISTRATION.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","batchId":"11111111-1111-4111-8111-111111111111","startsAt":"2027-01-01T00:00:00+06:00","endsAt":"2027-01-02T00:00:00+06:00"}`

## PATCH /api/admin/registration-windows/{id}

Access: Admin, Super Admin

Edit before start or extend only endsAt with a reason while running; update batch payment deadlines atomically.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","batchId":"11111111-1111-4111-8111-111111111111","startsAt":"2027-01-01T00:00:00+06:00","endsAt":"2027-01-02T00:00:00+06:00","reason":"Administrative correction"}`

## DELETE /api/admin/registration-windows/{id}

Access: Admin, Super Admin

Delete a window only before it starts.

Body: None.

## POST /api/admin/results/import

Access: Admin, Super Admin

Import historical results and atomically recompute best-attempt CGPA and earned credits; W is ignored.

Sample form-data: `{"file":"@file.csv"}`

## GET /api/rooms

Access: Admin, Super Admin, Faculty

Paginated rooms for admins and faculty.

Sample query: `?type=CLASSROOM&page=1&limit=10`

Body: None.

## POST /api/admin/rooms

Access: Admin, Super Admin

Create a room with unique code and positive capacity (admins only).

Sample body: `{"code":"CSE101","building":"example","roomNo":"101","type":"CLASSROOM","capacity":40,"isActive":true}`

## PATCH /api/admin/rooms/{id}

Access: Admin, Super Admin

Update room; cannot deactivate one used by the current published routine.

Sample body: `{"code":"CSE101","building":"example","roomNo":"101","type":"CLASSROOM","capacity":40,"isActive":true}`

## GET /api/routines/published/export

Access: Admin, Super Admin, Faculty

Download published weekly PDF grids; teachers may export only themselves.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## GET /api/routines/published

Access: Any logged-in user

Published semester routine with optional academic and resource filters.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## GET /api/routines/me

Access: Student, Faculty

Current weekly grid for a student's enrolled classes or a teacher's assigned sections.

Body: None.

## GET /api/admin/routines

Access: Admin, Super Admin

List semester versions with status, score and unplaced counts.

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111&page=1&limit=10`

Body: None.

## POST /api/admin/routines/generate

Access: Admin, Super Admin

Queue deterministic class-routine generation during PLANNING.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","keepPinnedFrom":"11111111-1111-4111-8111-111111111111"}`

## GET /api/admin/routines/{id}

Access: Admin, Super Admin

View version entries with course, teacher, room, days and times.

Sample query: `?view=section`

Body: None.

## GET /api/admin/routines/{id}/report

Access: Admin, Super Admin

Recompute soft scores, unplaced reasons and all hard-rule violations.

Body: None.

## GET /api/admin/routines/{id}/export

Access: Admin, Super Admin

Download weekly PDF grids for any version, including drafts.

Sample query: `?view=master`

Body: None.

## POST /api/admin/routines/{id}/publish

Access: Admin, Super Admin

Publish a complete valid draft during PLANNING.

Body: None.

## PATCH /api/admin/routines/{id}/entries/{entryId}

Access: Admin, Super Admin

Move a draft entry and recompute its version's score.

Sample body: `{"roomId":"11111111-1111-4111-8111-111111111111","dayPatternId":"11111111-1111-4111-8111-111111111111","timeSlotId":"11111111-1111-4111-8111-111111111111"}`

## POST /api/admin/routines/{id}/entries/swap

Access: Admin, Super Admin

Atomically swap two draft entries' rooms, patterns and times.

Sample body: `{"entryAId":"11111111-1111-4111-8111-111111111111","entryBId":"22222222-2222-4222-8222-222222222222"}`

## PATCH /api/admin/routines/{id}/entries/{entryId}/pin

Access: Admin, Super Admin

Toggle a draft entry's pin for subsequent generation.

Body: None.

## GET /api/seat-plans/me

Access: Student

My seats from published seat plans.

Body: None.

## GET /api/seat-plans/{id}/rooms/{roomId}

Access: Admin, Super Admin, Faculty

One room's seat grid.

Body: None.

## POST /api/admin/seat-plans

Access: Admin, Super Admin

Start a seat plan for an exam slot.

Sample body: `{"examSlotId":"11111111-1111-4111-8111-111111111111"}`

## GET /api/admin/seat-plans

Access: Admin, Super Admin

Seat plans overview (each exam slot with its plan status).

Sample query: `?semesterId=11111111-1111-4111-8111-111111111111`

Body: None.

## GET /api/admin/seat-plans/rooms/last-used

Access: Admin, Super Admin

Rooms of the most recently generated seat plan.

Body: None.

## PUT /api/admin/seat-plans/{id}/rooms/{roomId}/invigilators

Access: Admin, Super Admin

Set a room's invigilators by hand.

Sample body: `{"facultyIds":["11111111-1111-4111-8111-111111111111"]}`

## PUT /api/admin/seat-plans/{id}/rooms

Access: Admin, Super Admin

Enter the rooms for the slot (replaces rooms and deletes the seats).

Sample body: `{"rooms":[{"roomNo":"101","totalSeats":40,"seatsPerColumn":10}]}`

## POST /api/admin/seat-plans/{id}/generate

Access: Admin, Super Admin

Generate the seat plan.

Sample body: `{"orderBy":"STUDENT_ID"}`

## POST /api/admin/seat-plans/{id}/swap

Access: Admin, Super Admin

Swap two students' seats.

Sample body: `{"seatAId":"11111111-1111-4111-8111-111111111111","seatBId":"22222222-2222-4222-8222-222222222222"}`

## POST /api/admin/seat-plans/{id}/students

Access: Admin, Super Admin

Seat a late student in the first valid empty seat.

Sample body: `{"studentId":"11111111-1111-4111-8111-111111111111"}`

## POST /api/admin/seat-plans/{id}/publish

Access: Admin, Super Admin

Publish the seat plan and email every seated student.

Body: None.

## GET /api/admin/seat-plans/{id}/export

Access: Admin, Super Admin

Print PDFs (door sheet, full grid or attendance sheet).

Sample query: `?type=door`

Body: None.

## POST /api/admin/seat-plans/{id}/invigilators/auto-assign

Access: Admin, Super Admin

Assign invigilators automatically.

Body: None.

## GET /api/admin/seat-plans/{id}

Access: Admin, Super Admin

Seat plan summary.

Body: None.

## GET /api/sections/mine

Access: Faculty

Teacher's current-semester sections with enrollment counts.

Body: None.

## GET /api/sections/{id}/students

Access: Admin, Super Admin, Faculty

Enrolled class list ordered by university ID; teachers may access only their own.

Sample query: `?format=json`

Body: None.

## PUT /api/admin/sections/faculty-assignments

Access: Admin, Super Admin

Assign teachers atomically using their final semester credit loads.

Sample body: `{"semesterId":"11111111-1111-4111-8111-111111111111","assignments":[{"sectionId":"11111111-1111-4111-8111-111111111111","facultyId":"11111111-1111-4111-8111-111111111111"}]}`

## POST /api/admin/sections

Access: Admin, Super Admin

Open section N+1 during PLANNING or REGISTRATION.

Sample body: `{"offeringId":"11111111-1111-4111-8111-111111111111","capacity":40,"facultyId":"11111111-1111-4111-8111-111111111111","roomId":"11111111-1111-4111-8111-111111111111","dayPatternId":"11111111-1111-4111-8111-111111111111","timeSlotId":"11111111-1111-4111-8111-111111111111"}`

## PATCH /api/admin/sections/{id}

Access: Admin, Super Admin

Change capacity, status or teacher; audit changes.

Sample body: `{"capacity":40,"status":"OPEN","facultyId":"11111111-1111-4111-8111-111111111111"}`

## PATCH /api/admin/sections/{id}/schedule

Access: Admin, Super Admin

Reschedule a published section and email enrolled students.

Sample body: `{"roomId":"11111111-1111-4111-8111-111111111111","dayPatternId":"11111111-1111-4111-8111-111111111111","timeSlotId":"11111111-1111-4111-8111-111111111111","reason":"Administrative correction"}`

## POST /api/admin/sections/{id}/cancel

Access: Admin, Super Admin

Cancel a section, recalculate bills and notify students.

Sample body: `{"reason":"Administrative correction"}`

## GET /api/semesters/current

Access: Any logged-in user

Current semester; students also receive registrationWindow for their batch and serverTime.

Body: None.

## GET /api/semesters

Access: Any logged-in user

List semesters with pagination and name/code search.

Sample query: `?page=1&limit=10`

Body: None.

## PATCH /api/admin/semesters/{id}/phase

Access: Admin, Super Admin

Move forward one phase with lifecycle gates and an audit record.

Sample body: `{"phase":"REGISTRATION"}`

## POST /api/admin/semesters

Access: Admin, Super Admin

Create a PLANNING semester only when every other semester is CLOSED.

Sample body: `{"code":"SPRING-2027","name":"Example name","classStartDate":"2027-01-10T00:00:00+06:00","examStartDate":"2027-04-10T00:00:00+06:00","examEndDate":"2027-04-20T00:00:00+06:00","gradeDeadline":"2027-04-30T00:00:00+06:00","maxCredits":15,"minPaymentPercent":40,"paymentDeadlineDays":12}`

## GET /api/admin/semesters/{id}

Access: Admin, Super Admin

Semester with counts of offerings, sections and registrations.

Body: None.

## PATCH /api/admin/semesters/{id}

Access: Admin, Super Admin

Update semester; dates accept offset timestamps anytime, rule fields only in PLANNING.

Sample body: `{"code":"SPRING-2027","name":"Example name","classStartDate":"2027-01-10T00:00:00+06:00","examStartDate":"2027-04-10T00:00:00+06:00","examEndDate":"2027-04-20T00:00:00+06:00","gradeDeadline":"2027-04-30T00:00:00+06:00","maxCredits":15,"minPaymentPercent":40,"paymentDeadlineDays":12}`

## GET /api/time-slots

Access: Any logged-in user

Weekly time slots sorted by startMinute.

Sample query: `?type=THEORY&page=1&limit=10`

Body: None.

## POST /api/admin/time-slots

Access: Admin, Super Admin

Create weekly slot with a generated HH:MM label; start precedes end; no active same-type overlap.

Sample body: `{"type":"THEORY","startMinute":510,"endMinute":600,"isActive":true}`

## PATCH /api/admin/time-slots/{id}

Access: Admin, Super Admin

Update slot; cannot change times used by the current published routine; same-type overlaps rejected.

Sample body: `{"type":"THEORY","startMinute":510,"endMinute":600,"isActive":true}`

## POST /api/admin/users/admins

Access: Admin, Super Admin

Create an Admin or Super Admin; only Super Admin may create Super Admin.

Sample body: `{"email":"student@uni.edu","name":"Example name","personalEmail":"student@example.com","role":"ADMIN"}`

## POST /api/admin/users/faculties

Access: Admin, Super Admin

Create faculty with temporary password emailed to personalEmail; department must exist.

Sample body: `{"maxCreditLoad":12,"name":"Example name","designation":"Lecturer","departmentId":"11111111-1111-4111-8111-111111111111","personalEmail":"student@example.com","email":"student@uni.edu"}`

## POST /api/admin/users/students

Access: Admin, Super Admin

Create an unactivated student and send an activation invite; email and universityId must be unused.

Sample body: `{"name":"Example name","universityId":"26-12345-1","personalEmail":"student@example.com","programId":"11111111-1111-4111-8111-111111111111","email":"student@uni.edu","contactNumber":"01700000000","batchId":"11111111-1111-4111-8111-111111111111"}`

## POST /api/admin/users/import

Access: Admin, Super Admin

Import student or faculty CSV in chunks of 500; returns created and failed row/reason entries; queues account emails.

Sample form-data: `{"file":"@file.csv","type":"student"}`

## GET /api/admin/users

Access: Admin, Super Admin

List non-deleted users with role profiles and pagination.

Sample query: `?page=1&limit=10`

Body: None.

## GET /api/admin/users/{id}

Access: Admin, Super Admin

Get user and role profile; student includes current semester registration.

Body: None.

## PATCH /api/admin/users/{id}/status

Access: Admin, Super Admin

Block or unblock a user; Admins may target faculty/students only; cannot target self; audited.

Sample body: `{"status":"ACTIVE"}`

## DELETE /api/admin/users/{id}

Access: Admin, Super Admin

Soft delete and revoke sessions; Admins may target faculty/students only; cannot target self; audited.

Body: None.

## PATCH /api/users/me

Access: Any logged-in user

Update your profile contact information and optional photo.

Sample form-data: `{"photo":"@photo.jpg","data":"{\"contactNumber\":\"01700000000\",\"personalEmail\":\"student@example.com\"}"}`

## GET /api/payments/bkash/callback

Access: Public

Receive the customer's return from bKash.

Sample query: `?paymentID=example&status=success`

Body: None.

## GET /docs/

Access: Public

Interactive Swagger API documentation.

Body: None.
