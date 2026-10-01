const { z } = require('zod');

const updateRoleSchema = z.object({
  body: z.object({
    role: z.enum(['user', 'admin'], {
      required_error: "Role là bắt buộc",
      invalid_type_error: "Role chỉ được là 'user' hoặc 'admin'"
    })
  })
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'banned'], {
      required_error: "Status là bắt buộc",
      invalid_type_error: "Status chỉ được là 'active' hoặc 'banned'"
    })
  })
});

module.exports = {
  updateRoleSchema,
  updateStatusSchema
};
