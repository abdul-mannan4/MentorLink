/* eslint-disable @typescript-eslint/no-explicit-any */
// Custom client that redirects all queries to Express server
import { clearCache } from "./utils/cache";
import { createClient } from "@supabase/supabase-js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://isxxzkcanajavlrietue.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_QifhcxwPmmPSdxR66Qz_Ag_Cwgcvfpb";

// Real client strictly for real-time WebSocket subscriptions
export const realtimeSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function refreshSessionIfNeeded(): Promise<string> {
  const sessionStr = localStorage.getItem("sb-session");
  if (!sessionStr) return "";
  try {
    const session = JSON.parse(sessionStr);
    if (!session?.access_token) return "";

    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    // If token expires in less than 5 minutes (300 seconds), refresh it
    if (expiresAt && (expiresAt - now < 300)) {
      if (!session.refresh_token) {
        // If it's fully expired and we have no refresh token, clear session
        if (expiresAt - now < 0) {
          localStorage.removeItem("sb-session");
          localStorage.removeItem("sb-user");
          clearCache();
          triggerAuthChange("SIGNED_OUT", null);
          return "";
        }
        return session.access_token;
      }
      
      console.log("Token is close to expiry or expired, refreshing...");
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token
        })
      });

      if (res.ok) {
        const newSession = await res.json();
        if (newSession && newSession.access_token) {
          localStorage.setItem("sb-session", JSON.stringify(newSession));
          if (newSession.user) {
            localStorage.setItem("sb-user", JSON.stringify(newSession.user));
          }
          triggerAuthChange("SIGNED_IN", newSession);
          console.log("Session refreshed successfully");
          return newSession.access_token;
        }
      } else {
        console.error("Failed to refresh token", await res.text());
        localStorage.removeItem("sb-session");
        localStorage.removeItem("sb-user");
        clearCache();
        triggerAuthChange("SIGNED_OUT", null);
        return "";
      }
    }
    return session.access_token;
  } catch (err) {
    console.error("Error refreshing token:", err);
    return "";
  }
}


// Custom listeners for auth state changes
const authListeners = new Set<(event: string, session: any) => void>();

function triggerAuthChange(event: string, session: any) {
  authListeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.error("Auth listener callback error:", e);
    }
  });
}

function getFriendlyErrorMessage(err: any): string {
  const msg = err?.message || "";
  if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("load failed") || msg.toLowerCase().includes("networkerror") || msg.toLowerCase().includes("refused")) {
    return "Check your internet connection or make sure the backend server is running.";
  }
  return msg || "An unexpected network error occurred.";
}

class MockBuilder {
  private table: string;
  private method: string = "select";
  private columns: string = "*";
  private filters: any[] = [];
  private orderObj: any = null;
  private limitVal?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private dataToSubmit: any = null;
  private options: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = "*", options?: any) {
    if (this.method !== "insert" && this.method !== "update" && this.method !== "upsert" && this.method !== "delete") {
      this.method = "select";
    }
    this.columns = columns;
    this.options = options;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ type: "neq", column, value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ type: "in", column, values });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.filters.push({ type: "not", column, operator, value });
    return this;
  }

  order(column: string, options: any) {
    this.orderObj = { column, options };
    return this;
  }

  limit(val: number) {
    this.limitVal = val;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    this.method = "insert";
    this.dataToSubmit = data;
    return this;
  }

  update(data: any) {
    this.method = "update";
    this.dataToSubmit = data;
    return this;
  }

  upsert(data: any) {
    this.method = "upsert";
    this.dataToSubmit = data;
    return this;
  }

  delete() {
    this.method = "delete";
    return this;
  }

  // Support thenable so `await supabase.from("...").select("...")` executes automatically!
  then(onfulfilled: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const token = await refreshSessionIfNeeded();
    try {
      const res = await fetch(`${API_URL}/db/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          table: this.table,
          method: this.method,
          columns: this.columns,
          options: this.options,
          data: this.dataToSubmit,
          filters: this.filters,
          order: this.orderObj,
          limit: this.limitVal,
          single: this.isSingle,
          maybeSingle: this.isMaybeSingle
        })
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("sb-session");
          localStorage.removeItem("sb-user");
          clearCache();
          triggerAuthChange("SIGNED_OUT", null);
        }
        return { data: null, count: null, error: { message: json.error || "Query failed" } };
      }
      return { data: json.data, count: json.count, error: null };
    } catch (err: any) {
      return { data: null, count: null, error: { message: getFriendlyErrorMessage(err) } };
    }
  }
}

export const supabase = {
  auth: {
    async signUp(params: any) {
      try {
        const res = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: params.email,
            password: params.password,
            redirectTo: params.options?.emailRedirectTo
          })
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: { message: json.error || "Signup failed" } };
        }

        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    async signInWithPassword(params: any) {
      try {
        const res = await fetch(`${API_URL}/auth/signin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: params.email,
            password: params.password
          })
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: { message: json.error || "Signin failed" } };
        }

        if (json.data?.session) {
          localStorage.setItem("sb-session", JSON.stringify(json.data.session));
          localStorage.setItem("sb-user", JSON.stringify(json.data.user));
          triggerAuthChange("SIGNED_IN", json.data.session);
        }

        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    async signOut() {
      const token = await refreshSessionIfNeeded();
      try {
        await fetch(`${API_URL}/auth/signout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (e) {
        console.error("Signout API error:", e);
      }
      localStorage.removeItem("sb-session");
      localStorage.removeItem("sb-user");
      clearCache();
      triggerAuthChange("SIGNED_OUT", null);
      return { error: null };
    },

    async getUser() {
      const token = await refreshSessionIfNeeded();
      if (!token) {
        return { data: { user: null }, error: { message: "No active session" } };
      }

      // Return cached user or fetch from backend
      const userStr = localStorage.getItem("sb-user");
      if (userStr) {
        try {
          return { data: { user: JSON.parse(userStr) }, error: null };
        } catch {
          // ignore
        }
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("sb-session");
            localStorage.removeItem("sb-user");
            clearCache();
            triggerAuthChange("SIGNED_OUT", null);
          }
          return { data: { user: null }, error: { message: json.error || "Failed to fetch user" } };
        }
        localStorage.setItem("sb-user", JSON.stringify(json.user));
        return { data: { user: json.user }, error: null };
      } catch (err: any) {
        return { data: { user: null }, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    async getSession() {
      const token = await refreshSessionIfNeeded();
      const sessionStr = localStorage.getItem("sb-session");
      if (!sessionStr) {
        return { data: { session: null }, error: null };
      }
      try {
        const session = JSON.parse(sessionStr);
        return { data: { session }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },

    async verifyOtp(params: any) {
      try {
        const body: any = { type: params.type };
        if (params.token_hash) {
          body.token_hash = params.token_hash;
        } else {
          body.email = params.email;
          body.token = params.token;
        }

        const res = await fetch(`${API_URL}/auth/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: { session: null, user: null }, error: { message: json.error || "Verification failed" } };
        }

        if (json.data?.session) {
          localStorage.setItem("sb-session", JSON.stringify(json.data.session));
          localStorage.setItem("sb-user", JSON.stringify(json.data.user));
          triggerAuthChange("SIGNED_IN", json.data.session);
        }

        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: { session: null, user: null }, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    async resend(params: any) {
      try {
        const res = await fetch(`${API_URL}/auth/resend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: params.type,
            email: params.email
          })
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: { message: json.error || "Resend failed" } };
        }

        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
      try {
        const res = await fetch(`${API_URL}/auth/reset-password-request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            redirectTo: options?.redirectTo
          })
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: { message: json.error || "Password reset request failed" } };
        }

        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    async updateUser(params: { password?: string }) {
      const token = await refreshSessionIfNeeded();
      if (!token) return { data: null, error: { message: "No active session" } };

      try {
        const res = await fetch(`${API_URL}/auth/update-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(params)
        });

        const json = await res.json();
        if (!res.ok) {
          return { data: null, error: { message: json.error || "Update user failed" } };
        }

        if (json.data?.user) {
          localStorage.setItem("sb-user", JSON.stringify(json.data.user));
        }

        return { data: json.data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: getFriendlyErrorMessage(err) } };
      }
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.add(callback);
      
      const sessionStr = localStorage.getItem("sb-session");
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          callback("SIGNED_IN", session);
        } catch {
          callback("SIGNED_OUT", null);
        }
      } else {
        callback("SIGNED_OUT", null);
      }

      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            }
          }
        }
      };
    }
  },

  from(table: string) {
    return new MockBuilder(table);
  },

  storage: {
    from(bucket: string) {
      return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async upload(filePath: string, file: File, options?: Record<string, unknown>) {
          const token = await refreshSessionIfNeeded();
          const formData = new FormData();
          formData.append("bucket", bucket);
          formData.append("path", filePath);
          formData.append("file", file);

          try {
            const res = await fetch(`${API_URL}/storage/upload`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${token}`
              },
              body: formData
            });
            const json = await res.json();
            if (!res.ok) {
              return { data: null, error: { message: json.error || "Upload failed" } };
            }
            return { data: json.data, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message || "Upload network error" } };
          }
        },

        async remove(paths: string[]) {
          const token = await refreshSessionIfNeeded();
          try {
            const res = await fetch(`${API_URL}/storage/delete`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ bucket, paths })
            });
            const json = await res.json();
            if (!res.ok) {
              return { data: null, error: { message: json.error || "Delete failed" } };
            }
            return { data: json.data, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message || "Delete network error" } };
          }
        },

        getPublicUrl(filePath: string) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://isxxzkcanajavlrietue.supabase.co";
          const cleanUrl = supabaseUrl.endsWith("/") ? supabaseUrl.slice(0, -1) : supabaseUrl;
          return {
            data: {
              publicUrl: `${cleanUrl}/storage/v1/object/public/${bucket}/${filePath}`
            }
          };
        },

        async createSignedUrl(filePath: string, expiresIn: number) {
          const token = await refreshSessionIfNeeded();
          try {
            const res = await fetch(`${API_URL}/storage/signed-url`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ bucket, path: filePath, expiresIn })
            });
            const json = await res.json();
            if (!res.ok) {
              return { data: null, error: { message: json.error || "Failed to create signed URL" } };
            }
            return { data: json.data, error: null };
          } catch (err: any) {
            return { data: null, error: { message: err.message || "Signed URL network error" } };
          }
        }
      };
    }
  }
};
