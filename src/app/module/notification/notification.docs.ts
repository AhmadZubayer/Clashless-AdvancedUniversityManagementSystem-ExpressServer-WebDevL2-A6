/**
 * @openapi
 * /api/notifications/me:
 *   get:
 *     tags:
 *       - Notification
 *     summary: My notifications, newest first
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated notifications
 *       401:
 *         description: Not logged in
 */

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags:
 *       - Notification
 *     summary: Mark all my notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Number of notifications updated
 *       401:
 *         description: Not logged in
 */

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags:
 *       - Notification
 *     summary: Mark one of my notifications as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: The notification
 *       401:
 *         description: Not logged in
 *       404:
 *         description: Not found, or it belongs to someone else
 */
