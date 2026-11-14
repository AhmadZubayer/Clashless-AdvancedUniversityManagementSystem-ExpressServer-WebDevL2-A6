/**
 * @openapi
 * components:
 *   schemas:
 *     CourseInput:
 *       type: object
 *       properties:
 *         code: { type: string, minLength: 1 }
 *         title: { type: string, minLength: 1 }
 *         credits: { type: number, minimum: 0.5, maximum: 6, multipleOf: 0.5 }
 *         type: { type: string, enum: [THEORY, LAB] }
 *         departmentId: { type: string, format: uuid }
 * /api/admin/courses:
 *   post:
 *     tags: [Course]
 *     summary: Create a course with unique uppercase code and half-credit increments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/CourseInput'
 *               - type: object
 *                 required: [code, title, credits, type, departmentId]
 *     responses:
 *       201: { description: Course created }
 *       400: { description: Invalid input or credits }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Department not found }
 *       409: { description: Duplicate course code }
 * /api/courses:
 *   get:
 *     tags: [Course]
 *     summary: Paginated course catalogue with department, type and name/code search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: departmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: type, schema: { type: string, enum: [THEORY, LAB] } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, code, title], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Courses with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 * /api/courses/{id}:
 *   get:
 *     tags: [Course]
 *     summary: Course with prerequisite grades and curriculum terms
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Course with prerequisites and curriculum }
 *       400: { description: Invalid id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 *       404: { description: Course not found }
 * /api/admin/courses/{id}:
 *   patch:
 *     tags: [Course]
 *     summary: Update course; credits/type locked while offered after PLANNING and before CLOSED
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CourseInput'
 *     responses:
 *       200: { description: Course updated }
 *       400: { description: Invalid course data }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Course or department not found }
 *       409: { description: Duplicate code or offered course rules are locked }
 *   delete:
 *     tags: [Course]
 *     summary: Soft delete a course only when no non-CLOSED semester offers it
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Course soft-deleted }
 *       400: { description: Invalid id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Course not found }
 *       409: { description: Course is offered in an active semester }
 * /api/admin/courses/{id}/prerequisites:
 *   put:
 *     tags: [Course]
 *     summary: Replace prerequisites atomically; rejects self-dependency and any graph cycle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [prerequisiteId]
 *               properties:
 *                 prerequisiteId: { type: string, format: uuid }
 *                 minGrade: { type: string, enum: [A, A_MINUS, B_PLUS, B, B_MINUS, C_PLUS, C, C_MINUS, D_PLUS, D, F, W], default: D }
 *     responses:
 *       200: { description: Replacement prerequisites with course records }
 *       400: { description: Invalid input or duplicate prerequisite }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Course or prerequisite not found }
 *       409: { description: Self-dependency, cycle or concurrent graph change }
 */
