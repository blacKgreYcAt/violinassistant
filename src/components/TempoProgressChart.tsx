import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, Minus } from 'lucide-react';
import { summarizeTempoProgress, TempoEntry } from '../lib/tempoProgress';

interface TempoProgressChartProps {
  history?: TempoEntry[];
}

/**
 * 曲目練習速度的進展圖。
 *
 * 節拍器停止時會記錄「這首今天練到的最高 BPM」。原本畫面上只是把這些數字
 * 列成一張平板清單，看不出有沒有進步 —— 而「這首三週從 60 練到 92」
 * 正是練習者最需要看到的回饋。
 */
export const TempoProgressChart: React.FC<TempoProgressChartProps> = ({ history }) => {
  const progress = useMemo(() => summarizeTempoProgress(history), [history]);

  if (!progress) {
    return (
      <p className="text-xs text-text-muted text-center py-8 leading-relaxed">
        尚無速度紀錄。
        <br />
        開啟節拍器練習這首曲子，停止時就會自動記錄當天練到的最高速度。
      </p>
    );
  }

  const { points, firstBpm, latestBpm, bestBpm, improvement, daysSpan, sessionCount } = progress;
  const improved = improvement > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* 一句話講完進步狀況 */}
      <div className="bg-white/5 rounded-xl p-3">
        {sessionCount === 1 ? (
          <div className="text-xs text-text-muted">
            目前練到 <span className="font-mono font-bold text-emerald-500">{latestBpm}</span> BPM。
            多練幾天就能看到進展曲線。
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {improved ? (
              <TrendingUp size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <Minus size={16} className="text-text-muted shrink-0" />
            )}
            <span className="text-xs text-text-warm">
              {daysSpan > 0 ? `${daysSpan} 天內` : '這段期間'}從{' '}
              <span className="font-mono font-bold">{firstBpm}</span> 練到{' '}
              <span className="font-mono font-bold text-emerald-500">{latestBpm}</span> BPM
            </span>
            {improved && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                +{improvement}
              </span>
            )}
          </div>
        )}
      </div>

      {points.length > 1 && (
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#888888', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#888888', fontSize: 10 }}
                domain={['dataMin - 10', 'dataMax + 10']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#121212',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#888888' }}
                formatter={(value: number) => [`${value} BPM`, '最高速度']}
              />
              {/* 標出期間內的最佳紀錄，比單看折線更有目標感 */}
              <ReferenceLine
                y={bestBpm}
                stroke="#10b981"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="bpm"
                stroke="#F27D26"
                strokeWidth={2}
                dot={{ fill: '#F27D26', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex justify-between text-[10px] text-text-muted">
        <span>練習 {sessionCount} 天</span>
        <span>
          最高 <span className="font-mono font-bold text-emerald-500">{bestBpm}</span> BPM
        </span>
      </div>
    </div>
  );
};
