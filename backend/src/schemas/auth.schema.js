const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    email: z.string()
      .min(1, { message: "Email không được để trống" })
      .email({ message: "Email không đúng định dạng" }),
    password: z.string()
      .min(6, { message: "Mật khẩu phải chứa ít nhất 6 ký tự" })
      .max(50, { message: "Mật khẩu không được vượt quá 50 ký tự" })
  })
});

const loginSchema = z.object({
  body: z.object({
    email: z.string()
      .min(1, { message: "Email không được để trống" })
      .email({ message: "Email không đúng định dạng" }),
    password: z.string()
      .min(1, { message: "Mật khẩu không được để trống" })
  })
});

module.exports = {
  registerSchema,
  loginSchema
};
