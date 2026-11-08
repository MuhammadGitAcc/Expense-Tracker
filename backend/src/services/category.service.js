'use strict';

const ApiError = require('../utils/ApiError');
const categoryRepository = require('../repositories/category.repository');

const NAME_TAKEN = 'A category with this name already exists';

const list = (userId, { type } = {}) => categoryRepository.listForUser(userId, { type });

/** A default category or one of the user's own, otherwise 404 (never reveals other users' data). */
async function getById(userId, id) {
  const category = await categoryRepository.findAccessibleById(id, userId);
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

/** Like getById, but default categories are read-only. */
async function getOwnCustom(userId, id) {
  const category = await getById(userId, id);
  if (category.isDefault) {
    throw ApiError.forbidden('Default categories cannot be changed or deleted');
  }
  return category;
}

async function create(userId, { name, type, icon, color }) {
  if (await categoryRepository.nameExists({ userId, type, name })) {
    throw ApiError.conflict(NAME_TAKEN);
  }
  try {
    return await categoryRepository.create({ userId, name, type, icon, color });
  } catch (err) {
    // Two requests at the same moment: the unique index in the database decides.
    if (err.code === '23505') throw ApiError.conflict(NAME_TAKEN);
    throw err;
  }
}

async function update(userId, id, fields) {
  const category = await getOwnCustom(userId, id);

  if (
    fields.name !== undefined &&
    (await categoryRepository.nameExists({
      userId,
      type: category.type,
      name: fields.name,
      excludeId: id,
    }))
  ) {
    throw ApiError.conflict(NAME_TAKEN);
  }

  try {
    const updated = await categoryRepository.update(id, userId, fields);
    if (!updated) throw ApiError.notFound('Category not found');
    return updated;
  } catch (err) {
    if (err.code === '23505') throw ApiError.conflict(NAME_TAKEN);
    throw err;
  }
}

/** Refuses to delete a category that transactions still use (the safety check). */
async function remove(userId, id) {
  await getOwnCustom(userId, id);

  const used = await categoryRepository.countUsage(id);
  if (used > 0) {
    throw ApiError.conflict(
      `This category is used by ${used} transaction(s). Move or delete them first`,
    );
  }
  await categoryRepository.deleteOwned(id, userId);
}

module.exports = { list, getById, create, update, remove };
