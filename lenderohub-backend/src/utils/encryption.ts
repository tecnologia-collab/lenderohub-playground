import crypto from 'crypto';

/**
 * 🔐 Módulo de Encriptación AES-256-GCM
 * Para encriptar secrets de 2FA antes de guardarlos en la base de datos
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Obtener clave de encriptación desde variable de entorno
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY no está configurada en variables de entorno');
  }
  
  // La clave debe ser de 32 bytes (64 caracteres hex)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY debe tener exactamente 64 caracteres hexadecimales (32 bytes)');
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encripta un texto usando AES-256-GCM
 * @param text - Texto a encriptar
 * @returns String encriptado en formato: iv:authTag:encryptedData (todo en hex)
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('No se puede encriptar un texto vacío');
  }
  
  try {
    const key = getEncryptionKey();
    
    // Generar IV aleatorio
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Crear cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encriptar
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Obtener authentication tag
    const authTag = cipher.getAuthTag();
    
    // Retornar: iv:authTag:encryptedData (todo en hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error: any) {
    console.error('Error al encriptar:', error.message);
    throw new Error('Error al encriptar datos sensibles');
  }
}

/**
 * Desencripta un texto encriptado con encrypt()
 * @param encryptedText - Texto encriptado en formato: iv:authTag:encryptedData
 * @returns Texto desencriptado
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('No se puede desencriptar un texto vacío');
  }
  
  try {
    const key = getEncryptionKey();
    
    // Separar componentes
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Formato de texto encriptado inválido');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    // Convertir de hex a Buffer
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Validar longitudes
    if (iv.length !== IV_LENGTH) {
      throw new Error('IV length inválido');
    }
    
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Auth tag length inválido');
    }
    
    // Crear decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Desencriptar
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    console.error('Error al desencriptar:', error.message);
    throw new Error('Error al desencriptar datos sensibles');
  }
}

/**
 * Genera una clave de encriptación aleatoria
 * Usar SOLO para generar la clave inicial, luego guardarla en .env
 * @returns Clave de 32 bytes en formato hex (64 caracteres)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash de un texto usando SHA-256
 * Útil para comparar secrets sin almacenarlos en texto plano
 * @param text - Texto a hashear
 * @returns Hash en formato hex
 */
export function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Ejemplo de uso y testing
if (require.main === module) {
  console.log('🔐 Testing Encryption Module\n');
  
  // 1. Generar clave
  console.log('1. Generando clave de encriptación...');
  const key = generateEncryptionKey();
  console.log(`   ENCRYPTION_KEY=${key}`);
  console.log(`   ⚠️  GUARDA ESTA CLAVE EN TU .env\n`);
  
  // 2. Test de encriptación (requiere ENCRYPTION_KEY en .env)
  if (process.env.ENCRYPTION_KEY) {
    console.log('2. Probando encriptación...');
    const secret = 'JBSWY3DPEHPK3PXP';
    console.log(`   Original: ${secret}`);
    
    const encrypted = encrypt(secret);
    console.log(`   Encriptado: ${encrypted}`);
    
    const decrypted = decrypt(encrypted);
    console.log(`   Desencriptado: ${decrypted}`);
    
    if (secret === decrypted) {
      console.log('   ✅ Encriptación funcionando correctamente\n');
    } else {
      console.log('   ❌ Error: No coinciden\n');
    }
  } else {
    console.log('2. ⚠️  Define ENCRYPTION_KEY en .env para probar\n');
  }
}
