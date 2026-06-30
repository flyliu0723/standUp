export interface ReminderCopy {
  title: string
  subtitle: string
  tag: string
}

export interface ReminderCopyContext {
  sitMinutes: number
  snoozeCountToday: number
  hour: number
}

type CopyPool = ReminderCopy[]

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function withSitMinutes(pool: CopyPool, sitMinutes: number): CopyPool {
  return pool.map((item) => ({
    ...item,
    title: item.title.replace('{m}', String(sitMinutes))
  }))
}

const GENERAL: CopyPool = [
  {
    tag: 'standUp',
    title: '起来，你已经连续坐了 {m} 分钟。',
    subtitle: '颈椎给你发了个提醒——去接杯水再回来。'
  },
  {
    tag: 'standUp',
    title: '{m} 分钟了，腰已经在默默记账。',
    subtitle: '离开座位一会儿，回来思路会更清楚。'
  },
  {
    tag: 'standUp',
    title: '久坐 {m} 分钟，该给身体放个短假。',
    subtitle: '站起来走几步，比再坐十分钟划算。'
  },
  {
    tag: 'standUp',
    title: '你的椅子已经抱了你 {m} 分钟。',
    subtitle: '让它歇一会儿，你也歇一会儿。'
  },
  {
    tag: 'standUp',
    title: '{m} 分钟没换姿势了。',
    subtitle: '去接杯水，顺便让眼睛也离开屏幕。'
  }
]

const LONG_SIT: CopyPool = [
  {
    tag: '久坐预警',
    title: '已经 {m} 分钟了，这有点久。',
    subtitle: '再不动，今天腰椎的账单会很难看。'
  },
  {
    tag: '久坐预警',
    title: '{m} 分钟——你的腰已经开始骂人了。',
    subtitle: '现在站起来，还来得及。'
  },
  {
    tag: '久坐预警',
    title: '连续坐了 {m} 分钟，身体在抗议。',
    subtitle: '离开工位 30 秒，比吃止痛药便宜。'
  }
]

const SNOOZE_HEAVY: CopyPool = [
  {
    tag: '最后一次',
    title: '今天第几次了？这次真的该站了。',
    subtitle: '离开座位即可解除，不用再点按钮骗自己。'
  },
  {
    tag: '最后一次',
    title: '推迟了好几次，椅子都快成你身体的一部分了。',
    subtitle: '起身走一圈，回来再继续。'
  },
  {
    tag: '最后一次',
    title: '又推迟？腰椎可不会陪你再拖一轮。',
    subtitle: '离开座位足够久，提醒会自动解除。'
  }
]

const SNOOZE_ONCE: CopyPool = [
  {
    tag: 'standUp',
    title: '上次推迟过了，这次别赖椅子了。',
    subtitle: '离开座位即可解除提醒。'
  },
  {
    tag: 'standUp',
    title: '{m} 分钟已到，你之前说过再坐一会儿的。',
    subtitle: '一会儿到了，该兑现了。'
  }
]

const LATE_NIGHT: CopyPool = [
  {
    tag: '深夜提醒',
    title: '都这个点了，还坐着 {m} 分钟？',
    subtitle: '站起来活动一下，别熬到腰先投降。'
  },
  {
    tag: '深夜提醒',
    title: '夜深了，椅子抱你太久了。',
    subtitle: '去接杯水，顺便让大脑也缓一缓。'
  }
]

export function pickReminderCopy(ctx: ReminderCopyContext): ReminderCopy {
  const { sitMinutes, snoozeCountToday, hour } = ctx
  const isLateNight = hour >= 22 || hour < 6

  if (snoozeCountToday >= 2) {
    return pickRandom(withSitMinutes(SNOOZE_HEAVY, sitMinutes))
  }
  if (snoozeCountToday >= 1) {
    return pickRandom(withSitMinutes(SNOOZE_ONCE, sitMinutes))
  }
  if (isLateNight) {
    return pickRandom(withSitMinutes(LATE_NIGHT, sitMinutes))
  }
  if (sitMinutes >= 55) {
    return pickRandom(withSitMinutes(LONG_SIT, sitMinutes))
  }
  return pickRandom(withSitMinutes(GENERAL, sitMinutes))
}
