# CI 設定（需要你手動啟用一次）

`github-actions-ci.yml` 是已經寫好、可以直接用的 GitHub Actions 設定。

**為什麼不是放在 `.github/workflows/`**：這台機器的 GitHub 授權沒有 `workflow`
權限，推送任何 `.github/workflows/` 底下的檔案都會被拒絕：

```
refusing to allow an OAuth App to create or update workflow
`.github/workflows/ci.yml` without `workflow` scope
```

## 啟用方式（二選一）

**A. 在 GitHub 網頁上建立（最快，不用動本機設定）**

1. 打開 <https://github.com/blacKgreYcAt/violinassistant>
2. Add file → Create new file
3. 檔名填 `.github/workflows/ci.yml`
4. 把 `ci/github-actions-ci.yml` 的內容整個貼上
5. Commit

**B. 讓本機有 workflow 權限後自己推**

```bash
gh auth refresh -s workflow
git mv ci/github-actions-ci.yml .github/workflows/ci.yml
git commit -m "ci: 啟用 GitHub Actions"
git push
```

（這台機器目前沒有安裝 `gh`。）

## 啟用後會有什麼

push 到 main 或開 PR 時自動跑：

| job | 內容 |
| --- | --- |
| check | `tsc --noEmit`、ESLint、243 個單元測試 |
| e2e | 60 個 Playwright 測試（只裝 chromium），失敗時保留報告 7 天 |
