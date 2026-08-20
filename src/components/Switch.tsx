/**
 * An on/off switch: a pill track with a knob that slides.
 *
 * Split in two on purpose. `SwitchTrack` is just the visual, so a caller that wants the WHOLE row to
 * be the tap target can own the button itself and drop the track inside it (a button inside a button
 * is invalid HTML, so the visual cannot carry its own). `Switch` is that button for standalone use.
 *
 * Extracted from Settings, which had this shape inline, so the app has ONE switch rather than a
 * second style invented for the routines list. The knob moves with a transform rather than by
 * animating `left`, so it runs on the compositor like the rest of the app's motion.
 */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      className={`relative block h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-coral' : 'bg-ink/15'
      }`}
    >
      <span
        className="absolute left-1 top-1 block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out"
        style={{ transform: checked ? 'translateX(1.25rem)' : 'translateX(0)' }}
      />
    </span>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** what the switch controls, for screen readers (any visible label lives with the caller) */
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="shrink-0 active:scale-95"
    >
      <SwitchTrack checked={checked} />
    </button>
  )
}
