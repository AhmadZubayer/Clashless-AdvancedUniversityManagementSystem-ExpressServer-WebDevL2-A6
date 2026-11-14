/**
 * @openapi
 * components:
 *   schemas:
 *     SemesterInput:
 *       type: object
 *       properties:
 *         code: { type: string, minLength: 1 }
 *         name: { type: string, minLength: 1 }
 *         classStartDate: { type: string, format: date-time, nullable: true }
 *         examStartDate: { type: string, format: date-time, nullable: true }
 *         examEndDate: { type: string, format: date-time, nullable: true }
 *         gradeDeadline: { type: string, format: date-time, nullable: true }
 *         maxCredits: { type: number, minimum: 0, exclusiveMinimum: true, maximum: 999.9, multipleOf: 0.1, default: 15 }
 *         minPaymentPercent: { type: integer, minimum: 0, maximum: 100, default: 40 }
 *         paymentDeadlineDays: { type: integer, minimum: 0, default: 12 }
 */
/**
 * @openapi
 * /api/admin/semesters/{id}/phase:
 *   patch:
 *     tags: [Semester]
 *     summary: Move forward one phase with lifecycle gates and an audit record
 *     description: REGISTRATION requires a published class routine and window; CLASSES requires all windows ended; EXAMS requires a published exam routine and published plans for slots with courses; CLOSED requires published grades. GRADING has no extra gate.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phase]
 *             properties:
 *               phase: { type: string, enum: [PLANNING, REGISTRATION, CLASSES, EXAMS, GRADING, CLOSED] }
 *     responses:
 *       200: { description: Phase advanced and audit record saved }
 *       400: { description: Invalid id or phase }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Semester not found }
 *       409: { description: PHASE_NOT_ALLOWED with errorDetails.gate identifying the failed gate, or concurrent transition }
 */
/**
 * @openapi
 * /api/admin/semesters:
 *   post:
 *     tags: [Semester]
 *     summary: Create a PLANNING semester only when every other semester is CLOSED
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SemesterInput'
 *               - type: object
 *                 required: [code, name]
 *     responses:
 *       201: { description: Semester created with default rules 15 credits, 40 percent and 12 days }
 *       400: { description: Invalid input or date without offset }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Another semester is open or code already exists }
 */
/**
 * @openapi
 * /api/semesters:
 *   get:
 *     tags: [Semester]
 *     summary: List semesters with pagination and name/code search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, name, code], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Semesters with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 */
/**
 * @openapi
 * /api/semesters/current:
 *   get:
 *     tags: [Semester]
 *     summary: Current semester; students also receive registrationWindow for their batch and serverTime
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Current semester with phase and student-specific window }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 *       404: { description: No current semester or student profile missing }
 */
/**
 * @openapi
 * /api/admin/semesters/{id}:
 *   get:
 *     tags: [Semester]
 *     summary: Semester with counts of offerings, sections and registrations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Semester and counts }
 *       400: { description: Invalid id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Semester not found }
 */
/**
 * @openapi
 * /api/admin/semesters/{id}:
 *   patch:
 *     tags: [Semester]
 *     summary: Update semester; dates accept offset timestamps anytime, rule fields only in PLANNING
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SemesterInput'
 *     responses:
 *       200: { description: Semester updated }
 *       400: { description: Invalid data or date without offset }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Semester not found }
 *       409: { description: Duplicate code or PHASE_NOT_ALLOWED rule change }
 */
