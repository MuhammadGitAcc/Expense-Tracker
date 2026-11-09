'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const incomeController = require('../controllers/income.controller');
const {
  idParamSchema,
  createIncomeSchema,
  updateIncomeSchema,
  listIncomesQuerySchema,
} = require('../validators/income.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listIncomesQuerySchema }), incomeController.list);
router.post('/', validate({ body: createIncomeSchema }), incomeController.create);
router.get('/:id', validate({ params: idParamSchema }), incomeController.getOne);
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateIncomeSchema }),
  incomeController.update,
);
router.delete('/:id', validate({ params: idParamSchema }), incomeController.remove);

module.exports = router;
