'use strict';

const express = require('express');
const { buildTeamsChatLink } = require('./teamsLink');

/**
 * Build the cases router.
 * @param {object} deps
 * @param {() => import('mongodb').Db} deps.getDb
 */
function buildCasesRouter({ getDb }) {
  const router = express.Router();

  // GET /api/cases — list, newest first, with pagination
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

      const db = getDb();
      const cursor = db
        .collection('serviceRequests')
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const [items, total] = await Promise.all([
        cursor.toArray(),
        db.collection('serviceRequests').countDocuments({}),
      ]);

      res.json({ items, total, limit, skip });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/cases/:caseNumber
  router.get('/:caseNumber', async (req, res, next) => {
    try {
      const db = getDb();
      const doc = await db
        .collection('serviceRequests')
        .findOne({ caseNumber: req.params.caseNumber });
      if (!doc) return res.status(404).json({ error: 'not_found' });

      res.json({
        ...doc,
        teamsChatUrl: buildTeamsChatLink({
          upn: req.user.username,
          caseNumber: doc.caseNumber,
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/cases/:caseNumber — limited fields (status, notes-like)
  router.patch('/:caseNumber', async (req, res, next) => {
    try {
      const { validateStatus } = require('./validation');
      const updates = {};
      if (req.body.status !== undefined) {
        if (!validateStatus(req.body.status)) {
          return res.status(400).json({ error: 'invalid_status' });
        }
        updates.status = req.body.status;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'no_updatable_fields' });
      }
      updates.updatedAt = new Date();

      const db = getDb();
      const result = await db
        .collection('serviceRequests')
        .findOneAndUpdate(
          { caseNumber: req.params.caseNumber },
          { $set: updates },
          { returnDocument: 'after' }
        );

      const doc = result && result.value ? result.value : result;
      if (!doc) return res.status(404).json({ error: 'not_found' });

      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { buildCasesRouter };
