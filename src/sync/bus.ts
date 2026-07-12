// Lightweight signal so the sync engine can push shortly after a local change,
// without coupling the repository to the sync layer.
const target = new EventTarget()
export const CHANGE = 'berdua-change'

export const notifyChange = () => target.dispatchEvent(new Event(CHANGE))
export const onChange = (fn: () => void) => {
  target.addEventListener(CHANGE, fn)
  return () => target.removeEventListener(CHANGE, fn)
}
