/**
 * @openapi
 * /api/admin/offerings:
 *   post:
 *     tags: [Offering]
 *     summary: Offer a course in PLANNING with sections numbered 1 through N in one transaction
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [semesterId, courseId, sectionCount]
 *             properties:
 *               semesterId: { type: string, format: uuid }
 *               courseId: { type: string, format: uuid }
 *               sectionCount: { type: integer, minimum: 1 }
 *               capacity: { type: integer, minimum: 1, default: 40 }
 *     responses:
 *       201: { description: Offering with course and numbered sections }
 *       400: { description: Invalid input }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Semester or course not found }
 *       409: { description: Duplicate offering, concurrent write or PHASE_NOT_ALLOWED }
 */
/**
 * @openapi
 * /api/offerings:
 *   get:
 *     tags: [Offering]
 *     summary: Staff course offerings with teacher, room, days, times, enrolledCount and capacity per section
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: semesterId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: departmentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: searchTerm, schema: { type: string, description: Course code/title search } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 100, default: 10 } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, updatedAt], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200: { description: Offerings and section details with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin or faculty role required }
 *       404: { description: Semester not found }
 */
/**
 * @openapi
 * /api/admin/offerings/{id}:
 *   delete:
 *     tags: [Offering]
 *     summary: Remove an offering and its sections during PLANNING, preserving enrollment history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Offering and sections removed }
 *       400: { description: Invalid id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Offering not found }
 *       409: { description: Enrollment history, concurrent write or PHASE_NOT_ALLOWED }
 */
