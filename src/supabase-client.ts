// Custom client that redirects all queries to Express server

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getLocalAccessToken(): string {
  const sessionStr = localStorage.getItem("sb-session");
  if (!sessionStr) return "";
  try {
    const session = JSON.parse(sessionStr);
    return session?.access_token || "";
  } catch (e) {
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
    this.method = "select";
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
    const token = getLocalAccessToken();
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
        return { data: null, count: null, error: { message: json.error || "Query failed" } };
      }
      return { data: json.data, count: json.count, error: null };
    } catch (err: any) {
      return { data: null, count: null, error: { message: err.message || "Network error" } };
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
        return { data: null, error: { message: err.message || "Signup network error" } };
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
        return { data: null, error: { message: err.message || "Signin network error" } };
      }
    },

    async signOut() {
      const token = getLocalAccessToken();
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
      triggerAuthChange("SIGNED_OUT", null);
      return { error: null };
    },

    async getUser() {
      // Return cached user or fetch from backend
      const userStr = localStorage.getItem("sb-user");
      if (userStr) {
        try {
          return { data: { user: JSON.parse(userStr) }, error: null };
        } catch (e) {
          // ignore
        }
      }

      const token = getLocalAccessToken();
      if (!token) {
        return { data: { user: null }, error: { message: "No active session" } };
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
          return { data: { user: null }, error: { message: json.error || "Failed to fetch user" } };
        }
        localStorage.setItem("sb-user", JSON.stringify(json.user));
        return { data: { user: json.user }, error: null };
      } catch (err: any) {
        return { data: { user: null }, error: { message: err.message || "Network error" } };
      }
    },

    async getSession() {
      const sessionStr = localStorage.getItem("sb-session");
      if (!sessionStr) {
        return { data: { session: null }, error: null };
      }
      try {
        const session = JSON.parse(sessionStr);
        return { data: { session }, error: null };
      } catch (e) {
        return { data: { session: null }, error: null };
      }
    },

    async verifyOtp(params: any) {
      try {
        const res = await fetch(`${API_URL}/auth/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token_hash: params.token_hash,
            type: params.type
          })
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
        return { data: { session: null, user: null }, error: { message: err.message || "Network error" } };
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
        return { data: null, error: { message: err.message || "Network error" } };
      }
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.add(callback);
      
      const sessionStr = localStorage.getItem("sb-session");
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          callback("SIGNED_IN", session);
        } catch (e) {
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
        async upload(filePath: string, file: File, options?: any) {
          const token = getLocalAccessToken();
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
          const token = getLocalAccessToken();
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
          return {
            data: {
              publicUrl: `https://isxxzkcanajavlrietue.supabase.co/storage/v1/object/public/${bucket}/${filePath}`
            }
          };
        },

        async createSignedUrl(filePath: string, expiresIn: number) {
          const token = getLocalAccessToken();
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
