export const getToday = () => new Date().toISOString().split("T")[0];

export const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const dayCount = (start, end) =>
  start && end ? Math.max(1, Math.round((new Date(end) - new Date(start)) / 86400000)) : 0;

export const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
