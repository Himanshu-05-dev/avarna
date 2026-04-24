export default function StatCard({
  label,
  value,
  suffix,
  delta,
  deltaTone = "positive",
  footer,
  testId,
  accent,
}) {
  const deltaColor =
    deltaTone === "negative"
      ? "text-rose-600"
      : deltaTone === "neutral"
        ? "text-slate-500"
        : "text-rose-500";

  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-[40px] font-extrabold leading-none ${accent ?? "text-slate-900"}`}>
          {value}
        </span>
        {suffix && (
          <span className="text-[15px] font-medium text-slate-500">{suffix}</span>
        )}
        {delta && (
          <span className={`ml-1 text-[13px] font-semibold ${deltaColor}`}>
            {delta}
          </span>
        )}
      </div>
      {footer && <div className="mt-4 text-[13px] text-slate-500">{footer}</div>}
    </div>
  );
}
