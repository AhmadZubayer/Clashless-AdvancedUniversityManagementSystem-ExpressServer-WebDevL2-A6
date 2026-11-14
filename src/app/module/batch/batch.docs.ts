/**
 * @openapi
 * /api/admin/batches:
 *   post:
 *     tags: [Batch]
 *     summary: Create a unique batch and derive intake year and term from its code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, pattern: '^\d{2}-[1-3]$', example: '23-3' }
 *     responses:
 *       201: { description: Batch with derived intakeYear and intakeTerm }
 *       400: { description: Invalid batch code }
 *       401: { description: Missing or revoked session }
 *       403: { description: Admin role required }
 *       409: { description: Batch code already exists }
 * /api/batches:
 *   get:
 *     tags: [Batch]
 *     summary: List batches with pagination and code search
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
 *         schema: { type: string, enum: [createdAt, code], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200: { description: Batches with pagination meta }
 *       400: { description: Invalid query }
 *       401: { description: Missing or revoked session }
 *       403: { description: Password change required }
 */
