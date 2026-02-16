import mongoose from 'mongoose';
import './mongoose-plugins';

export const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('⚠️  MONGODB_URI no configurado. Ejecutando sin DB.');
    return;
  }

  mongoose.set('strictQuery', true);

  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(uri);
  console.log('✅ MongoDB conectado');
};
