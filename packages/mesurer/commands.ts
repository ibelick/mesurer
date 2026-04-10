export const MEASURER_COMMAND_EVENT = "mesurer:command"

export type MeasurerCommandType = "toggle" | "enable" | "disable"

export const dispatchMeasurerCommand = (
  target: EventTarget,
  type: MeasurerCommandType
) => {
  target.dispatchEvent(
    new CustomEvent(MEASURER_COMMAND_EVENT, {
      detail: { type },
    })
  )
}
