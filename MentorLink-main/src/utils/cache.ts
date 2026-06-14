// Cache utility to store database query results and signed URLs in memory
// to prevent reload of data when navigating between pages.

interface CacheStore {
  profile?: any;
  isMentor?: boolean;
  questions?: any[];
  studentSubjects?: any[];
  topMentors?: any[];
  notifications?: any[];
  studentDashboardQuestions?: any[];
  mentorSubjects?: any[];
  mentorNotifications?: any[];
  mentorRank?: any;
  signedUrls?: Record<string, { url: string; expiresAt: number }>;
}

const cache: CacheStore = {
  signedUrls: {}
};

export const getCache = <K extends keyof CacheStore>(key: K): CacheStore[K] => {
  return cache[key];
};

export const setCache = <K extends keyof CacheStore>(key: K, value: CacheStore[K]): void => {
  cache[key] = value;
};

export const getSignedUrlFromCache = (path: string): string | null => {
  if (!cache.signedUrls) cache.signedUrls = {};
  const cached = cache.signedUrls[path];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  return null;
};

export const setSignedUrlInCache = (path: string, url: string, expiresInSeconds: number = 3600): void => {
  if (!cache.signedUrls) cache.signedUrls = {};
  cache.signedUrls[path] = {
    url,
    expiresAt: Date.now() + (expiresInSeconds - 120) * 1000 // expire 2 minutes early for safety
  };
};

export const clearCache = (): void => {
  Object.keys(cache).forEach((key) => {
    if (key === "signedUrls") {
      cache.signedUrls = {};
    } else {
      delete cache[key as keyof CacheStore];
    }
  });
};
