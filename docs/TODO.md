# OpenHouse — Next Steps & TODO

> Last updated: 2026-04-14

## 🔴 P0 — Must Fix

- [x] **Kiosk iPad 离线模式全屏 + 滚动**
  - ✅ 添加了 Fullscreen API 按钮（含 webkit 前缀兼容）
  - ✅ 添加了 `viewport-fit: cover` 和 safe-area padding
  - 仍需在实际 iPad 上验证滚动体验
  - 文件参考: `src/lib/kiosk-offline.ts`, `src/app/oh/[uuid]/kiosk/`

- [x] **签到后 AI QA 弹出太慢**
  - ✅ 将跳转延时从 1400ms 缩短至 800ms（仅保留最短动画展示时间）
  - 后端已在签到响应中返回 `chatUnlocked`，前端收到后即可跳转
  - 文件参考: `src/app/oh/[uuid]/page.tsx`

- [x] **AI QA 回复质量不可靠**
  - ✅ 在 system prompt 中增加了强制来源标注规则（MLS / Agent FAQ / Web Search）
  - ✅ 对 uncertain 回答增加了明确提示用户确认的指令
  - 可继续优化：增加 `TAVILY_API_KEY` web grounding 提高答案质量
  - 文件参考: `src/lib/ai/property-qa.ts`

## 🟡 P1 — Should Do

- [x] **签到表单增加自动展开的可选字段**
  - ✅ 公共页和 Kiosk 页的可选区域会在首次聚焦表单时自动展开
  - ✅ 新增 `priceRange` 自由文本 UI，提交后进入现有 schema / lead scoring / seller report 流程
  - ✅ 公共页和 Kiosk 页均包含: `hasAgent`, `isPreApproved`, `interestLevel`, `buyingTimeline`, `priceRange`
  - 文件参考: `src/app/oh/[uuid]/kiosk/page.tsx`, `src/app/oh/[uuid]/page.tsx`

- [x] **Custom Domain 邮件测试**
  - ✅ Settings 页面新增 `Send test email` 按钮，verified 域名可直接发 live test mail
  - ✅ 新增 `/api/integrations/custom-domain/test` 路由
  - ✅ 已补 smoke tests 覆盖 save config + test send 路径
  - 文件参考: `src/app/dashboard/settings/page.tsx`, `src/app/api/integrations/custom-domain/`

- [x] **邮件 Draft → Send 全流程测试**
  - ✅ Draft 预览支持滚动 (`max-h-[85vh] overflow-y-auto`)
  - ✅ 已补 critical tests 覆盖 `send=false` draft-only 以及实际 send 路径
  - 需要理清 draft vs send 的区别：
    - `draft`: AI 生成了邮件内容但不会自动发送
    - `send`: 需要连接 Gmail/Microsoft/Custom Domain 其中一个 sender
    - 如果没有配置任何 sender，AI 仍会生成 draft 但不发送
  - 文件参考: `src/lib/follow-up-email.ts`, `resolveEffectiveFollowUpMode()`

- [x] **自动邮件功能可用性测试**
  - ✅ 已补 critical tests 覆盖 Gmail / Microsoft / Custom Domain 三条 sender 路径
  - ✅ follow-up route 会在发送/草稿更新后继续触发 Kevv sync re-queue
  - 邮件文案质量仍建议在真实账号上做人工 spot check

## 🟢 P2 — Nice to Have

- [ ] **项目回填到 Kevv 主系统**
  - OpenHouse 侧 sync worker 已完成: `npm run kevv:sync`
  - 仍需在 Kevv 主系统配好接收端 API（仓库外依赖）
  - 环境变量: `KEVV_SYNC_BASE_URL`, `KEVV_SYNC_TOKEN`, `KEVV_SYNC_PATH`

- [ ] **API Comps 引入丰富 Seller Report**
  - Seller Report 已支持 `propertyFacts.market` / comparable sales 数据结构与展示
  - 仍需接入上游 comps 数据源（MLS comps / listing provider / 第三方 API）
  - 文件参考: `src/lib/listing-import-shared.ts`, `src/components/seller-report-view.tsx`

- [x] **Seller Report 深度挖掘**
  - ✅ 新增 visitor intent distribution / buyer readiness / budget signals
  - ✅ 新增 market context snapshot，支持 neighborhood / listing facts / comparable sales snapshot
  - 文件参考: `src/lib/seller-report.ts`, `src/lib/seller-report-metrics.ts`, `src/components/seller-report-view.tsx`

- [x] **Settings 页面 "Configured" 状态含义**
  - ✅ 已确认逻辑正确：显示各集成的连接状态（configured/missing）
  - 对应 `googleAuthConfigured`, `microsoftAuthConfigured`, `stripeConfigured` 等字段
  - 文件参考: `src/app/dashboard/settings/page.tsx`

## 📝 待理解

- **邮件 Draft vs Send 机制**:
  - `draft` 模式: AI 生成 follow-up 邮件草稿，存在数据库里，不发送
  - `google` 模式: 通过连接的 Gmail 账号直接发送
  - `microsoft` 模式: 通过连接的 Microsoft 账号直接发送
  - `custom_domain` 模式: 通过 Resend 验证的团队域名发送（需要 Pro）
  - 模式选择在 Settings → Follow-up Email 里配置
  - 如果选了 google/microsoft 但 token 过期，会自动降级为 draft
  - 代码入口: `resolveEffectiveFollowUpMode()` in `src/lib/follow-up-email.ts`
