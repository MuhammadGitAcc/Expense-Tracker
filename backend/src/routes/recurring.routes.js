'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const recurringController = require('../controllers/recurring.controller');
const {
  idParamSchema,
  createRecurringSchema,
  updateRecurringSchema,
  listRecurringQuerySchema,
} = require('../validators/recurring.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listRecurringQuerySchema }), recurringController.list);
router.post('/', validate({ body: createRecurringSchema }), recurringController.create);
router.get('/:id', validate({ params: idParamSchema }), recurringController.getOne);
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateRecurringSchema }),
  recurringController.update,
);
router.post('/:id/pause', validate({ params: idParamSchema }), recurringController.pause);
router.post('/:id/resume', validate({ params: idParamSchema }), recurringController.resume);
router.delete('/:id', validate({ params: idParamSchema }), recurringController.remove);

module.exports = router;
