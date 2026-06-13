const Joi = require('joi');

const createStudentSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().optional().allow(''),
  password: Joi.string().min(8).default('Knotty@2024'),
  date_of_birth: Joi.date().optional().allow(null, ''),
  gender: Joi.string().valid('M', 'F', 'OTHER').optional(),
  nationality: Joi.string().optional().allow(''),
  level_id: Joi.string().optional().allow(''),
  class_id: Joi.string().optional().allow(''),
  parent_id: Joi.string().optional().allow(''),
});

const updateStudentSchema = Joi.object({
  first_name: Joi.string(),
  last_name: Joi.string(),
  phone: Joi.string().allow(''),
  date_of_birth: Joi.date().allow(null, ''),
  gender: Joi.string().valid('M', 'F', 'OTHER'),
  nationality: Joi.string().allow(''),
  level_id: Joi.string().allow(''),
  class_id: Joi.string().allow(''),
  parent_id: Joi.string().allow(''),
  is_active: Joi.boolean(),
});

module.exports = { createStudentSchema, updateStudentSchema };

