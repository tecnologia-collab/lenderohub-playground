import path from 'path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { customAlphabet } from 'nanoid'
import { dayjs } from './dayjs'

const mimeToExtension: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
}

const bucketEnvKeys = ['AWS_BUCKET_NAME', 'AWS_S3_BUCKET', 'S3_BUCKET'] as const

function getBucketName(): string {
  const bucket = bucketEnvKeys
    .map((key) => process.env[key])
    .find((value) => typeof value === 'string' && value.trim().length > 0)
  if (!bucket) {
    throw new Error(`Bucket S3 no configurado. Define una de: ${bucketEnvKeys.join(', ')}`)
  }
  return bucket
}

function getRegion(): string {
  return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
}

function getCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return undefined
  }
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN
  }
}

const s3Client = new S3Client({
  region: getRegion(),
  credentials: getCredentials()
})

export interface UploadMetadata {
  key: string
  url: string
  mimeType: string
  size: number
  originalName: string
  bucket: string
}

function getFileExtension(file: Express.Multer.File): string {
  return mimeToExtension[file.mimetype] || path.extname(file.originalname)
}

function getPublicUrl(bucket: string, key: string): string {
  const region = getRegion()
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

async function uploadBuffer (
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  destination: string
): Promise<UploadMetadata> {
  const bucket = getBucketName()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: destination,
    Body: buffer,
    ContentType: mimeType
  })
  await s3Client.send(command)
  return {
    key: destination,
    url: getPublicUrl(bucket, destination),
    mimeType,
    size: buffer.byteLength,
    originalName: fileName,
    bucket
  }
}

export async function uploadDocument (
  file: Express.Multer.File,
  category: string,
  userId: string
): Promise<UploadMetadata> {
  const destinationPath = `${category}/${userId}`
  const destinationFilename = generateFilename(file.originalname)
  const destination = `${destinationPath}/${destinationFilename}`
  return await uploadBuffer(file.originalname, file.mimetype, file.buffer, destination)
}

export function generateFilename (originalName: string): string {
  const timestamp = Date.now()
  const ext = path.extname(originalName)
  return `${timestamp}${ext}`
}

export async function uploadMulterFileRandomizedSubdirectory (
  file: Express.Multer.File,
  destinationPath: string,
  destinationFilename: string,
  addExtensionToFile = false
): Promise<UploadMetadata> {
  const now = dayjs()
  const datePart = now.format('YYYYMMDDHHmmss')
  const generator = customAlphabet('0123456789', 7)
  const randomSuffix = generator()
  const subdirectory = `${datePart}-${randomSuffix}`
  const extension = addExtensionToFile ? getFileExtension(file) : ''
  const destination = `${destinationPath}/${subdirectory}/${destinationFilename}${extension}`
  return await uploadBuffer(file.originalname, file.mimetype, file.buffer, destination)
}
