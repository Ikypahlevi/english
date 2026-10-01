const { z } = require('zod');

/**
 * Middleware để validate request sử dụng Zod schema
 * @param {z.ZodObject} schema 
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format lỗi của Zod thành mảng thông báo dễ đọc cho UI
      const errorMessages = error.errors.map((err) => `${err.path.join('.')} - ${err.message}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Dữ liệu không hợp lệ.', 
        errors: errorMessages 
      });
    }
    next(error);
  }
};

module.exports = validate;
