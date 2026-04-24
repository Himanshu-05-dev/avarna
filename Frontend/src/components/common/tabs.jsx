import { createContext, useContext } from "react";

const TabsContext = createContext(null);

export function Tabs({ value, onValueChange, children, className = "" }) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

export function TabsTrigger({ value, children, className = "", ...props }) {
  const context = useContext(TabsContext);
  const active = context?.value === value;

  return (
    <button
      type="button"
      data-state={active ? "active" : "inactive"}
      className={className}
      onClick={() => context?.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
}
