'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const expenseController = require('../controllers/expense.controller');
const {
  idParamSchema,
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
} = require('../validators/expense.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listExpensesQuerySchema }), expenseController.list);
router.post('/', validate({ body: createExpenseSchema }), expenseController.create);
router.get('/:id', validate({ params: idParamSchema }), expenseController.getOne);
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateExpenseSchema }),
  expenseController.update,
);
router.delete('/:id', validate({ params: idParamSchema }), expenseController.remove);

module.exports = router;
