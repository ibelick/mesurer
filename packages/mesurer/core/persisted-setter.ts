import type { Dispatch, SetStateAction } from "react"

export const createPersistedSetter = <T>(
  ref: { current: T },
  setValue: Dispatch<SetStateAction<T>>,
  persist: () => void,
) => {
  return (value: SetStateAction<T>) => {
    const next =
      typeof value === "function" ? (value as (prev: T) => T)(ref.current) : value
    if (Object.is(next, ref.current)) return
    ref.current = next
    setValue(next)
    persist()
  }
}
