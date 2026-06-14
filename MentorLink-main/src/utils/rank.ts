export interface RankInfo {
  key: string;
  label: string;
  next?: string;
  progress?: string;
}

export function getRank(rating: number, replies: number): RankInfo {
  const score = rating + replies * 0.1;

  if (score < 5) {
    return {
      key: "bronze",
      label: "Bronze Mentor",
      next: "Silver",
      progress: `${Math.round(score * 10)}%`,
    };
  }

  if (score < 10) {
    return {
      key: "silver",
      label: "Silver Mentor",
      next: "Gold",
      progress: `${Math.round(((score - 5) / 5) * 100)}%`,
    };
  }

  if (score < 18) {
    return {
      key: "gold",
      label: "Gold Mentor",
      next: "Platinum",
      progress: `${Math.round(((score - 10) / 8) * 100)}%`,
    };
  }

  return {
    key: "platinum",
    label: "Platinum Mentor",
    progress: "MAX LEVEL",
  };
}