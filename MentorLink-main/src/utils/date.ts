export const parseUTCDate = (dateString: string | null | undefined): Date => {
  if (!dateString) return new Date();
  let cleanStr = dateString.trim().replace(" ", "T");
  
  // A timezone specifier is 'Z', 'z', or a +/- offset (e.g. +05:00, -0500) at the end of the string.
  // Since the date portion (before 'T') contains '-' characters, we should only look at the time portion (after 'T')
  // for a timezone specifier.
  const tIndex = cleanStr.indexOf("T");
  if (tIndex !== -1) {
    const timePart = cleanStr.substring(tIndex + 1);
    const hasTimezone =
      timePart.includes("Z") ||
      timePart.includes("z") ||
      timePart.includes("+") ||
      (timePart.includes("-") && !timePart.startsWith("-"));
    if (!hasTimezone) {
      cleanStr = cleanStr + "Z";
    }
  } else {
    // If there is no 'T', let's check if it's a simple YYYY-MM-DD date.
    if (
      !cleanStr.endsWith("Z") &&
      !cleanStr.toLowerCase().endsWith("z") &&
      !cleanStr.includes("+")
    ) {
      const dashCount = (cleanStr.match(/-/g) || []).length;
      if (dashCount === 2 && cleanStr.length <= 10) {
        cleanStr = cleanStr + "T00:00:00Z";
      }
    }
  }
  return new Date(cleanStr);
};

export const formatFullDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  const date = parseUTCDate(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};
