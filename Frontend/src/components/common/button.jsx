export function Button({ className = "", children, variant = "default", ...props }) {
  const baseClasses = "inline-flex items-center justify-center rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  
  const variantClasses = {
    default: "bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700",
    outline: "border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50",
    secondary: "bg-white px-4 py-2 text-sm hover:bg-slate-50",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
