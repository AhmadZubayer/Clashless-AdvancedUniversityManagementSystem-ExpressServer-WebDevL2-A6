/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     tags: [User]
 *     summary: Update your profile contact information and optional photo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               data:
 *                 type: string
 *                 description: JSON with optional contactNumber and personalEmail
 *     responses:
 *       200:
 *         description: Profile updated, without password
 *       400:
 *         description: Invalid profile data
 *       401:
 *         description: Missing or revoked session
 *       403:
 *         description: Password change required
 */
