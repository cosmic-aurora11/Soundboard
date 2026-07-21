export class LatestTransition {
  private token = 0
  private timeout: ReturnType<typeof setTimeout> | null = null

  schedule(delayMs: number, callback: () => void): number {
    this.cancel()
    const scheduledToken = this.token
    this.timeout = setTimeout(() => {
      if (scheduledToken !== this.token) return
      this.timeout = null
      callback()
    }, delayMs)
    return scheduledToken
  }

  cancel(): void {
    this.token += 1
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  currentToken(): number {
    return this.token
  }

  isCurrent(token: number): boolean {
    return token === this.token
  }
}
