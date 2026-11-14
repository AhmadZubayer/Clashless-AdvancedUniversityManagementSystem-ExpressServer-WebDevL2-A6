/**
 * @openapi
 * components:
 *   schemas:
 *     ProgramInput:
 *       type: object
 *       properties:
 *         code: { type: string, minLength: 1 }
 *         name: { type: string, minLength: 1 }
 *         departmentId: { type: string, format: uuid }
 *         totalCreditsRequired: { type: number, minimum: 0, exclusiveMinimum: true, multipleOf: 0.1 }
 *         perCreditFee: { type: number, minimum: 0, exclusiveMinimum: true, multipleOf: 0.01 }
 *         semesterFee: { type: number, minimum: 0, exclusiveMinimum: true, multipleOf: 0.01 }
 * /api/admin/programs:
 *   post:
 *     tags: [Program]
 *     summary: Create a program with positive fees and an existing department
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/ProgramInput'
 *               - type: object
 *                 required: [code, name, departmentId, totalCreditsRequired, perCreditFee, semesterFee]
 *     responses:
 *       201: { description: Program created }
 *       400: { description: Invalid data or nonpositive fees }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Department not found }
 *       409: { description: Duplicate program code }
 * /api/programs:
 *   get:
 *     tags: [Program]
 *     summary: Paginated programs with optional department and name/code search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: departmentId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: searchTerm
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, name, code], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200: { description: Programs with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 * /api/programs/{id}:
 *   get:
 *     tags: [Program]
 *     summary: Program including curriculum courses ordered by term
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Program and curriculum }
 *       400: { description: Invalid id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 *       404: { description: Program not found }
 * /api/admin/programs/{id}:
 *   patch:
 *     tags: [Program]
 *     summary: Update program; fees cannot change during REGISTRATION
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProgramInput'
 *     responses:
 *       200: { description: Program updated }
 *       400: { description: Invalid data or nonpositive fees }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Program or department not found }
 *       409: { description: Duplicate code or PHASE_NOT_ALLOWED fee change }
 * /api/admin/programs/{id}/curriculum:
 *   put:
 *     tags: [Program]
 *     summary: Replace the entire curriculum atomically with existing non-deleted courses
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [courseId, term]
 *               properties:
 *                 courseId: { type: string, format: uuid }
 *                 term: { type: integer, minimum: 1, maximum: 12 }
 *     responses:
 *       200: { description: Replacement curriculum ordered by term }
 *       400: { description: Invalid term, id or duplicate course }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Program or course not found }
 */
