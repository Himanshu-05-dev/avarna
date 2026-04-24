import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const SelectContext = createContext(null);

export function Select({ value, onValueChange, children }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);

  const registerOption = useCallback(({ value: optionValue, label }) => {
    setOptions((prev) => {
      if (prev.some((option) => option.value === optionValue)) {
        return prev.map((option) =>
          option.value === optionValue ? { value: optionValue, label } : option
        );
      }
      return [...prev, { value: optionValue, label }];
    });
  }, []);

  const handleSelect = useCallback((selectedValue) => {
    onValueChange?.(selectedValue);
    setOpen(false);
  }, [onValueChange]);

  const contextValue = useMemo(
    () => ({ value, open, setOpen, handleSelect, registerOption, options }),
    [value, open, options, handleSelect, registerOption]
  );

  useEffect(() => {
    return () => setOpen(false);
  }, []);

  return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
}

export function SelectTrigger({ children, className = "", ...props }) {
  const ctx = useContext(SelectContext);
  return (
    <button
      type="button"
      className={className}
      onClick={() => ctx?.setOpen?.((prev) => !prev)}
      {...props}
    >
      {children}
    </button>
  );
}

export function SelectValue({ placeholder = "Select..." }) {
  const ctx = useContext(SelectContext);
  const selected = ctx?.options.find((option) => option.value === ctx?.value);
  return <span>{selected?.label ?? placeholder}</span>;
}

export function SelectContent({ children, className = "" }) {
  const ctx = useContext(SelectContext);
  if (!ctx?.open) return null;
  return <div className={className}>{children}</div>;
}

export function SelectItem({ value, children, className = "", ...props }) {
  const ctx = useContext(SelectContext);

  useEffect(() => {
    ctx?.registerOption?.({ value, label: typeof children === "string" ? children : String(children) });
  }, [value, children, ctx]);

  return (
    <button
      type="button"
      onClick={() => ctx?.handleSelect?.(value)}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}
