# ReachInBox

Prerequisites
- Node.js (v18+) | MySQL | Redis (`localhost:6379`) | Elasticsearch (`localhost:9200`)

### 1. Backend (`/backend`)
```
cd backend
npm install
cp .env.example .env        # Add DB & Ethereal SMTP credentials
npx prisma db push          # Setup MySQL schema
npm run dev                 # Runs Express server & BullMQ worker
Port: 4000 | Queue Dashboard: http://localhost:4000/admin/queues
```
### 2. Frontend (/frontend)
```
cd frontend
npm install
cp .env.local        # Set NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
Port: 3000
```
### Environment Configuration
Backend (backend/.env)
```
Code snippet
PORT=4000
DATABASE_URL="mysql://root:password@localhost:3306/reachinbox"
BETTER_AUTH_SECRET="your-secret"
BETTER_AUTH_URL="http://localhost:4000"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
REDIS_URL="redis://localhost:6379"
ELASTICSEARCH_NODE="http://localhost:9200"
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER="your-ethereal-user"
SMTP_PASS="your-ethereal-password"
```
### Architecture Overview
Scheduling: Emails are saved as SCHEDULED in MySQL; a delayed job with precise timing delta is pushed to Redis via BullMQ.
Persistence: BullMQ stores delayed jobs natively in Redis Sorted Sets, ensuring jobs survive server restarts and re-sync automatically.
Concurrency & Rate Limiting: Workers process batches concurrently (concurrency: 5) while respecting strict rate limits ({ max: 10, duration: 1000 }) to protect SMTP limits.

### Features
Backend: Automated scheduler, full lifecycle state tracking (SCHEDULED, PROCESSING, SENT, FAILED), and Elasticsearch text indexing.
Frontend: Google OAuth login (Better Auth), real-time email status dashboard, and compose modal.
Testing: Integrated with Ethereal Email for safe SMTP testing.
