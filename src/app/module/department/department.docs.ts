/**
 * @openapi
 * /api/departments:
 *   get:
 *     tags: [Department]
 *     summary: List non-deleted departments with pagination and name/code search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: searchTerm
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, name, code], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200: { description: Paginated departments with meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 * /api/admin/departments:
 *   post:
 *     tags: [Department]
 *     summary: Create a department with a unique uppercase code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, minLength: 1 }
 *               name: { type: string, minLength: 1 }
 *     responses:
 *       201: { description: Department created }
 *       400: { description: Invalid input }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Code already exists }
 * /api/admin/departments/{id}:
 *   patch:
 *     tags: [Department]
 *     summary: Update department name or uppercase unique code
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
 *             type: object
 *             properties:
 *               code: { type: string, minLength: 1 }
 *               name: { type: string, minLength: 1 }
 *     responses:
 *       200: { description: Department updated }
 *       400: { description: Invalid input }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Department not found }
 *       409: { description: Code already exists }
 *   delete:
 *     tags: [Department]
 *     summary: Soft delete only when no non-deleted courses or faculty remain
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Department soft-deleted }
 *       400: { description: Invalid department id }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       404: { description: Department not found }
 *       409: { description: Department still has courses or faculty }
 */
