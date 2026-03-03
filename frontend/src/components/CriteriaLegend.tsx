import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Crown, X } from "lucide-react"
import { CRITERIA_CONFIG, SPECIAL_CRITERIA_DESCRIPTIONS } from "@/lib/criteria"
import { cn } from "@/lib/utils"

interface PopupInfo {
  label: string
  description: string
  dot: string
  warning: boolean
  icon?: "crown" | "ring"
}

function CriteriaInfoPopup({ info, onClose }: { info: PopupInfo; onClose: () => void }) {
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"
    return () => {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      window.scrollTo(0, scrollY)
    }
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-[45] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-72 max-w-[90vw] bg-popover text-popover-foreground rounded-xl shadow-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {info.icon === "crown" ? (
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            ) : info.icon === "ring" ? (
              <span className="w-2.5 h-2.5 rounded-full ring-1 ring-yellow-400 bg-yellow-400/30" />
            ) : (
              <span className={cn("w-2.5 h-2.5 rounded-full", info.dot, info.warning && "animate-pulse")} />
            )}
            <span className={cn("text-sm font-semibold", info.warning && "text-red-600")}>
              {info.label}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{info.description}</p>
      </div>
    </div>,
    document.body
  )
}

export function CriteriaLegend() {
  const [popup, setPopup] = useState<PopupInfo | null>(null)
  const normalCriteria = CRITERIA_CONFIG.filter(c => !c.warning)
  const warningCriteria = CRITERIA_CONFIG.filter(c => c.warning)

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-muted/40 rounded-lg text-[10px] sm:text-xs text-muted-foreground">
        <span className="font-medium text-foreground/70">선정 기준:</span>
        {normalCriteria.map(({ dot, label, description, warning }) => (
          <button
            key={label}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => setPopup({ label, description, dot, warning })}
          >
            <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dot}`} />
            {label}
          </button>
        ))}
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => setPopup({ label: "52주 신고가", description: SPECIAL_CRITERIA_DESCRIPTIONS["52w_high"], dot: "", warning: false, icon: "crown" })}
        >
          <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" />
          52주 신고가
        </button>
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => setPopup({ label: "전체 충족", description: SPECIAL_CRITERIA_DESCRIPTIONS["all_met"], dot: "", warning: false, icon: "ring" })}
        >
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ring-1 ring-yellow-400 bg-yellow-400/30" />
          전체 충족
        </button>
        <span className="font-medium text-foreground/70 ml-1">경고:</span>
        {warningCriteria.map(({ dot, label, description, warning }) => (
          <button
            key={label}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => setPopup({ label, description, dot, warning })}
          >
            <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${dot} animate-pulse`} />
            {label}
          </button>
        ))}
      </div>
      {popup && <CriteriaInfoPopup info={popup} onClose={() => setPopup(null)} />}
    </>
  )
}
