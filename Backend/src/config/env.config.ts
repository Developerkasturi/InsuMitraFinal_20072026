// ─────────────────────────────────────────────────────────────────────────────
// Environment configuration factory loaded by ConfigModule
// ─────────────────────────────────────────────────────────────────────────────
export const envConfig = () => ({
  NODE_ENV:  process.env.NODE_ENV  || 'development',
  PORT:      parseInt(process.env.PORT || '3000', 10),
  API_PREFIX: process.env.API_PREFIX || 'api/v1',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host:     process.env.REDIS_HOST     || 'localhost',
    port:     parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    secret:          process.env.JWT_SECRET          || 'change_me_in_production',
    expiresIn:       process.env.JWT_EXPIRES_IN      || '7d',
    refreshSecret:   process.env.JWT_REFRESH_SECRET  || 'refresh_change_me',
    refreshExpiry:   process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    superadminSecret: process.env.JWT_SUPERADMIN_SECRET || 'superadmin_change_me',
  },

  aws: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region:          process.env.AWS_REGION     || 'ap-south-1',
    bucket:          process.env.AWS_S3_BUCKET  || 'insumitra-documents',
  },

  supabase: {
    url:          process.env.SUPABASE_URL,
    anonKey:      process.env.SUPABASE_ANON_KEY,
    serviceKey:   process.env.SUPABASE_SERVICE_KEY,
    bucket:       process.env.SUPABASE_STORAGE_BUCKET || 'insumitra-documents',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'supabase',  // 's3' | 'supabase'
  },

  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || '',
    apiKey: process.env.WHATSAPP_API_KEY || '',
  },

  throttle: {
    ttl:   parseInt(process.env.THROTTLE_TTL   || '60',  10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  brevo: {
    apiKey:      process.env.BREVO_API_KEY    || '',
    senderEmail: process.env.SENDER_EMAIL     || 'noreply@insumitra.com',
    senderName:  process.env.SENDER_NAME      || 'InsuMitra',
  },

  razorpay: {
    keyId:     process.env.RAZORPAY_KEY_ID     || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
});
