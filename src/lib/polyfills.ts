// Small gaps in older phone browsers (Chrome before 92, Safari before 15.4) that the app relies on.
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    value: function at<T>(this: T[], index: number) {
      const i = Math.trunc(index) || 0
      return this[i < 0 ? this.length + i : i]
    },
    writable: true,
    configurable: true,
  })
}
if (!String.prototype.at) {
  Object.defineProperty(String.prototype, 'at', {
    value: function at(this: string, index: number) {
      const i = Math.trunc(index) || 0
      return this.charAt(i < 0 ? this.length + i : i) || undefined
    },
    writable: true,
    configurable: true,
  })
}
export {}
