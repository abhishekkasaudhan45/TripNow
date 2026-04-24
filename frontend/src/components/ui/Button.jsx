function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  ...props
}) {
  const variantClasses = {
    primary:
      "bg-sky-500 text-white hover:bg-sky-600 disabled:bg-sky-300 disabled:cursor-not-allowed",
    secondary:
      "border border-slate-300 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50",
  };

  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-3 font-medium transition ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
