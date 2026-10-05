import React from 'react';
import { VIOLIN_BODY_PATH, VIOLIN_GEOMETRY as G } from '../lib/violinPath';

interface ViolinIconProps {
  size?: number;
  className?: string;
}

/**
 * 小提琴圖示。
 *
 * lucide-react 沒有提供小提琴（只有 Guitar / Piano / Music 等），所以自製。
 *
 * 輪廓路徑來自 src/lib/violinPath.ts，而那個檔案是由 scripts/generate-icons.py
 * 產生的 —— 與 PWA 的 PNG 圖示共用同一組控制點。這樣介面上的識別與
 * 主畫面上的圖示才不會各畫各的而比例走樣。
 *
 * 用 fill="currentColor" 跟隨文字顏色，與 lucide 的用法一致，
 * 可以直接套用既有的 text-* 樣式。
 */
export const ViolinIcon: React.FC<ViolinIconProps> = ({ size = 24, className }) => {
  // f 孔用 evenodd 以「挖洞」的方式呈現，圖示才能維持單色、
  // 隨容器背景變化而不需要知道背景色是什麼。
  const fHole = (sign: 1 | -1) => {
    const x = G.centerX + sign * G.fHoleX;
    const w = 0.22;
    return `M${x - w} ${G.fHoleTop}L${x + w} ${G.fHoleTop}L${x + w} ${G.fHoleBottom}L${x - w} ${G.fHoleBottom}Z`;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* 琴頸 */}
      <path
        d={
          `M${G.centerX - G.neckHalfWidth} ${G.neckBottom}` +
          `L${G.centerX + G.neckHalfWidth} ${G.neckBottom}` +
          `L${G.centerX + G.neckHalfWidth} ${G.neckTop}` +
          `L${G.centerX - G.neckHalfWidth} ${G.neckTop}Z`
        }
      />
      {/* 弦軸箱：比琴頸略寬 */}
      <path
        d={
          `M${G.centerX - G.neckHalfWidth} ${G.neckTop + 0.4}` +
          `L${G.centerX + G.neckHalfWidth} ${G.neckTop + 0.4}` +
          `L${G.centerX + G.pegHalfWidth} ${G.pegTop}` +
          `L${G.centerX - G.pegHalfWidth} ${G.pegTop}Z`
        }
      />
      {/* 琴頭渦卷 */}
      <circle cx={G.scrollCx} cy={G.scrollCy} r={G.scrollR} />
      {/* 琴身，並挖出兩個 f 孔 */}
      <path d={`${VIOLIN_BODY_PATH}${fHole(-1)}${fHole(1)}`} fillRule="evenodd" />
    </svg>
  );
};
