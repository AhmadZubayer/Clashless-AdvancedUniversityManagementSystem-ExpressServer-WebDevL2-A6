-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FACULTY', 'STUDENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'CREDENTIAL');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('BKASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUND_FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('THEORY', 'LAB');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('CLASSROOM', 'LAB');

-- CreateEnum
CREATE TYPE "SlotType" AS ENUM ('THEORY', 'LAB');

-- CreateEnum
CREATE TYPE "SemesterPhase" AS ENUM ('PLANNING', 'REGISTRATION', 'CLASSES', 'EXAMS', 'GRADING', 'CLOSED');

-- CreateEnum
CREATE TYPE "SectionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PreferenceKind" AS ENUM ('UNAVAILABLE', 'PREFERRED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'DISCARDED');

-- CreateEnum
CREATE TYPE "RegistrationPaymentStatus" AS ENUM ('UNPAID', 'MINIMUM_PAID', 'FULLY_PAID');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ENROLLED', 'DROPPED', 'DISCARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SeatOrder" AS ENUM ('STUDENT_ID', 'NAME');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('CLASS_ROUTINE', 'EXAM_ROUTINE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LetterGrade" AS ENUM ('A', 'A_MINUS', 'B_PLUS', 'B', 'B_MINUS', 'C_PLUS', 'C', 'C_MINUS', 'D_PLUS', 'D', 'F', 'W');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "contactNumber" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "intakeYear" INTEGER NOT NULL,
    "intakeTerm" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "credits" DECIMAL(3,1) NOT NULL,
    "type" "CourseType" NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_offerings" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "examSlotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "id" TEXT NOT NULL,
    "minGrade" "LetterGrade" NOT NULL DEFAULT 'D',
    "courseId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_results" (
    "id" TEXT NOT NULL,
    "grade" "LetterGrade" NOT NULL,
    "gradePoint" DECIMAL(3,2) NOT NULL,
    "credits" DECIMAL(3,1) NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semesterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_courses" (
    "id" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "programId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_patterns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "SlotType" NOT NULL,
    "days" "Weekday"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ENROLLED',
    "credits" DECIMAL(3,1) NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "droppedAt" TIMESTAMP(3),
    "grade" "LetterGrade",
    "gradeSubmittedAt" TIMESTAMP(3),
    "registrationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_routines" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "report" JSONB,
    "publishedAt" TIMESTAMP(3),
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_routine_entries" (
    "id" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "examRoutineId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "examSlotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_routine_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_slots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "personalEmail" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "maxCreditLoad" DECIMAL(4,1) NOT NULL DEFAULT 12,
    "contactNumber" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_slot_preferences" (
    "id" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "kind" "PreferenceKind" NOT NULL,
    "facultyId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_slot_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "resultId" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "semesterId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invigilator_assignments" (
    "id" TEXT NOT NULL,
    "seatPlanId" TEXT NOT NULL,
    "seatPlanRoomId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invigilator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "providerRefundId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'BKASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "registrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalCreditsRequired" DECIMAL(5,1) NOT NULL,
    "perCreditFee" DECIMAL(10,2) NOT NULL,
    "semesterFee" DECIMAL(10,2) NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_windows" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "semesterId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "building" TEXT NOT NULL,
    "roomNo" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "score" INTEGER,
    "report" JSONB,
    "publishedAt" TIMESTAMP(3),
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_entries" (
    "id" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "routineId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dayPatternId" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_assignments" (
    "id" TEXT NOT NULL,
    "column" INTEGER NOT NULL,
    "seatNo" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "seatPlanId" TEXT NOT NULL,
    "seatPlanRoomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_plans" (
    "id" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "orderBy" "SeatOrder" NOT NULL DEFAULT 'STUDENT_ID',
    "report" JSONB,
    "generatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "semesterId" TEXT NOT NULL,
    "examSlotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_plan_rooms" (
    "id" TEXT NOT NULL,
    "roomNo" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "seatsPerColumn" INTEGER NOT NULL,
    "columns" INTEGER NOT NULL,
    "fillOrder" INTEGER NOT NULL,
    "seatPlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_plan_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "sectionNo" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 40,
    "enrolledCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SectionStatus" NOT NULL DEFAULT 'OPEN',
    "offeringId" TEXT NOT NULL,
    "facultyId" TEXT,
    "roomId" TEXT,
    "dayPatternId" TEXT,
    "timeSlotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" "SemesterPhase" NOT NULL DEFAULT 'PLANNING',
    "classStartDate" TIMESTAMP(3),
    "examStartDate" TIMESTAMP(3),
    "examEndDate" TIMESTAMP(3),
    "gradeDeadline" TIMESTAMP(3),
    "maxCredits" DECIMAL(4,1) NOT NULL DEFAULT 15,
    "minPaymentPercent" INTEGER NOT NULL DEFAULT 40,
    "paymentDeadlineDays" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semester_registrations" (
    "id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentStatus" "RegistrationPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "totalCredits" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "totalFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentDeadline" TIMESTAMP(3) NOT NULL,
    "discardedAt" TIMESTAMP(3),
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "personalEmail" TEXT,
    "contactNumber" TEXT,
    "cgpa" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "earnedCredits" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "SlotType" NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIAL',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "needPasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imagePublicId" TEXT NOT NULL DEFAULT '',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admins_userId_key" ON "admins"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "batches_code_key" ON "batches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_departmentId_idx" ON "courses"("departmentId");

-- CreateIndex
CREATE INDEX "course_offerings_semesterId_idx" ON "course_offerings"("semesterId");

-- CreateIndex
CREATE INDEX "course_offerings_courseId_idx" ON "course_offerings"("courseId");

-- CreateIndex
CREATE INDEX "course_offerings_examSlotId_idx" ON "course_offerings"("examSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "course_offerings_semesterId_courseId_key" ON "course_offerings"("semesterId", "courseId");

-- CreateIndex
CREATE INDEX "course_prerequisites_courseId_idx" ON "course_prerequisites"("courseId");

-- CreateIndex
CREATE INDEX "course_prerequisites_prerequisiteId_idx" ON "course_prerequisites"("prerequisiteId");

-- CreateIndex
CREATE UNIQUE INDEX "course_prerequisites_courseId_prerequisiteId_key" ON "course_prerequisites"("courseId", "prerequisiteId");

-- CreateIndex
CREATE INDEX "course_results_studentId_courseId_idx" ON "course_results"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "course_results_courseId_idx" ON "course_results"("courseId");

-- CreateIndex
CREATE INDEX "course_results_semesterId_idx" ON "course_results"("semesterId");

-- CreateIndex
CREATE INDEX "curriculum_courses_programId_term_idx" ON "curriculum_courses"("programId", "term");

-- CreateIndex
CREATE INDEX "curriculum_courses_courseId_idx" ON "curriculum_courses"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_courses_programId_courseId_key" ON "curriculum_courses"("programId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "day_patterns_code_key" ON "day_patterns"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "enrollments_registrationId_idx" ON "enrollments"("registrationId");

-- CreateIndex
CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");

-- CreateIndex
CREATE INDEX "enrollments_sectionId_status_idx" ON "enrollments"("sectionId", "status");

-- CreateIndex
CREATE INDEX "enrollments_offeringId_status_idx" ON "enrollments"("offeringId", "status");

-- CreateIndex
CREATE INDEX "enrollments_semesterId_idx" ON "enrollments"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_sectionId_key" ON "enrollments"("studentId", "sectionId");

-- CreateIndex
CREATE INDEX "exam_routines_semesterId_idx" ON "exam_routines"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_routines_semesterId_version_key" ON "exam_routines"("semesterId", "version");

-- CreateIndex
CREATE INDEX "exam_routine_entries_examRoutineId_idx" ON "exam_routine_entries"("examRoutineId");

-- CreateIndex
CREATE INDEX "exam_routine_entries_offeringId_idx" ON "exam_routine_entries"("offeringId");

-- CreateIndex
CREATE INDEX "exam_routine_entries_examSlotId_idx" ON "exam_routine_entries"("examSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_routine_entries_examRoutineId_offeringId_key" ON "exam_routine_entries"("examRoutineId", "offeringId");

-- CreateIndex
CREATE INDEX "exam_slots_semesterId_idx" ON "exam_slots"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_slots_semesterId_date_startMinute_key" ON "exam_slots"("semesterId", "date", "startMinute");

-- CreateIndex
CREATE UNIQUE INDEX "faculties_email_key" ON "faculties"("email");

-- CreateIndex
CREATE UNIQUE INDEX "faculties_userId_key" ON "faculties"("userId");

-- CreateIndex
CREATE INDEX "faculties_departmentId_idx" ON "faculties"("departmentId");

-- CreateIndex
CREATE INDEX "faculty_slot_preferences_facultyId_idx" ON "faculty_slot_preferences"("facultyId");

-- CreateIndex
CREATE INDEX "faculty_slot_preferences_semesterId_idx" ON "faculty_slot_preferences"("semesterId");

-- CreateIndex
CREATE INDEX "faculty_slot_preferences_timeSlotId_idx" ON "faculty_slot_preferences"("timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "faculty_slot_preferences_facultyId_semesterId_day_timeSlotI_key" ON "faculty_slot_preferences"("facultyId", "semesterId", "day", "timeSlotId");

-- CreateIndex
CREATE INDEX "generation_jobs_semesterId_type_idx" ON "generation_jobs"("semesterId", "type");

-- CreateIndex
CREATE INDEX "generation_jobs_createdById_idx" ON "generation_jobs"("createdById");

-- CreateIndex
CREATE INDEX "invigilator_assignments_seatPlanId_idx" ON "invigilator_assignments"("seatPlanId");

-- CreateIndex
CREATE INDEX "invigilator_assignments_seatPlanRoomId_idx" ON "invigilator_assignments"("seatPlanRoomId");

-- CreateIndex
CREATE INDEX "invigilator_assignments_facultyId_idx" ON "invigilator_assignments"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "invigilator_assignments_seatPlanId_facultyId_key" ON "invigilator_assignments"("seatPlanId", "facultyId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerTransactionId_key" ON "payments"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerRefundId_key" ON "payments"("providerRefundId");

-- CreateIndex
CREATE INDEX "payments_registrationId_idx" ON "payments"("registrationId");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE INDEX "programs_departmentId_idx" ON "programs"("departmentId");

-- CreateIndex
CREATE INDEX "registration_windows_semesterId_idx" ON "registration_windows"("semesterId");

-- CreateIndex
CREATE INDEX "registration_windows_batchId_idx" ON "registration_windows"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_windows_semesterId_batchId_key" ON "registration_windows"("semesterId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "routines_semesterId_idx" ON "routines"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "routines_semesterId_version_key" ON "routines"("semesterId", "version");

-- CreateIndex
CREATE INDEX "routine_entries_routineId_idx" ON "routine_entries"("routineId");

-- CreateIndex
CREATE INDEX "routine_entries_sectionId_idx" ON "routine_entries"("sectionId");

-- CreateIndex
CREATE INDEX "routine_entries_roomId_idx" ON "routine_entries"("roomId");

-- CreateIndex
CREATE INDEX "routine_entries_dayPatternId_idx" ON "routine_entries"("dayPatternId");

-- CreateIndex
CREATE INDEX "routine_entries_timeSlotId_idx" ON "routine_entries"("timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "routine_entries_routineId_sectionId_key" ON "routine_entries"("routineId", "sectionId");

-- CreateIndex
CREATE INDEX "seat_assignments_seatPlanId_idx" ON "seat_assignments"("seatPlanId");

-- CreateIndex
CREATE INDEX "seat_assignments_seatPlanRoomId_idx" ON "seat_assignments"("seatPlanRoomId");

-- CreateIndex
CREATE INDEX "seat_assignments_studentId_idx" ON "seat_assignments"("studentId");

-- CreateIndex
CREATE INDEX "seat_assignments_offeringId_idx" ON "seat_assignments"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "seat_assignments_seatPlanRoomId_column_seatNo_key" ON "seat_assignments"("seatPlanRoomId", "column", "seatNo");

-- CreateIndex
CREATE UNIQUE INDEX "seat_assignments_seatPlanId_studentId_key" ON "seat_assignments"("seatPlanId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "seat_plans_examSlotId_key" ON "seat_plans"("examSlotId");

-- CreateIndex
CREATE INDEX "seat_plans_semesterId_idx" ON "seat_plans"("semesterId");

-- CreateIndex
CREATE INDEX "seat_plan_rooms_seatPlanId_idx" ON "seat_plan_rooms"("seatPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "seat_plan_rooms_seatPlanId_roomNo_key" ON "seat_plan_rooms"("seatPlanId", "roomNo");

-- CreateIndex
CREATE UNIQUE INDEX "seat_plan_rooms_seatPlanId_fillOrder_key" ON "seat_plan_rooms"("seatPlanId", "fillOrder");

-- CreateIndex
CREATE INDEX "sections_offeringId_idx" ON "sections"("offeringId");

-- CreateIndex
CREATE INDEX "sections_facultyId_idx" ON "sections"("facultyId");

-- CreateIndex
CREATE INDEX "sections_roomId_idx" ON "sections"("roomId");

-- CreateIndex
CREATE INDEX "sections_dayPatternId_idx" ON "sections"("dayPatternId");

-- CreateIndex
CREATE INDEX "sections_timeSlotId_idx" ON "sections"("timeSlotId");

-- CreateIndex
CREATE UNIQUE INDEX "sections_offeringId_sectionNo_key" ON "sections"("offeringId", "sectionNo");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code");

-- CreateIndex
CREATE INDEX "semester_registrations_studentId_idx" ON "semester_registrations"("studentId");

-- CreateIndex
CREATE INDEX "semester_registrations_semesterId_idx" ON "semester_registrations"("semesterId");

-- CreateIndex
CREATE INDEX "semester_registrations_status_paymentDeadline_idx" ON "semester_registrations"("status", "paymentDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "semester_registrations_studentId_semesterId_key" ON "semester_registrations"("studentId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "students_universityId_key" ON "students"("universityId");

-- CreateIndex
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE INDEX "students_programId_idx" ON "students"("programId");

-- CreateIndex
CREATE INDEX "students_batchId_idx" ON "students"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "time_slots_type_startMinute_key" ON "time_slots"("type", "startMinute");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_offerings" ADD CONSTRAINT "course_offerings_examSlotId_fkey" FOREIGN KEY ("examSlotId") REFERENCES "exam_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_results" ADD CONSTRAINT "course_results_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_results" ADD CONSTRAINT "course_results_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_results" ADD CONSTRAINT "course_results_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_courses" ADD CONSTRAINT "curriculum_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "semester_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_routines" ADD CONSTRAINT "exam_routines_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_routine_entries" ADD CONSTRAINT "exam_routine_entries_examRoutineId_fkey" FOREIGN KEY ("examRoutineId") REFERENCES "exam_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_routine_entries" ADD CONSTRAINT "exam_routine_entries_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_routine_entries" ADD CONSTRAINT "exam_routine_entries_examSlotId_fkey" FOREIGN KEY ("examSlotId") REFERENCES "exam_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_slots" ADD CONSTRAINT "exam_slots_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculties" ADD CONSTRAINT "faculties_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_slot_preferences" ADD CONSTRAINT "faculty_slot_preferences_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_slot_preferences" ADD CONSTRAINT "faculty_slot_preferences_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_slot_preferences" ADD CONSTRAINT "faculty_slot_preferences_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invigilator_assignments" ADD CONSTRAINT "invigilator_assignments_seatPlanId_fkey" FOREIGN KEY ("seatPlanId") REFERENCES "seat_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invigilator_assignments" ADD CONSTRAINT "invigilator_assignments_seatPlanRoomId_fkey" FOREIGN KEY ("seatPlanRoomId") REFERENCES "seat_plan_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invigilator_assignments" ADD CONSTRAINT "invigilator_assignments_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "semester_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_windows" ADD CONSTRAINT "registration_windows_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_windows" ADD CONSTRAINT "registration_windows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_dayPatternId_fkey" FOREIGN KEY ("dayPatternId") REFERENCES "day_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_entries" ADD CONSTRAINT "routine_entries_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_seatPlanId_fkey" FOREIGN KEY ("seatPlanId") REFERENCES "seat_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_seatPlanRoomId_fkey" FOREIGN KEY ("seatPlanRoomId") REFERENCES "seat_plan_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_plans" ADD CONSTRAINT "seat_plans_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_plans" ADD CONSTRAINT "seat_plans_examSlotId_fkey" FOREIGN KEY ("examSlotId") REFERENCES "exam_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_plan_rooms" ADD CONSTRAINT "seat_plan_rooms_seatPlanId_fkey" FOREIGN KEY ("seatPlanId") REFERENCES "seat_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_dayPatternId_fkey" FOREIGN KEY ("dayPatternId") REFERENCES "day_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_registrations" ADD CONSTRAINT "semester_registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_registrations" ADD CONSTRAINT "semester_registrations_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
