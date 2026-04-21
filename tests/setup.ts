import "@testing-library/jest-dom/vitest";

// Global test setup
// Add any shared mocks or test utilities here

// Core
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-min!!";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_NAME = "SocialBharat";

// Queue
process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";

// Payments
process.env.RAZORPAY_KEY_ID = "rzp_test_key";
process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";

// AI
process.env.OPENAI_API_KEY = "sk-test-openai-key";

// Email
process.env.RESEND_API_KEY = "test-resend-key";

// SMS
process.env.MSG91_AUTH_KEY = "test-msg91-key";
