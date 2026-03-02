import dotenv from 'dotenv';

const envPath = process.env.NODE_ENV === 'staging'
  ? '.env.staging'
  : '.env.local';
dotenv.config({ path: envPath });

// IMPORTANTE: Cargar plugins de mongoose ANTES de importar modelos
import './database/mongoose-plugins';

import routes from './routes';
import express, { Application, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import beneficiariesRoutes from './routes/beneficiaries.routes';
import authRoutes from './modules/auth/auth.routes';
import { activityLoggerMiddleware } from './middlewares/activity-logger.middleware';

// Configuración
const NODE_ENV = process.env.NODE_ENV || 'development';

// Crear aplicación Express
const app: Application = express();

// Trust proxy (nginx) for rate limiting to use real client IP
app.set('trust proxy', 1);

// ORDEN CORRECTO DE MIDDLEWARES:
// 1. Seguridad
app.use(helmet());

// HIGH-04: CORS whitelist from env
const corsWhitelist = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [];
const devOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) {
      callback(null, true);
      return;
    }
    const allowed = NODE_ENV === 'development'
      ? [...corsWhitelist, ...devOrigins]
      : corsWhitelist;
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// 2. Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Compression
app.use(compression());

// 4. Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// 5. Rate Limiting (CRIT-04)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Demasiados intentos, intenta de nuevo en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo en un momento' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/forgot-password', authLimiter);
app.use('/api/', apiLimiter);

// 5.5. Activity Logger
app.use(activityLoggerMiddleware);

// 6. Rutas
app.use('/api/v1/auth', authRoutes); // Auth routes (login, logout, 2FA - todo consolidado)
app.use('/api/v1/beneficiaries', beneficiariesRoutes);
app.use('/api/v1', routes);

// Ruta raíz
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'API LenderoHub',
    version: '1.0.0',
    status: 'active',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth',
      '2fa': '/api/v1/auth/setup-2fa',
      api: '/api/v1',
      docs: '/api/docs'
    }
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    ruta: req.originalUrl,
    metodo: req.method,
    sugerencia: 'Verifica la documentación en /api/docs'
  });
});

// Error handler (MED-02: Don't expose error details in non-development)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  const status = err.status || 500;
  const message = NODE_ENV === 'development'
    ? (err.message || 'Error interno del servidor')
    : 'Error interno del servidor';

  res.status(status).json({
    success: false,
    error: message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Conectar a MongoDB
const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lenderohub';
    console.log('🔗 Connecting to MongoDB:', MONGO_URI.includes('mongodb+srv') ? 'Atlas' : 'Local');

    await mongoose.connect(MONGO_URI);
    
    console.log('✅ MongoDB conectado exitosamente');
    
    mongoose.connection.on('error', (error) => {
      console.error('❌ Error en MongoDB:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB desconectado');
    });
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    // Inicializar Finco
    const { initializeFinco } = await import('./integrations/finco');
    initializeFinco();
    // Inicializar integraciones
    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      // console.clear();  // Comentado para ver logs
      console.log('╔════════════════════════════════════════════════════╗');
      console.log('║                                                    ║');
      console.log('║         🚀 LenderoHUB Server Iniciado 🚀          ║');
      console.log('║                                                    ║');
      console.log('╚════════════════════════════════════════════════════╝');
      console.log('');
      console.log('📍 Configuración:');
      console.log(`   • Puerto: ${PORT}`);
      console.log(`   • Ambiente: ${NODE_ENV}`);
      console.log(`   • URL: http://localhost:${PORT}`);
      console.log(`   • 2FA: ${process.env.ENCRYPTION_KEY ? '✅ Habilitado' : '❌ Deshabilitado'}`);
      console.log('');
      console.log('🔗 Endpoints principales:');
      console.log(`   • Inicio: http://localhost:${PORT}/`);
      console.log(`   • Health: http://localhost:${PORT}/api/health`);
      console.log(`   • Login: http://localhost:${PORT}/api/v1/auth/login`);
      console.log(`   • Setup 2FA: http://localhost:${PORT}/api/v1/auth/setup-2fa`);
      console.log('');
      console.log('📝 Prueba rápida con curl:');
      console.log(`   curl http://localhost:${PORT}/api/health`);
      console.log('');
      console.log('✨ ¡Servidor listo para desarrollo!');
      console.log('   Presiona Ctrl+C para detener');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Iniciar servidor
startServer();

// Manejo de errores no capturados
process.on('unhandledRejection', (error: any) => {
  console.error('❌ Unhandled Rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error: any) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

export default app;
