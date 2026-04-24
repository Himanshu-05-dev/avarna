import { useSelector, useDispatch } from "react-redux";
import { X, Sparkles } from "lucide-react";
import { selectIsAssistantOpen, closeAssistant } from "../chat.slice";
import AuditAssistantChat from "./chat";
import { useEffect, useState } from "react";

export default function GlobalAssistantOverlay() {
  const dispatch = useDispatch();
  const isOpen = useSelector(selectIsAssistantOpen);
  const [render, setRender] = useState(false);

  // Simple animation logic
  useEffect(() => {
    if (isOpen) {
      setRender(true);
      document.body.style.overflow = "hidden";
    } else {
      setTimeout(() => setRender(false), 300);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!render) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col bg-slate-50 transition-transform duration-300 ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <h1 className="text-[16px] font-bold text-slate-900 tracking-tight">Aegis AI Assistant</h1>
          <span className="ml-2 inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-700">
            GLOBAL MODE
          </span>
        </div>
        
        <button 
          onClick={() => dispatch(closeAssistant())} 
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
          title="Close Assistant"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      
      {/* Chat Container */}
      <main className="flex-1 overflow-hidden p-6 bg-slate-50/50">
        <div className="h-full w-full max-w-[1400px] mx-auto">
          <AuditAssistantChat />
        </div>
      </main>
    </div>
  );
}
