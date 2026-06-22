import Store from 'electron-store'

interface AppMetaSchema {
  launchCount: number
}

const store = new Store<AppMetaSchema>({
  name: 'standup-meta',
  defaults: {
    launchCount: 0
  }
})

export function recordLaunch(): number {
  const count = store.get('launchCount') + 1
  store.set('launchCount', count)
  return count
}

export function isFirstLaunch(): boolean {
  return store.get('launchCount') === 0
}
