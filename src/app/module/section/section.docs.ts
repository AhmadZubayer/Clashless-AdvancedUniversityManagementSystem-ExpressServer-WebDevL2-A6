/**
 * @openapi
 * /api/sections/{id}/students:
 *   get:
 *     tags: [Section]
 *     summary: Enrolled class list ordered by university ID; teachers may access only their own
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, pdf], default: json } }
 *     responses:
 *       200:
 *         description: Student list or downloadable class list
 *         content:
 *           application/json: { schema: { type: object } }
 *           text/csv: { schema: { type: string } }
 *           application/pdf: { schema: { type: string, format: binary } }
 *       400: { description: Invalid ID or format }
 *       401: { description: Authentication required }
 *       403: { description: Admin or own assigned teacher required }
 *       404: { description: Section not found }
 */
/**
 * @openapi
 * /api/admin/sections/faculty-assignments:
 *   put:
 *     tags: [Section]
 *     summary: Assign teachers atomically using their final semester credit loads
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId, assignments]
 *             properties:
 *               semesterId: { type: string, format: uuid }
 *               assignments:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [sectionId, facultyId]
 *                   properties:
 *                     sectionId: { type: string, format: uuid }
 *                     facultyId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Every assignment saved }
 *       400: { description: Invalid input or duplicate section ID }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Semester, active section or active teacher not found }
 *       409: { description: Teacher overload or HARD_RULE_VIOLATION; no assignments saved }
 */
/**
 * @openapi
 * /api/sections/mine:
 *   get:
 *     tags: [Section]
 *     summary: Teacher's current-semester sections with enrollment counts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assigned sections with course and schedule }
 *       401: { description: Authentication required }
 *       403: { description: Faculty access required }
 *       404: { description: Faculty profile or current semester not found }
 */
/**
 * @openapi
 * /api/admin/sections:
 *   post:
 *     tags: [Section]
 *     summary: Open section N+1 during PLANNING or REGISTRATION
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offeringId]
 *             properties:
 *               offeringId: { type: string, format: uuid }
 *               capacity: { type: integer, minimum: 1, default: 40 }
 *               facultyId: { type: string, format: uuid }
 *               roomId: { type: string, format: uuid }
 *               dayPatternId: { type: string, format: uuid }
 *               timeSlotId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Created; schedule is required when a published routine exists }
 *       400: { description: Invalid input }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Offering or active teacher not found }
 *       409: { description: PHASE_NOT_ALLOWED, teacher overload or HARD_RULE_VIOLATION }
 */
/**
 * @openapi
 * /api/admin/sections/{id}:
 *   patch:
 *     tags: [Section]
 *     summary: Change capacity, status or teacher; audit changes
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               capacity: { type: integer, minimum: 1 }
 *               status: { type: string, enum: [OPEN, CLOSED] }
 *               facultyId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       200: { description: Updated; capacity changes publish a seat event }
 *       400: { description: Invalid input }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Section or teacher not found }
 *       409: { description: Capacity below enrollment, cancelled section, overload or schedule conflict }
 */
/**
 * @openapi
 * /api/admin/sections/{id}/schedule:
 *   patch:
 *     tags: [Section]
 *     summary: Reschedule a published section and email enrolled students
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roomId, dayPatternId, timeSlotId, reason]
 *             properties:
 *               roomId: { type: string, format: uuid }
 *               dayPatternId: { type: string, format: uuid }
 *               timeSlotId: { type: string, format: uuid }
 *               reason: { type: string, minLength: 1, maxLength: 1000 }
 *     responses:
 *       200: { description: Section and published routine entry updated atomically }
 *       400: { description: Invalid input }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Section not found }
 *       409: { description: Not published, HARD_RULE_VIOLATION or TIME_CLASH with affected students }
 */
/**
 * @openapi
 * /api/admin/sections/{id}/cancel:
 *   post:
 *     tags: [Section]
 *     summary: Cancel a section, recalculate bills and notify students
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 1, maxLength: 1000 }
 *     responses:
 *       200: { description: Cancelled; paid amounts retained as credit, audit and notifications saved }
 *       400: { description: Invalid input }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Section not found }
 *       409: { description: Already cancelled }
 */
