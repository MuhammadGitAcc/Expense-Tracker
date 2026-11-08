'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const accountController = require('../controllers/account.controller');
const {
  idParamSchema,
  listAccountsQuerySchema,
  createAccountSchema,
  updateAccountSchema,
  transferSchema,
  listTransfersQuerySchema,
} = require('../validators/account.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listAccountsQuerySchema }), accountController.list);
router.post('/', validate({ body: createAccountSchema }), accountController.create);

// "transfers" must come BEFORE "/:id", otherwise it would be read as an account id.
router.get(
  '/transfers',
  validate({ query: listTransfersQuerySchema }),
  accountController.listTransfers,
);
router.post('/transfers', validate({ body: transferSchema }), accountController.transfer);

router.get('/:id', validate({ params: idParamSchema }), accountController.getOne);
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateAccountSchema }),
  accountController.update,
);
router.post('/:id/archive', validate({ params: idParamSchema }), accountController.archive);
router.post('/:id/unarchive', validate({ params: idParamSchema }), accountController.unarchive);
router.delete('/:id', validate({ params: idParamSchema }), accountController.remove);

module.exports = router;
