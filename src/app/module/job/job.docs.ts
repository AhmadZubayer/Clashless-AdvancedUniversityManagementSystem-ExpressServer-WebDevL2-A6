/**
 * @openapi
 * /api/admin/jobs/{id}:
 *   get:
 *     tags: [Job]
 *     summary: Poll generation job status and progress
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Status, progress 0–100, resultId, error and timing }
 *       400: { description: Invalid UUID }
 *       401: { description: Authentication required }
 *       403: { description: Admin access required }
 *       404: { description: Generation job not found }
 */
