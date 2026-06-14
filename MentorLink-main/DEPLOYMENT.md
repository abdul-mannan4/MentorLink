# MentorLink Deployment Guide

This document details how to deploy the MentorLink platform: the React/Vite frontend on **Vercel** and the Express backend on **Railway**.

---

## 1. Project Folder Structure Constraint

Because the user settings on Vercel specify `MentorLink-main` as the Root Directory, all project files must reside within the nested `MentorLink-main` directory. The structure should be:

```
repository-root/
├── railway.json (at root, configures the backend directory)
└── MentorLink-main/
    ├── package.json (Frontend configs)
    ├── vite.config.ts
    ├── src/
    └── server/
        ├── package.json (Backend configs)
        └── index.js
```

---

## 2. Frontend Deployment (Vercel)

### Project Configuration
* **Root Directory**: Set to `MentorLink-main` in the Vercel project settings.
* **Build Command**: `tsc -b && vite build`
* **Output Directory**: `dist`
* **Framework Preset**: `Vite` (Vercel will detect this automatically once Root Directory is correctly specified).

### Environment Variables on Vercel
Go to **Project Settings** -> **Environment Variables** and add the following keys:

| Variable Name | Description | Example / Required Value |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL | `https://your-supabase-url.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Project Anon (Public) Key | `sb_publishable_...` or similar |
| `VITE_API_URL` | URL of the running backend server | `https://your-backend-railway-app.up.railway.app/api` |

---

## 3. Backend Deployment (Railway)

### Project Configuration
A root-level `railway.json` is configured in the repository root to automatically direct Railway to compile and execute the server in the nested directory:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "numReplicas": 1,
    "watchPaths": ["MentorLink-main/server/**"]
  }
}
```

Wait, make sure that `MentorLink-main/server/package.json` has a `"start"` script:
```json
"scripts": {
  "start": "node index.js",
  "dev": "nodemon index.js"
}
```

### Environment Variables on Railway
In your Railway backend service dashboard, add the following variables:

| Variable Name | Description | Example / Required Value |
| :--- | :--- | :--- |
| `PORT` | The port the backend listens on | `5000` (Railway injects this automatically) |
| `SUPABASE_URL` | Your Supabase Project URL | `https://your-supabase-url.supabase.co` |
| `SUPABASE_KEY` | Your Supabase Project Anon Key | `sb_publishable_...` or similar |
| `FRONTEND_URL` | The URL of your deployed Vercel frontend | `https://your-frontend-vercel-app.vercel.app` |

---

## 4. Database Setup (Supabase)

### Authentication Configuration
1. Go to your **Supabase Dashboard** -> **Authentication** -> **Providers** -> **Email**.
2. **Confirm Email**: If you want students to be logged in immediately upon registration without verifying an email link, **disable** "Confirm email" in the dashboard. If enabled, ensure that verification redirects or OTP is set up.
3. **Email Templates**: Customize email templates if necessary.

### Database Tables Requirements
Verify that the database has the following tables schema (refer to `supabase/migrations` or backend queries):
- `profile` (holds fields: `id` (uuid), `name`, `user_name`, `profile_picture`, `university_email`, `university_name`, `department`, `technology`, `batch`, `created_at`)
- `student_subjects` (holds fields: `student_id` (uuid), `course_name` (text), `created_at`)
- `mentor` (holds fields: `mentor_id` (uuid), `Description` (text), `no_of_replies` (int), `progress` (text), `rating` (float), `created_at`)
- `mentor_subjects` (holds fields: `mentor_id` (uuid), `course_name` (text), `marks` (int, default -1 to flag pending tests), `test_taken_at` (timestamptz))
- `question` (holds fields: `question_id` (int/uuid), `student_id` (uuid), `subject` (text), `topic` (text), `teacher_name` (text), `description` (text), `file_upload` (text), `uploaded_at` (timestamptz))
- `reply` (holds fields: `reply_id` (int/uuid), `question_id` (int/uuid), `mentor_id` (uuid), `content` (text), `created_at` (timestamptz))
- `notification` (holds fields: `notification_id` (int/uuid), `recipient_id` (uuid), `sender_id` (uuid), `question_id` (int/uuid), `type` (text), `is_read` (bool, default false), `created_at` (timestamptz))
- `likes` (holds fields: `user_id` (uuid), `item_id` (uuid), `item_type` (text))
