'use strict';

const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const categoryController = require('../controllers/category.controller');
const {
  idParamSchema,
  listCategoriesQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} = require('../validators/category.validator');

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listCategoriesQuerySchema }), categoryController.list);
router.get('/:id', validate({ params: idParamSchema }), categoryController.getOne);
router.post('/', validate({ body: createCategorySchema }), categoryController.create);
router.put(
  '/:id',
  validate({ params: idParamSchema, body: updateCategorySchema }),
  categoryController.update,
);
router.delete('/:id', validate({ params: idParamSchema }), categoryController.remove);

module.exports = router;
