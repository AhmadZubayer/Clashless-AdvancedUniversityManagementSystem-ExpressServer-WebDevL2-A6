/**
 * @openapi
 * /api/payments/create:
 *   post:
 *     tags:
 *       - Payment
 *     summary: Start a bKash payment for my current semester registration
 *     description: >
 *       The amount must bring paidAmount to at least the minimum payment (40% of totalFee)
 *       and can never exceed totalFee minus paidAmount. Only one payment may be pending.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 18400
 *               provider:
 *                 type: string
 *                 enum: [BKASH]
 *     responses:
 *       201:
 *         description: Returns paymentId and checkoutUrl
 *       400:
 *         description: PAYMENT_AMOUNT_INVALID with minimum and maximum
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not a student
 *       404:
 *         description: No registration for the current semester
 *       409:
 *         description: PAYMENT_IN_PROGRESS, PHASE_NOT_ALLOWED, REGISTRATION_DISCARDED or fully paid
 */

/**
 * @openapi
 * /api/payments/me:
 *   get:
 *     tags:
 *       - Payment
 *     summary: List my payments, newest first
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My payments
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not a student
 */

/**
 * @openapi
 * /api/payments/{id}:
 *   get:
 *     tags:
 *       - Payment
 *     summary: Get one payment (students only their own)
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
 *         description: The payment
 *       400:
 *         description: Invalid payment ID
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Another student's payment
 *       404:
 *         description: Payment not found
 */

/**
 * @openapi
 * /api/payments/{id}/receipt:
 *   get:
 *     tags:
 *       - Payment
 *     summary: Receipt PDF of a completed payment
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
 *         description: application/pdf
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Another student's payment
 *       404:
 *         description: Payment not found
 *       409:
 *         description: The payment is not COMPLETED
 */

/**
 * @openapi
 * /api/admin/payments:
 *   get:
 *     tags:
 *       - Payment
 *     summary: List all payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED, REFUND_PENDING, REFUND_FAILED, REFUNDED]
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: searchTerm
 *         description: universityId, transactionId or providerTransactionId
 *         schema:
 *           type: string
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
 *         description: Paginated payments
 *       401:
 *         description: Not logged in
 *       403:
 *         description: Not an admin
 */
