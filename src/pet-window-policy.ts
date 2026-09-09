/** 宠物窗口只接受已知图片路由和有限配置，不向网页开放任意原生窗口 API。 */
export interface PetWindowState {
  pet: { id: string; name: string; description: string; url: string; version: 1 | 2; source: 'builtin' | 'custom' }
  config: { selected: string; visible: boolean; size: number; position: { x: number; y: number } | null }
  activity: { pose: string; title: string; text: string; sessionId?: string }
}
export function parsePetWindowState(value: unknown): PetWindowState | null {
  if (!value || typeof value !== 'object') return null
  const { pet, config, activity } = value as Partial<PetWindowState>
  if (!pet || !config || !activity) return null
  if (typeof pet.id !== 'string' || !/^(custom:)?[\w-]+$/.test(pet.id)) return null
  if (pet.url !== `/dsh-codex-pet/asset/${encodeURIComponent(pet.id)}` || ![1, 2].includes(pet.version)) return null
  if (typeof pet.name !== 'string' || pet.name.length > 100 || typeof pet.description !== 'string' || pet.description.length > 300) return null
  if (pet.source !== 'builtin' && pet.source !== 'custom') return null
  if (!Number.isFinite(config.size) || config.size < 64 || config.size > 224 || typeof config.visible !== 'boolean') return null
  if (!['idle', 'running', 'waiting', 'review', 'failed', 'waving', 'jumping', 'running-left', 'running-right'].includes(activity.pose)) return null
  if (typeof activity.title !== 'string' || typeof activity.text !== 'string') return null
  if (activity.sessionId !== undefined && (typeof activity.sessionId !== 'string' || activity.sessionId.length > 512)) return null
  return { pet: { ...pet }, config: { selected: pet.id, visible: config.visible, size: config.size, position: null }, activity: { pose: activity.pose, title: activity.title.slice(0, 200), text: activity.text.slice(0, 300), sessionId: activity.sessionId } }
}
export function constrainPetBounds(bounds: { x: number; y: number }, area: { x: number; y: number; width: number; height: number }, width = 320, height = 560): { x: number; y: number } {
  return { x: Math.round(Math.max(area.x, Math.min(area.x + Math.max(0, area.width - width), bounds.x))), y: Math.round(Math.max(area.y, Math.min(area.y + Math.max(0, area.height - height), bounds.y))) }
}
