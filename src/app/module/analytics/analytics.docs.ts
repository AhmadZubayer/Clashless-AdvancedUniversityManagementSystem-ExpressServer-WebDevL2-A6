/**
 * @openapi
 * /api/admin/analytics:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Admin dashboard
 *     description: Per batch registered against total students, sections full against total with average fill, fully booked courses, fees billed against collected, counts by payment status, at risk and discarded, and room use from the published routine.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: semesterId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dashboard figures
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Semester not found
 */

/**
 * @openapi
 * /api/admin/analytics/registration-live:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Live registration view
 *     description: Open windows, selections per minute over the last 30 minutes, sections that filled in the last hour and the 10 fastest-filling courses.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Live figures
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 *       404:
 *         description: No current semester
 */

/**
 * @openapi
 * /api/analytics/me:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: My dashboard
 *     description: Teachers get teaching credits against max load, class sizes, invigilation duties and grade submission. Students get credits, CGPA, fee due and deadline, next class and next exam.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard for the caller's role
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not a teacher or student
 *       404:
 *         description: No current semester or profile
 */
