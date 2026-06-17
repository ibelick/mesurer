export const formatValue = (value: number) => Math.round(value)

export const cn = (...inputs: Array<string | false | null | undefined>) =>
  inputs.filter(Boolean).join(" ")

export const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`
