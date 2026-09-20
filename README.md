# SBC Platform (v2)

Student Benefit Card platform, split into two independently deployable services:

| Service      | Path        | Stack                         | Deploy target |
| ------------ | ----------- | ----------------------------- | ------------- |
| **Frontend** | `frontend/` | Next.js 16 (App Router)       | Vercel        |
| **Backend**  | `backend/`  | Express + TypeScript          | Render        |

The frontend is the user-facing web app. The backend is a standalone REST
API that owns all privileged logic (Firebase Admin, Razorpay payments,
payouts, referrals, redemptions, push notifications).

```
spc-platform-v2/
├── frontend/            # Next.js app (Vercel)
├── backend/             # Express API (Render)
├── .github/workflows/   # CI pipeline
├── render.yaml          # Render blueprint for the backend
├── firebase.json        # Firestore/Storage infra config
├── firestore.rules
├── firestore.indexes.json
└── storage.rules
```

## Architecture

- The frontend never talks to Firestore for privileged operations. It calls
  the backend at `NEXT_PUBLIC_API_BASE_URL` with a Firebase ID token in the
  `Authorization: Bearer <token>` header.
- The backend verifies the token with Firebase Admin, enforces authorization
  (e.g. the `admins` collection), and performs the write inside transactions.
- CORS on the backend is restricted to the origins listed in
  `FRONTEND_ORIGIN`.

### API routes (all under `/api`)

| Method | Path                          | Auth        |
| ------ | ----------------------------- | ----------- |
| POST   | `/api/payment/create-order`   | user        |
| POST   | `/api/payment/verify`         | user        |
| GET    | `/api/payout/history`         | user        |
| POST   | `/api/payout/request`         | user        |
| POST   | `/api/redemption/create`      | user        |
| POST   | `/api/referral/process`       | user        |
| POST   | `/api/referral/reconcile`     | user        |
| POST   | `/api/student/check-mobile`   | public      |
| POST   | `/api/business/check-mobile`  | public      |
| POST   | `/api/business/reset-password`| public      |
| POST   | `/api/admin/check-email`      | public      |
| GET    | `/api/admin/payouts`          | admin       |
| PATCH  | `/api/admin/payouts`          | admin       |
| POST   | `/api/admin/notifications/send` | admin     |

## Local development

Run the two services in separate terminals.

**Backend**
```bash
cd backend
cp .env.example .env   # fill in values
npm install
npm run dev            # http://localhost:8080
```

**Frontend**
```bash
cd frontend
cp .env.example .env   # set NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
npm install
npm run dev                  # http://localhost:3000
```

## Environment variables

No secrets are committed. Each service has a `.env.example` template.

**Backend** (`backend/.env` locally, Render dashboard in prod)
- `FRONTEND_ORIGIN` — comma-separated allowed origins for CORS
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY_BASE64` — base64-encoded service-account PEM
  (or `FIREBASE_ADMIN_PRIVATE_KEY` for the raw PEM)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `APP_PUBLIC_URL`, `NOTIFICATION_ICON_URL`

**Frontend** (`frontend/.env` locally, Vercel dashboard in prod)
- `NEXT_PUBLIC_API_BASE_URL` — the deployed backend URL
- `NEXT_PUBLIC_FIREBASE_*` — Firebase web config
- `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

## Deployment

### Backend → Render
1. New Web Service from this repo, or use the `render.yaml` blueprint.
2. Root directory: `backend`. Build: `npm ci && npm run build`. Start: `npm start`.
3. Add the backend env vars. Health check path: `/health`.
4. Note the service URL, e.g. `https://sbc-backend.onrender.com`.

### Frontend → Vercel
1. New Project from this repo with **Root Directory = `frontend`**.
2. Add the frontend env vars, setting `NEXT_PUBLIC_API_BASE_URL` to the Render URL.
3. Deploy. Then set the backend's `FRONTEND_ORIGIN` to the Vercel domain.

## CI

`.github/workflows/ci.yml` runs on every push/PR:
- **backend**: install → lint → typecheck → build (all blocking)
- **frontend**: install → lint (report only) → build (blocking)
