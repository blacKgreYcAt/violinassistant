/**
 * 樂譜裁切的純計算邏輯。
 *
 * 手機拍的樂譜常常帶到桌面、譜架或大片留白，裁切就是把真正要看的那一塊框出來。
 *
 * 座標是「相對於樂譜頁面框的百分比」（0~100），不是像素 ——
 * 裁切視窗的預覽框與樂譜檢視器用的是同一個 A4 比例容器，所以兩邊看到的
 * 會是同一件事。沿用這個單位也讓既有的 cropData 資料不需要轉換。
 *
 * 注意：裁切是定義在「未旋轉」的頁面上，旋轉是之後才套用的檢視偏好。
 */

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 100, height: 100 };

/**
 * 裁切框最小不得小於頁面的 10%。
 * 沒有下限的話，拖過頭會把框縮成 0，畫面瞬間變成無限放大的一個像素。
 */
export const MIN_CROP_PERCENT = 10;

export type CropCorner = 'nw' | 'ne' | 'sw' | 'se';

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * 把任意輸入整理成一個合法的裁切框。
 *
 * 舊資料、壞掉的資料、拖曳過程中的中間值都會經過這裡，
 * 所以它必須能吞下 undefined、NaN 與超出範圍的值。
 */
export function normalizeCrop(rect: Partial<CropRect> | null | undefined): CropRect {
  if (!rect) return { ...FULL_CROP };

  const maxOrigin = 100 - MIN_CROP_PERCENT;
  const x = clampNumber(rect.x, 0, maxOrigin, 0);
  const y = clampNumber(rect.y, 0, maxOrigin, 0);
  const width = clampNumber(rect.width, MIN_CROP_PERCENT, 100 - x, 100 - x);
  const height = clampNumber(rect.height, MIN_CROP_PERCENT, 100 - y, 100 - y);

  return { x, y, width, height };
}

/** 這個框有沒有真的裁掉東西（整頁就等於沒裁） */
export function isCropped(rect: Partial<CropRect> | null | undefined): boolean {
  if (!rect) return false;
  const c = normalizeCrop(rect);
  return c.x > 0.01 || c.y > 0.01 || c.width < 99.99 || c.height < 99.99;
}

/** 取某一頁的裁切框；沒設定過就是整頁 */
export function cropForPage(
  cropData: CropRect[] | undefined,
  page: number
): CropRect {
  return normalizeCrop(cropData?.[page]);
}

/**
 * 算出讓裁切範圍填滿整個頁面框的 CSS transform。
 *
 * 以 0 0 為原點先把左上角平移到位，再放大到填滿。
 * 這個 transform 要同時套在樂譜圖片與標註 canvas 上，兩者才會一起縮放、
 * 不會出現「裁切後舊標註跑掉」的情形。
 */
export function cropToTransform(rect: Partial<CropRect> | null | undefined): {
  transform: string;
  transformOrigin: string;
} {
  const c = normalizeCrop(rect);
  return {
    transformOrigin: '0 0',
    transform: `scale(${100 / c.width}, ${100 / c.height}) translate(${-c.x}%, ${-c.y}%)`,
  };
}

/**
 * 拖曳某個角落時重算裁切框：被拖的那一角跟著指標跑，對角固定不動。
 *
 * 原本的實作是五個 onClick、每次固定加減 5%，而且右下角的夾值寫成
 * `Math.min(100 - height, height + 5)`（應該是 `100 - y`），
 * 預設整頁時算出 0，一按高度就歸零。
 */
export function resizeCrop(
  rect: CropRect,
  corner: CropCorner,
  point: { x: number; y: number }
): CropRect {
  const base = normalizeCrop(rect);
  const movesLeftEdge = corner === 'nw' || corner === 'sw';
  const movesTopEdge = corner === 'nw' || corner === 'ne';

  const fixedX = movesLeftEdge ? base.x + base.width : base.x;
  const fixedY = movesTopEdge ? base.y + base.height : base.y;

  const px = clampNumber(point.x, 0, 100, fixedX);
  const py = clampNumber(point.y, 0, 100, fixedY);

  return normalizeCrop({
    x: Math.min(fixedX, px),
    y: Math.min(fixedY, py),
    width: Math.abs(fixedX - px),
    height: Math.abs(fixedY - py),
  });
}

/**
 * 整塊平移裁切框，不改變大小。
 *
 * 碰到邊界時是「貼住」而不是縮小 —— 使用者在調位置，不是在調大小。
 */
export function moveCrop(rect: CropRect, dx: number, dy: number): CropRect {
  const base = normalizeCrop(rect);
  const safeDx = Number.isFinite(dx) ? dx : 0;
  const safeDy = Number.isFinite(dy) ? dy : 0;

  return {
    ...base,
    x: Math.min(100 - base.width, Math.max(0, base.x + safeDx)),
    y: Math.min(100 - base.height, Math.max(0, base.y + safeDy)),
  };
}

/** 把某一頁的裁切寫回整份樂譜的 cropData（其他頁不動） */
export function setCropForPage(
  cropData: CropRect[] | undefined,
  page: number,
  rect: CropRect,
  totalPages: number
): CropRect[] {
  const next = Array.from({ length: Math.max(totalPages, page + 1) }, (_, i) =>
    normalizeCrop(cropData?.[i])
  );
  next[page] = normalizeCrop(rect);
  return next;
}
