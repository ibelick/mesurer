export type ActiveTabRegistry = {
  ready: Promise<void>
  isActive: (tabId: number) => boolean
  setActive: (tabId: number, active: boolean) => Promise<void>
}

export const createActiveTabRegistry = (
  read: () => Promise<number[]>,
  write: (ids: number[]) => Promise<void>,
): ActiveTabRegistry => {
  const activeTabs = new Set<number>()
  const pendingStates = new Map<number, boolean>()
  let writeQueue = Promise.resolve()

  const ready = read().then((ids) => {
    ids.forEach((id) => activeTabs.add(id))
  })

  const persist = () => {
    writeQueue = writeQueue.then(() => write([...activeTabs]))
    return writeQueue
  }

  return {
    ready,
    isActive: (tabId) => pendingStates.get(tabId) ?? activeTabs.has(tabId),
    setActive: async (tabId, active) => {
      pendingStates.set(tabId, active)
      await ready
      if (pendingStates.get(tabId) !== active) return
      pendingStates.delete(tabId)
      if (active) activeTabs.add(tabId)
      else activeTabs.delete(tabId)
      await persist()
    },
  }
}
