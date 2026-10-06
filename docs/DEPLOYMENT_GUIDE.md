# FinCore Production Deployment Guide (Free Tier)

This guide walks you through deploying **FinCore** completely free using:
- **Neon DB** — Serverless PostgreSQL Database
- **Render** — Backend ASP.NET Core Web API (Docker)
- **Vercel** — Frontend Vite + React Single-Page Application (SPA)
- *(Optional)* **Render** — Python FastAPI Multi-Agent Microservice

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     Vercel (Free CDN / Edge)    │
│     React + Vite Frontend       │
└────────────────┬────────────────┘
                 │ HTTPS (REST / SignalR)
                 ▼
┌─────────────────────────────────┐       ┌───────────────────────────────┐
│      Render (Free Web Service)  │──────▶│      Neon DB (Serverless PG)  │
│      ASP.NET Core Web API       │       │      PostgreSQL Free Tier     │
└────────────────┬────────────────┘       └───────────────────────────────┘
                 │ (Optional HTTP)
                 ▼
┌─────────────────────────────────┐
│      Render (Free Web Service)  │
│      Python Agentic AI FastAPI  │
└─────────────────────────────────┘
```

---

## Step 1: Set Up Neon DB (PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and sign up for a free account.
2. Click **Create Project**:
   - **Project Name:** `fincore-db`
   - **Postgres version:** 16 (or latest)
   - **Region:** Choose the region closest to you (e.g., `AWS US East (Ohio)` or `EU Central (Frankfurt)`).
3. Once created, in the **Dashboard**, locate your **Connection Details**:
   - Ensure the dropdown is set to **Postgres**.
   - Copy the connection string. It looks like:
     ```text
     postgresql://neondb_owner:npg_xxxxxx@ep-cool-feather-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
4. Keep this connection string handy for Step 2.

> **Note:** FinCore automatically detects Neon connection URIs (`postgres://` and `postgresql://`), parses host, port, credentials, enables SSL (`SSL Mode=Require;Trust Server Certificate=true;`), and includes a resilient connection retry policy to handle Neon's serverless cold starts seamlessly.

---

## Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign in.
2. Push your latest code changes to your GitHub / GitLab repository.
3. In Render Dashboard, click **New +** > **Web Service**.
4. Connect your Git repository (`FinCore-se3090`).
5. Configure the Web Service settings:
   - **Name:** `fincore-api` (or any custom name)
   - **Region:** Choose the same region or closest to your Neon DB (e.g. `Ohio (US East)`).
   - **Branch:** `main` (or your active branch)
   - **Root Directory:** Leave empty (uses root `Dockerfile`) or enter `backend/FinCore.Api`
   - **Runtime / Environment:** `Docker`
   - **Dockerfile Path:** `./Dockerfile` (or `backend/FinCore.Api/Dockerfile` if Root Directory is left empty)
   - **Instance Type:** `Free`
6. Scroll down to **Environment Variables** and add the following keys:

| Key | Value | Description |
| :--- | :--- | :--- |
| `ConnectionStrings__DefaultConnection` | `postgresql://neondb_owner:...` | Neon DB connection string from Step 1 |
| `ASPNETCORE_ENVIRONMENT` | `Production` | ASP.NET Core environment mode |
| `Jwt__Key` | `YourLongSuperSecretKeyAtLeast32Characters!` | Secret key for JWT signing |
| `Jwt__Issuer` | `FinCore` | JWT issuer |
| `EnableSwagger` | `true` | Allows testing Swagger UI on Render |
| `OpenAI__ApiKey` | *(Optional)* `sk-...` | Optional: OpenAI key for Semantic Kernel |
| `Brevo__ApiKey` | *(Optional)* | Optional: Brevo API key for emails |

7. Set **Health Check Path** (under *Advanced*):
   - Health Check Path: `/health`
8. Click **Create Web Service**.
9. Wait for the build and deployment to finish (approx. 2-4 minutes).
10. Once deployed, test your API by visiting:
    - `https://<your-render-app>.onrender.com/` (Should return JSON `{ status: "Online", ... }`)
    - `https://<your-render-app>.onrender.com/swagger` (Interactive API documentation)
    - `https://<your-render-app>.onrender.com/health` (Returns `{ status: "Healthy" }`)

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New...** > **Project**.
3. Import your GitHub repository (`FinCore-se3090`).
4. Configure the Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `web/FinCore-web`
   - **Build Command:** `npm run build` (detected automatically)
   - **Output Directory:** `dist` (detected automatically)
   - **Install Command:** `npm install`
5. Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://<your-render-app>.onrender.com` | URL of your deployed Render backend API |

> **Important:** Do not include a trailing slash in `VITE_API_URL`.

6. Click **Deploy**.
7. Vercel will build the frontend and provide your production URL (e.g. `https://fincore-web.vercel.app`).
8. Open the URL and test signing in with seeded credentials:
   - **Admin:** `admin@fincore.com` / `Admin@123`
   - **Analyst:** `analyst@fincore.com` / `Analyst@123`

---

## Step 4 (Optional): Deploy Python AI Microservice to Render

If you wish to host the LangGraph / FastAPI multi-agent intelligence service (`agentic-ai`):

1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect the same repository.
3. Configure settings:
   - **Name:** `fincore-agentic-ai`
   - **Root Directory:** `agentic-ai`
   - **Runtime:** `Docker`
   - **Instance Type:** `Free`
   - **Health Check Path:** `/health`
4. Add environment variables:
   - `OPENAI_API_KEY`: *(Your OpenAI API Key)*
5. Click **Create Web Service**.
6. Once deployed, copy its URL (e.g., `https://fincore-agentic-ai.onrender.com`).
7. In your backend service on Render (`fincore-api`), add the environment variable:
   - `AI_AGENT_URL` = `https://fincore-agentic-ai.onrender.com`

---

## Troubleshooting & FAQ

### 1. Render Free Tier Cold Starts
On the free plan, Render spins down inactive services after 15 minutes of inactivity. The first request after sleep may take ~30-50 seconds. Neon DB also wakes up in ~1 second. FinCore's EF Core setup includes automatic retry handling so connection attempts will not fail.

### 2. Client-side Routing (Vite SPA)
The included `web/FinCore-web/vercel.json` rewrites all non-asset requests to `/index.html`. This ensures subroutes like `/admin`, `/fraud`, and `/decision-history` work on page refresh without throwing 404 errors.

### 3. Database Migration & Seed Data
On application start, FinCore checks if database tables exist, executes EF Core migrations, and automatically seeds default users, transactions, and fraud rules if the database is newly created.
