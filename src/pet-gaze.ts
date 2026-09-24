/** 与宠物插件 v2 图集最后两行的注视帧对齐。桌面窗口鼠标穿透，不能复用页内 mousemove。 */

/** v2 的最后两行是顺时针 16 方向注视，0 表示上方。死区与插件相同。 */
export function lookCell(
  dx: number,
  dy: number,
): { row: number; col: number } | null {
  if (Math.hypot(dx, dy) < 28) return null;
  const index =
    Math.round(
      ((Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 8),
    ) % 16;
  return { row: 9 + Math.floor(index / 8), col: index % 8 };
}

/** 与 pet-window-html 里 .pet 的 right/bottom 一致，改一边必须改另一边。 */
export const PET_SPRITE_RIGHT = 12;
export const PET_SPRITE_BOTTOM = 30;

/** 把屏幕光标换成相对精灵中心的偏移。窗口坐标与 getCursorScreenPoint 同为 DIP。 */
export function gazeDelta(
  cursor: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
  size: number,
): { dx: number; dy: number } {
  const height = (size * 208) / 192;
  const centerX = bounds.x + bounds.width - PET_SPRITE_RIGHT - size / 2;
  const centerY = bounds.y + bounds.height - PET_SPRITE_BOTTOM - height / 2;
  return { dx: cursor.x - centerX, dy: cursor.y - centerY };
}

export function gazePayload(
  state: { pet: { version: number }; activity: { pose: string }; config: { size: number } } | null,
  cursor: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
): { dx: number; dy: number } | null {
  if (!state || state.pet.version !== 2 || state.activity.pose !== "idle") return null;
  return gazeDelta(cursor, bounds, state.config.size);
}
