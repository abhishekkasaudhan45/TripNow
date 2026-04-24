function FeedbackMessage({ tone = "error", message }) {
  if (!message) {
    return null;
  }

  const toneClasses = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses[tone]}`}>
      {message}
    </div>
  );
}

export default FeedbackMessage;
