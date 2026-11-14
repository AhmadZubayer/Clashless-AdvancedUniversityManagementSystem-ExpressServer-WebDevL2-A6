/**
 * @openapi
 * components:
 *   schemas:
 *     RegistrationWindowInput:
 *       type: object
 *       properties:
 *         semesterId: { type: string, format: uuid }
 *         batchId: { type: string, format: uuid }
 *         startsAt: { type: string, format: date-time, description: ISO timestamp with offset }
 *         endsAt: { type: string, format: date-time, description: ISO timestamp with offset; later than startsAt }
 */
/**
 * @openapi
 * /api/admin/registration-windows:
 *   post:
 *     tags: [RegistrationWindow]
 *     summary: Create one batch window per semester in PLANNING or REGISTRATION
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegistrationWindowInput'
 *               - type: object
 *                 required: [semesterId, batchId, startsAt, endsAt]
 *     responses:
 *       201: { description: Window created }
 *       400: { description: Invalid ids, offset timestamps or time range }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Semester or batch not found }
 *       409: { description: Duplicate window or PHASE_NOT_ALLOWED }
 */
/**
 * @openapi
 * /api/registration-windows:
 *   get:
 *     tags: [RegistrationWindow]
 *     summary: List semester windows; students see only their own batch; each row includes serverTime
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: semesterId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: searchTerm, schema: { type: string, description: Batch code search } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, startsAt, endsAt], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Windows with serverTime and pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 *       404: { description: Semester or student profile not found }
 */
/**
 * @openapi
 * /api/admin/registration-windows/{id}:
 *   patch:
 *     tags: [RegistrationWindow]
 *     summary: Edit before start or extend only endsAt with a reason while running; update batch payment deadlines atomically
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/RegistrationWindowInput'
 *               - type: object
 *                 properties:
 *                   reason: { type: string, minLength: 1, description: Required for a running-window extension }
 *     responses:
 *       200: { description: Window and affected registration deadlines updated; running extension audited }
 *       400: { description: Invalid data or missing extension reason }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Window, semester or batch not found }
 *       409: { description: Ended window, forbidden running change, duplicate, concurrent change or PHASE_NOT_ALLOWED }
 */
/**
 * @openapi
 * /api/admin/registration-windows/{id}:
 *   delete:
 *     tags: [RegistrationWindow]
 *     summary: Delete a window only before it starts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Window deleted }
 *       400: { description: Invalid id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Window not found }
 *       409: { description: Window has started or changed concurrently }
 */
