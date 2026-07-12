import { initialOf } from '../lib/partners'

export function Avatar({
  name,
  color,
  size = 24,
  ring = false,
}: {
  name?: string
  color: string
  size?: number
  ring?: boolean
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.44,
        boxShadow: ring ? `0 0 0 2px #fffdfb, 0 0 0 4px ${color}` : undefined,
      }}
    >
      {initialOf(name)}
    </span>
  )
}
