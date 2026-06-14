# MentorLink

MentorLink is a mentoring platform that connects students with mentors, built with React, TypeScript, Vite, Express, and Supabase.

---

## Repository Structure

- **Frontend:** Root directory (React + TypeScript + Vite)
- **Backend:** `/server` directory (Express.js + Node.js + Supabase client proxy)

---

## Local Development

### 1. Backend Setup
1. Navigate to the `/server` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and fill in your Supabase variables:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-anon-key
   FRONTEND_URL=http://localhost:5173
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. In the root directory, install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file based on `.env.example` in the root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_GROQ_API_KEY=your-groq-api-key
   VITE_API_URL=http://localhost:5000/api
   ```
3. Start the frontend client:
   ```bash
   npm run dev
   ```

---

## Deployment Guide

This project is configured to run the backend on **Railway** and the frontend on **Vercel**.

### 1. Deploying Backend to Railway

#### Recommended Method (Subdirectory Deployment)
1. Log in to [Railway](https://railway.app/) and create a new project from your GitHub repository.
2. In the service settings, go to **Settings** -> **Root Directory** and set it to `/server`.
3. Railway will automatically build and run the backend using `server/package.json`.

#### Alternative Method (Fallback Root Deployment)
If you deploy from the root directory directly without changing the root directory setting:
- The project includes a root [railway.json](file:///c:/Users/ADMIN/Downloads/MentorLink-main/MentorLink-main/railway.json) configuration which will instruct Nixpacks to start the server from the `/server` folder.

#### Environment Variables (Railway)
Configure the following environment variables in your Railway service:
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_KEY`: Your Supabase Service Role Key or Anon Key.
- `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://mentor-link.vercel.app`).

---

### 2. Deploying Frontend to Vercel

1. Log in to [Vercel](https://vercel.com/) and import your project repository.
2. Vercel will automatically detect the **Vite** framework.
3. Configure the following environment variables under **Environment Variables** in Vercel:
   - `VITE_API_URL`: Your Railway backend API URL (e.g., `https://your-backend.up.railway.app/api`).
   - `VITE_SUPABASE_URL`: Your Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
   - `VITE_GROQ_API_KEY`: Your Groq API Key.
4. Click **Deploy**. Vercel will build the React app and host the static files.

---

## Technologies Used

- **Frontend:** React, Vite, Framer Motion, Lucide React
- **Backend:** Node.js, Express, Multer, CORS
- **Database:** Supabase (PostgreSQL, Auth, Storage)
- **AI/LLM:** Groq SDK
