import { useEffect } from "react"

/**
 * 팝업/모달 열림 시 body 스크롤을 잠그고, 닫힘 시 복원.
 * overflow-y: scroll로 스크롤바를 유지하여 레이아웃 시프트 방지.
 */
export function useScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return
    const scrollY = window.scrollY
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = "0"
    document.body.style.right = "0"
    document.body.style.overflowY = "scroll"
    return () => {
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.left = ""
      document.body.style.right = ""
      document.body.style.overflowY = ""
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])
}
