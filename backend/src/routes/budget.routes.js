'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const budgetController = require('../controllers/budget.controller');
const {
  idParamSchema,
  createBudgetSchema,
  updateBudgetSchema,
  listBudgetsQuerySchema,
} = require('../validators/budget.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listBudgetsQuerySchema }), budgetController.list);
router.post('/', validate({ body: createBudgetSchema }), budgetController.create);
router.get('/:id', validate({ params: idParamSchema }), budgetController.getOne);
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateBudgetSchema }),
  budgetController.update,
);
router.delete('/:id', validate({ params: idParamSchema }), budgetController.remove);

module.exports = router;
