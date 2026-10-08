import { describe, it, expect } from 'vitest';
import {
  normalizeCrop,
  isCropped,
  cropForPage,
  cropToTransform,
  resizeCrop,
  moveCrop,
  setCropForPage,
  FULL_CROP,
  MIN_CROP_PERCENT,
} from './crop';

describe('normalizeCrop', () => {
  it('合法的框原樣保留', () => {
    expect(normalizeCrop({ x: 10, y: 20, width: 50, height: 60 })).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 60,
    });
  });

  it('undefined 視為整頁', () => {
    expect(normalizeCrop(undefined)).toEqual(FULL_CROP);
    expect(normalizeCrop(null)).toEqual(FULL_CROP);
  });

  it('負座標會被拉回 0', () => {
    expect(normalizeCrop({ x: -30, y: -5, width: 50, height: 50 })).toMatchObject({ x: 0, y: 0 });
  });

  it('寬高不會超出頁面', () => {
    const c = normalizeCrop({ x: 70, y: 80, width: 100, height: 100 });
    expect(c.x + c.width).toBeLessThanOrEqual(100);
    expect(c.y + c.height).toBeLessThanOrEqual(100);
  });

  it('不會小於最小尺寸', () => {
    // 縮成 0 的話畫面會變成無限放大的一個像素
    const c = normalizeCrop({ x: 10, y: 10, width: 0, height: 0 });
    expect(c.width).toBe(MIN_CROP_PERCENT);
    expect(c.height).toBe(MIN_CROP_PERCENT);
  });

  it('座標本身也不能貼到最右下角，否則留不下最小寬高', () => {
    const c = normalizeCrop({ x: 100, y: 100, width: 50, height: 50 });
    expect(c.x).toBe(100 - MIN_CROP_PERCENT);
    expect(c.width).toBe(MIN_CROP_PERCENT);
  });

  it('NaN 不會污染出壞掉的框', () => {
    const c = normalizeCrop({ x: NaN, y: 10, width: NaN, height: 30 });
    expect(Object.values(c).every(Number.isFinite)).toBe(true);
    expect(c.x).toBe(0);
    expect(c.width).toBe(100);
  });
});

describe('isCropped', () => {
  it('整頁不算有裁切', () => {
    expect(isCropped(FULL_CROP)).toBe(false);
    expect(isCropped(undefined)).toBe(false);
  });

  it('任何一邊被切掉都算', () => {
    expect(isCropped({ x: 0, y: 0, width: 100, height: 80 })).toBe(true);
    expect(isCropped({ x: 5, y: 0, width: 95, height: 100 })).toBe(true);
  });
});

describe('cropForPage', () => {
  it('沒有資料時回傳整頁', () => {
    expect(cropForPage(undefined, 0)).toEqual(FULL_CROP);
    expect(cropForPage([], 3)).toEqual(FULL_CROP);
  });

  it('取得指定頁的框', () => {
    const data = [FULL_CROP, { x: 10, y: 10, width: 50, height: 50 }];
    expect(cropForPage(data, 1)).toEqual({ x: 10, y: 10, width: 50, height: 50 });
  });

  it('壞掉的那一頁會被整理成合法的框', () => {
    const data = [{ x: -10, y: 0, width: 999, height: 50 }];
    const c = cropForPage(data, 0);
    expect(c.x).toBe(0);
    expect(c.width).toBe(100);
  });
});

describe('cropToTransform', () => {
  it('整頁時等同不做事', () => {
    const t = cropToTransform(FULL_CROP);
    expect(t.transform).toBe('scale(1, 1) translate(0%, 0%)');
    expect(t.transformOrigin).toBe('0 0');
  });

  it('裁成一半寬就放大兩倍，並把左上角移到定位', () => {
    const t = cropToTransform({ x: 25, y: 10, width: 50, height: 20 });
    expect(t.transform).toBe('scale(2, 5) translate(-25%, -10%)');
  });

  it('壞掉的輸入不會算出 Infinity', () => {
    // width 為 0 會算出 scale(Infinity)，整個畫面會消失
    const t = cropToTransform({ x: 0, y: 0, width: 0, height: 0 });
    expect(t.transform).not.toContain('Infinity');
    expect(t.transform).not.toContain('NaN');
  });
});

describe('resizeCrop — 拖曳角落', () => {
  const base = { x: 20, y: 20, width: 60, height: 60 }; // 右下角在 (80, 80)

  it('拖右下角時左上角不動', () => {
    const c = resizeCrop(base, 'se', { x: 50, y: 60 });
    expect(c).toEqual({ x: 20, y: 20, width: 30, height: 40 });
  });

  it('拖左上角時右下角不動', () => {
    const c = resizeCrop(base, 'nw', { x: 30, y: 40 });
    expect(c).toEqual({ x: 30, y: 40, width: 50, height: 40 });
  });

  it('拖右上角：左邊與下邊固定', () => {
    const c = resizeCrop(base, 'ne', { x: 70, y: 30 });
    expect(c).toEqual({ x: 20, y: 30, width: 50, height: 50 });
  });

  it('拖左下角：右邊與上邊固定', () => {
    const c = resizeCrop(base, 'sw', { x: 40, y: 70 });
    expect(c).toEqual({ x: 40, y: 20, width: 40, height: 50 });
  });

  it('拖過對角也不會翻面成負寬高', () => {
    const c = resizeCrop(base, 'se', { x: 5, y: 5 });
    expect(c.width).toBeGreaterThanOrEqual(MIN_CROP_PERCENT);
    expect(c.height).toBeGreaterThanOrEqual(MIN_CROP_PERCENT);
  });

  it('拖出頁面外會被切在邊界', () => {
    const c = resizeCrop(base, 'se', { x: 150, y: 150 });
    expect(c.x + c.width).toBe(100);
    expect(c.y + c.height).toBe(100);
  });

  it('迴歸測試：預設整頁時拖右下角，高度不會歸零', () => {
    // 原本寫成 Math.min(100 - height, height + 5)，整頁時算出 min(0, 105) = 0
    const c = resizeCrop(FULL_CROP, 'se', { x: 60, y: 70 });
    expect(c).toEqual({ x: 0, y: 0, width: 60, height: 70 });
  });
});

describe('moveCrop', () => {
  const base = { x: 20, y: 20, width: 40, height: 40 };

  it('整塊平移，大小不變', () => {
    expect(moveCrop(base, 10, -5)).toEqual({ x: 30, y: 15, width: 40, height: 40 });
  });

  it('碰到邊界是貼住，不是縮小', () => {
    // 使用者在調位置，不是在調大小
    const c = moveCrop(base, -50, -50);
    expect(c).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it('右下邊界同樣貼住', () => {
    const c = moveCrop(base, 100, 100);
    expect(c).toEqual({ x: 60, y: 60, width: 40, height: 40 });
  });

  it('NaN 位移當成不動', () => {
    expect(moveCrop(base, NaN, NaN)).toEqual(base);
  });
});

describe('setCropForPage', () => {
  it('只改指定那一頁', () => {
    const data = [FULL_CROP, FULL_CROP, FULL_CROP];
    const next = setCropForPage(data, 1, { x: 10, y: 10, width: 50, height: 50 }, 3);
    expect(next[0]).toEqual(FULL_CROP);
    expect(next[1]).toEqual({ x: 10, y: 10, width: 50, height: 50 });
    expect(next[2]).toEqual(FULL_CROP);
  });

  it('原本沒有 cropData 時會補出整頁的其他頁', () => {
    const next = setCropForPage(undefined, 2, { x: 0, y: 0, width: 50, height: 50 }, 4);
    expect(next).toHaveLength(4);
    expect(next[0]).toEqual(FULL_CROP);
    expect(next[2]).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('頁數比既有資料多時不會漏掉中間的洞', () => {
    const next = setCropForPage([FULL_CROP], 3, { x: 0, y: 0, width: 50, height: 50 }, 1);
    expect(next).toHaveLength(4);
    expect(next.every((c) => Number.isFinite(c.width))).toBe(true);
  });
});
