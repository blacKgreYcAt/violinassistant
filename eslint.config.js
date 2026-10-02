import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * 這個專案原本完全沒有 linter —— package.json 裡的 "lint" 其實只是 tsc --noEmit，
 * 只做型別檢查。這表示像「useEffect 依賴陣列缺漏導致閉包過期」、
 * 「宣告了卻從未使用的 state」這類問題完全沒有任何自動化把關，
 * 只能靠人工一個一個看，而人工複查沒有終止條件。
 *
 * react-hooks 的規則正是用來抓這一類 bug 的。
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // 這兩個是舊版備份資料夾，不是正在維護的程式碼
      'src_backup_2026-03-16/**',
      'src_backup_20260316/**',
      '**/*.backup.tsx',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 注意路徑：v7 的頂層 configs['recommended-latest'] 還是舊的 eslintrc 格式
  // （plugins 是字串陣列），flat config 版本在 configs.flat 底下。
  reactHooks.configs.flat['recommended-latest'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // 這個專案有不少刻意使用的 any（MediaPipe、webkitAudioContext 等），
      // 先降為警告，避免淹沒真正重要的問題。
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // --- 以下是 eslint-plugin-react-hooks v7 新增的 React Compiler 規則 ---
      //
      // 它們檢查的是「這段程式碼能不能被 React Compiler 安全地自動記憶化」，
      // 跟「有沒有 bug」是兩件事。這個專案寫在 Compiler 之前，逐項檢視後
      // 這些告警對應的都是刻意且可運作的寫法：
      //
      //   set-state-in-effect —— 多半是「掛載後非同步載入資料再 setState」，
      //                          以及計時器用 interval 更新畫面，都是必要的。
      //   immutability        —— 全部是「函式在自己的宣告之前被引用」，
      //                          例如 scheduler 用 setTimeout 遞迴呼叫自己、
      //                          effect 裡呼叫下面才宣告的 loadXxx()，
      //                          實際執行時機都在宣告之後。
      //   purity              —— performance.now() 寫在元件內的函式裡，
      //                          但那個函式只會從 requestAnimationFrame 呼叫，
      //                          不會在 render 期間執行（規則無法推論出這點）。
      //
      // 關掉是為了讓 lint 的輸出維持「有訊號就是新問題」。
      // 若之後要導入 React Compiler，再把這段打開當成改寫清單。
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  }
);
