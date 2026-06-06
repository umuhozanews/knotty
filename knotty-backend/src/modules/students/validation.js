const Joi = require('joi');

const createStudentSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().optional(),
  password: Joi.string().min(8).default('Knotty@2024'),
  date_of_birth: Joi.date().optional(),
  gender: Joi.string().valid('M', 'F', 'OTHER').optional(),
  nationality: Joi.string().optional(),
  level_id: Joi.string().uuid().optional(),
  class_id: Joi.string().uuid().optional(),
  parent_id: Joi.string().uuid().optional(),
});

const updateStudentSchema = Joi.object({
  first_name: Joi.string(),
  last_name: Joi.string(),
  phone: Joi.string(),
  date_of_birth: Joi.date(),
  gender: Joi.string().valid('M', 'F', 'OTHER'),
  nationality: Joi.string(),
  level_id: Joi.string().uuid(),
  class_id: Joi.string().uuid(),
  parent_id: Joi.string().uuid(),
  is_active: Joi.boolean(),
});

module.exports = { createStudentSchema, updateStudentSchema };
