const { z } = require('zod');

const vocabularySchema = z.object({
  word: z.string().optional().default(""),
  ipa: z.string().optional().default(""),
  meaning: z.string().optional().default("")
});

const sheetSchema = z.object({
  sheetName: z.string({
    required_error: "Tên sheet (sheetName) là bắt buộc",
    invalid_type_error: "Tên sheet phải là chuỗi"
  }),
  fileName: z.string().optional(),
  vocabularies: z.array(vocabularySchema).min(1, "Sheet phải có ít nhất 1 từ vựng")
});

const uploadExcelSchema = z.object({
  body: z.object({
    excelData: z.array(sheetSchema).min(1, "Dữ liệu excel không được rỗng")
  }).or(z.array(sheetSchema).min(1, "Dữ liệu excel không được rỗng")) // Support both {excelData: [...]} and [...] directly
});

module.exports = {
  uploadExcelSchema
};
