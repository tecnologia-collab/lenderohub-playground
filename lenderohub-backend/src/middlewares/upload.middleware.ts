import multer from 'multer'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const storage = multer.memoryStorage()

function fileFilter (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error('Formato de archivo inválido. Usa PDF o DOCX.'))
    return
  }
  cb(null, true)
}

export const commissionAgentUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
}).fields([
  { name: 'identificationDocumentFile', maxCount: 1 },
  { name: 'financialStatementFile', maxCount: 1 },
  { name: 'proofOfAddressFile', maxCount: 1 }
])

// Commission request invoice uploads (PDF + XML)
const invoiceMimeTypes = new Set([
  'application/pdf',
  'text/xml',
  'application/xml',
])

function invoiceFileFilter (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (!invoiceMimeTypes.has(file.mimetype)) {
    cb(new Error('Formato de archivo inválido. Usa PDF o XML.'))
    return
  }
  cb(null, true)
}

export const commissionRequestUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: invoiceFileFilter
}).fields([
  { name: 'invoicePDF', maxCount: 1 },
  { name: 'invoiceXML', maxCount: 1 }
])
