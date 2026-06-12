import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// The deployed frontend origin (Vercel). Must be set in Railway env vars.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Enable CORS for frontend
const allowedOrigins = [FRONTEND_URL, "http://localhost:5173"];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin === o || origin.endsWith(".vercel.app"))) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
// IMPORTANT: SUPABASE_KEY must be your Supabase SERVICE ROLE key (not anon key)
// The service role key is needed for admin.listUsers() and admin.signOut()
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
  process.exit(1);
}

// We use the supabase client to query database
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer configuration for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ================= AUTH MIDDLEWARE =================
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(401).json({ error: "Unauthorized: Auth failed" });
  }
}

// ================= AUTHENTICATION ENDPOINTS =================

// ─── Check if email already exists (called before signup to show proper error) ───
app.post("/api/auth/check-email", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // Use admin API to look up user by email
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      // Fallback: just say email is available (signup will catch it)
      return res.json({ exists: false });
    }
    const exists = data.users.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    return res.json({ exists });
  } catch (err) {
    return res.json({ exists: false });
  }
});

// Signup Route with Backend Regex Validation
app.post("/api/auth/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Enforce student email regex on backend to prevent bypass
  const regex = /^(2[0-9])ntucsfl\d{4}@student\.ntu\.edu\.pk$/;
  if (!regex.test(email)) {
    return res.status(400).json({
      error: "Invalid email format. Use: 20ntucsfl1000@student.ntu.edu.pk"
    });
  }

  try {
    // ── PRIMARY CHECK: Use admin API to detect existing user BEFORE signUp ──
    // This works for BOTH confirmed AND unconfirmed existing users.
    // Requires SUPABASE_KEY to be the SERVICE ROLE key on Railway.
    try {
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
      if (!listErr && listData) {
        const existingUser = listData.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (existingUser) {
          return res.status(400).json({
            error: "Email already registered. Please sign in."
          });
        }
      }
      // If listUsers fails (anon key used), fall through to signUp + timestamp check
    } catch (adminErr) {
      console.warn("admin.listUsers() failed — using timestamp fallback.");
    }

    // ── Use FRONTEND_URL for the redirect so email links go to Vercel, not Railway ──
    const emailRedirectTo = `${FRONTEND_URL}/email-verified`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo }
    });

    if (error) {
      // Supabase throws "Error sending confirmation email" when SMTP fails.
      // This can happen if: user already exists (unconfirmed) OR real SMTP issue.
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes("sending confirmation") || errMsg.includes("smtp") || errMsg.includes("email")) {
        // Could be existing user — return a safe, actionable error
        return res.status(400).json({
          error: "Unable to send verification email. If you already have an account, please sign in instead."
        });
      }
      return res.status(400).json({ error: error.message });
    }

    // ── FALLBACK CHECK 1: Empty identities = confirmed existing user (Supabase quirk) ──
    if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
      return res.status(400).json({ error: "Email already registered. Please sign in." });
    }

    // ── FALLBACK CHECK 2: Timestamp check for UNCONFIRMED existing users ──
    // When admin.listUsers() is unavailable (anon key), Supabase re-sends the
    // confirmation email to an existing unconfirmed user and returns a valid user
    // object with populated identities. We detect this by checking created_at:
    // a freshly created user is < 10 seconds old; an existing one is older.
    if (data?.user?.created_at) {
      const createdAt = new Date(data.user.created_at).getTime();
      const ageSeconds = (Date.now() - createdAt) / 1000;
      if (ageSeconds > 10) {
        // User was created before this request — they already have an account
        return res.status(400).json({ error: "Email already registered. Please sign in." });
      }
    }

    return res.json({ data });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// Signin Route
app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error("Signin error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Signout Route
app.post("/api/auth/signout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.json({ success: true, message: "Client signed out locally" });
  }

  const token = authHeader.split(" ")[1];
  try {
    // Try to sign out from Supabase (requires service role key for admin.signOut)
    await supabase.auth.admin.signOut(token).catch((err) => {
      console.log("Admin signout failed (expected if using Anon Key):", err.message);
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Signout error:", err);
    return res.json({ success: true, message: "Signed out with warning" });
  }
});

// Get Current User Route
app.get("/api/auth/me", authenticateUser, (req, res) => {
  return res.json({ user: req.user });
});

// Verify OTP Route (used for email verification confirmation)
app.post("/api/auth/verify-otp", async (req, res) => {
  const { token_hash, type } = req.body;

  if (!token_hash || !type) {
    return res.status(400).json({ error: "token_hash and type are required" });
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Resend OTP / Signup Email Route
app.post("/api/auth/resend", async (req, res) => {
  const { type, email } = req.body;

  if (!type || !email) {
    return res.status(400).json({ error: "type and email are required" });
  }

  try {
    const { data, error } = await supabase.auth.resend({
      type,
      email
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error("Resend error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// ================= DB PROXY ENDPOINT WITH SECURITY POLICIES =================
app.post("/api/db/query", authenticateUser, async (req, res) => {
  const { table, method, columns, options, data, filters, order, limit, single, maybeSingle } = req.body;

  if (!table || !method) {
    return res.status(400).json({ error: "Table and method are required" });
  }

  const userId = req.user.id;

  // Initialize a request-scoped Supabase client that forwards the user's JWT token
  const userSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: req.headers.authorization
      }
    }
  });

  // ----------------------------------------------------
  // ENFORCE SECURITY POLICIES (WRITE AND ACCESS CHECKS)
  // ----------------------------------------------------

  // Helper to ensure data matches authenticated user
  const enforceUserOwnership = (payload, fieldName) => {
    if (!payload) return;
    if (Array.isArray(payload)) {
      payload.forEach(item => {
        item[fieldName] = userId;
      });
    } else if (typeof payload === "object") {
      payload[fieldName] = userId;
    }
  };

  // We enforce rules based on table and method
  if (["insert", "update", "upsert", "delete"].includes(method)) {
    if (table === "profile") {
      // Users can only write/update their own profile
      if (method === "upsert") {
        enforceUserOwnership(data, "id");
      } else if (method === "update") {
        // Enforce that filters restrict to user's own id
        // Remove existing filter for 'id' if any, and append ours
        req.body.filters = (filters || []).filter(f => f.column !== "id");
        req.body.filters.push({ type: "eq", column: "id", value: userId });
      } else if (method === "insert") {
        enforceUserOwnership(data, "id");
      } else if (method === "delete") {
        req.body.filters = (filters || []).filter(f => f.column !== "id");
        req.body.filters.push({ type: "eq", column: "id", value: userId });
      }
    }

    else if (table === "student_subjects") {
      // Users can only modify their own subjects
      enforceUserOwnership(data, "student_id");
      req.body.filters = (filters || []).filter(f => f.column !== "student_id");
      req.body.filters.push({ type: "eq", column: "student_id", value: userId });
    }

    else if (table === "mentor") {
      // Users can only modify their own mentor profile
      enforceUserOwnership(data, "mentor_id");
      req.body.filters = (filters || []).filter(f => f.column !== "mentor_id");
      req.body.filters.push({ type: "eq", column: "mentor_id", value: userId });
    }

    else if (table === "mentor_subjects") {
      // Users can only modify their own expert subjects
      enforceUserOwnership(data, "mentor_id");
      req.body.filters = (filters || []).filter(f => f.column !== "mentor_id");
      req.body.filters.push({ type: "eq", column: "mentor_id", value: userId });
    }

    else if (table === "question") {
      if (method === "insert") {
        enforceUserOwnership(data, "student_id");
      } else if (method === "update") {
        // Users can update their own questions.
        // NON-owners can ONLY update the `likes_count` column.
        const isOwner = (filters || []).some(f => f.column === "student_id" && f.value === userId);
        if (!isOwner) {
          // If not checking owner, check if the update data ONLY updates 'likes_count'
          const keys = Object.keys(data || {});
          const isOnlyLikes = keys.length === 1 && keys[0] === "likes_count";
          if (!isOnlyLikes) {
            return res.status(403).json({ error: "Forbidden: You cannot modify other user's questions" });
          }
        }
      } else if (method === "delete") {
        // Force ownership filter
        req.body.filters = (filters || []).filter(f => f.column !== "student_id");
        req.body.filters.push({ type: "eq", column: "student_id", value: userId });
      }
    }

    else if (table === "reply") {
      if (method === "insert") {
        // Verify user is a mentor
        const { data: mentorCheck } = await userSupabase
          .from("mentor")
          .select("mentor_id")
          .eq("mentor_id", userId)
          .maybeSingle();

        if (!mentorCheck) {
          return res.status(403).json({ error: "Forbidden: Only registered mentors can post replies" });
        }
        enforceUserOwnership(data, "mentor_id");
      } else if (method === "update") {
        // Users can update their own replies.
        // NON-owners can ONLY update the `likes_count` column.
        const isOwner = (filters || []).some(f => f.column === "mentor_id" && f.value === userId);
        if (!isOwner) {
          const keys = Object.keys(data || {});
          const isOnlyLikes = keys.length === 1 && keys[0] === "likes_count";
          if (!isOnlyLikes) {
            return res.status(403).json({ error: "Forbidden: You cannot modify other user's replies" });
          }
        }
      } else if (method === "delete") {
        req.body.filters = (filters || []).filter(f => f.column !== "mentor_id");
        req.body.filters.push({ type: "eq", column: "mentor_id", value: userId });
      }
    }

    else if (table === "likes") {
      if (method === "insert") {
        enforceUserOwnership(data, "user_id");
      } else if (method === "delete") {
        req.body.filters = (filters || []).filter(f => f.column !== "user_id");
        req.body.filters.push({ type: "eq", column: "user_id", value: userId });
      }
    }

    else if (table === "notification") {
      if (method === "insert") {
        enforceUserOwnership(data, "sender_id");
      } else if (method === "update" || method === "delete") {
        // Users can only update/delete notifications sent to them
        req.body.filters = (filters || []).filter(f => f.column !== "recipient_id");
        req.body.filters.push({ type: "eq", column: "recipient_id", value: userId });
      }
    }
  }

  // ----------------------------------------------------
  // CONSTRUCT AND EXECUTE SUPABASE QUERY
  // ----------------------------------------------------
  try {
    let query = userSupabase.from(table);

    // Apply main operation method
    if (method === "select") {
      query = query.select(columns || "*", options || {});
    } else if (method === "insert") {
      query = query.insert(data);
    } else if (method === "update") {
      query = query.update(data);
    } else if (method === "upsert") {
      query = query.upsert(data);
    } else if (method === "delete") {
      query = query.delete();
    } else {
      return res.status(400).json({ error: `Unsupported method: ${method}` });
    }

    // Apply filters
    const activeFilters = req.body.filters || filters || [];
    for (const filter of activeFilters) {
      const { type, column, value, values } = filter;
      if (type === "eq") {
        query = query.eq(column, value);
      } else if (type === "neq") {
        query = query.neq(column, value);
      } else if (type === "in") {
        query = query.in(column, values);
      } else if (type === "not") {
        // e.g. .not("reply_id", "is", null)
        query = query.not(column, filter.operator || "is", value);
      }
    }

    // Apply ordering
    if (order) {
      const { column, options } = order;
      query = query.order(column, options || {});
    }

    // Apply limit
    if (limit !== undefined) {
      query = query.limit(limit);
    }

    // Execute query with single/maybeSingle modifier
    let result;
    if (single) {
      result = await query.single();
    } else if (maybeSingle) {
      result = await query.maybeSingle();
    } else {
      result = await query;
    }

    const { data: dbData, error: dbError, count } = result;

    if (dbError) {
      return res.status(400).json({ error: dbError.message });
    }

    return res.json({ data: dbData, count });
  } catch (err) {
    console.error("DB Proxy Query Error:", err);
    return res.status(500).json({ error: "Internal server error performing database operation" });
  }
});


// ================= STORAGE UPLOAD AND DELETE ENDPOINTS =================

// Upload file to Supabase storage bucket proxy
app.post("/api/storage/upload", authenticateUser, upload.single("file"), async (req, res) => {
  const { bucket, path: filePath } = req.body;
  const file = req.file;

  if (!bucket || !filePath || !file) {
    return res.status(400).json({ error: "Bucket, path, and file are required" });
  }

  // Security Check: If uploading to 'question-files', enforce that the path must start with user's ID
  if (bucket === "question-files") {
    const folderName = filePath.split("/")[0];
    if (folderName !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: You can only upload files under your own directory" });
    }
  }

  try {
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: req.headers.authorization } }
    });

    const { data, error } = await userSupabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
        duplex: "half"
      });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Get public URL or signed URL if needed
    const { data: urlData } = userSupabase.storage.from(bucket).getPublicUrl(filePath);

    return res.json({ data: { ...data, publicUrl: urlData?.publicUrl } });
  } catch (err) {
    console.error("Storage upload error:", err);
    return res.status(500).json({ error: "Internal server error during upload" });
  }
});

// Delete file from Supabase storage bucket proxy
app.post("/api/storage/delete", authenticateUser, async (req, res) => {
  const { bucket, paths } = req.body;

  if (!bucket || !paths || !Array.isArray(paths)) {
    return res.status(400).json({ error: "Bucket and paths array are required" });
  }

  // Security Check: If deleting from 'question-files', check that all paths start with user's ID
  if (bucket === "question-files") {
    const unauthorized = paths.some(p => p.split("/")[0] !== req.user.id);
    if (unauthorized) {
      return res.status(403).json({ error: "Forbidden: You can only delete your own files" });
    }
  }

  try {
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: req.headers.authorization } }
    });

    const { data, error } = await userSupabase.storage
      .from(bucket)
      .remove(paths);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error("Storage delete error:", err);
    return res.status(500).json({ error: "Internal server error during file deletion" });
  }
});

// Get signed image URL proxy
app.post("/api/storage/signed-url", authenticateUser, async (req, res) => {
  const { bucket, path: filePath, expiresIn } = req.body;

  if (!bucket || !filePath) {
    return res.status(400).json({ error: "Bucket and path are required" });
  }

  try {
    const userSupabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: req.headers.authorization } }
    });

    const { data, error } = await userSupabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn || 60);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data });
  } catch (err) {
    console.error("Create signed URL error:", err);
    return res.status(500).json({ error: "Internal server error during URL generation" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
