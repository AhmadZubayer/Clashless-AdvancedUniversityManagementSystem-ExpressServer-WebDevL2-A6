/**
 * @openapi
 * /api/faculty-preferences/me:
 *   put:
 *     tags: [FacultyPreference]
 *     summary: Replace own preferences during PLANNING before any routine version exists
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId, items]
 *             properties:
 *               semesterId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 description: Empty list clears all preferences
 *                 items:
 *                   type: object
 *                   required: [day, timeSlotId, kind]
 *                   properties:
 *                     day: { type: string, enum: [SAT, SUN, MON, TUE, WED, THU, FRI] }
 *                     timeSlotId: { type: string, format: uuid }
 *                     kind: { type: string, enum: [PREFERRED, UNAVAILABLE] }
 *     responses:
 *       200: { description: Replaced atomically }
 *       400: { description: Invalid input or duplicate day/slot }
 *       401: { description: Authentication required }
 *       403: { description: Faculty access required }
 *       404: { description: Semester, faculty profile or active slot not found }
 *       409: { description: PHASE_NOT_ALLOWED or a routine version already exists }
 */
/**
 * @openapi
 * /api/faculty-preferences/me:
 *   get:
 *     tags: [FacultyPreference]
 *     summary: List own preferences
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: semesterId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, updatedAt], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *     responses:
 *       200: { description: Own preferences with time slots and pagination }
 *       400: { description: Invalid query }
 *       401: { description: Authentication required }
 *       403: { description: Faculty access required }
 *       404: { description: Semester or faculty profile not found }
 */
/**
 * @openapi
 * /api/admin/faculty-preferences:
 *   get:
 *     tags: [FacultyPreference]
 *     summary: List teachers' semester preferences
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: semesterId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: facultyId, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, updatedAt], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: searchTerm, schema: { type: string } }
 *     responses:
 *       200: { description: Preferences with teacher, time slots and pagination }
 *       400: { description: Invalid query }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Semester not found }
 */
