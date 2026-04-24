export function Checkbox({ className = "", checked, defaultChecked, onCheckedChange, ...props }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      className={`transition ${className}`}
      {...props}
    />
  );
}
