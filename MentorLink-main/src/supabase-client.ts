import { createClient } from "@supabase/supabase-js";
import { clearCache } from "./utils/cache";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://isxxzkcanajavlrietue.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sync standard auth session to the custom local storage key so the DB proxy works
supabaseAuthClient.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
    clearCache();
  }
  if (session) {
    localStorage.setItem("sb-session", JSON.stringify(session));
    localStorage.setItem("sb-user", JSON.stringify(session.user));
  } else if (event === "SIGNED_OUT") {
    localStorage.removeItem("sb-session");
    localStorage.removeItem("sb-user");
  }
});

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
  auth: supabaseAuthClient.auth,

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
