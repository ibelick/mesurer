declare global {
  // Set by the extension's build, for its content script alone: it is replaced by `true` there
  // and is absent everywhere else. What the content script never runs is left out behind it.
  var __MESURER_EXTENSION__: boolean | undefined
}

export {}
