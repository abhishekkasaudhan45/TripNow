export const parseAIResponse = (text) => {
  if (!text) return [];

  const days = text.split(/Day\s*\d+/i).filter(Boolean);

  return days.map((dayText, index) => {
    const lines = dayText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return {
      day: index + 1,
      activities: lines,
    };
  });
};