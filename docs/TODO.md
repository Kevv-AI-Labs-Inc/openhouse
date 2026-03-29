# OpenHouse — Next Steps & TODO

> Last updated: 2026-03-29

## 🔴 P0 — Must Fix

- [ ] **Kiosk iPad 离线模式全屏 + 滚动**
  - 离线模式下 iPad 界面要支持全屏展示
  - 表单内容超出屏幕时要支持滚动，当前可能被截断
  - 文件参考: `src/lib/kiosk-offline.ts`, `src/app/oh/[uuid]/kiosk/`

- [ ] **签到后 AI QA 弹出太慢**
  - 用户签到成功后，确认弹窗延迟很久才出现 AI Q&A 入口
  - 需要调查瓶颈：是等 AI scoring 回调还是前端轮询太慢
  - 目标：签到到 AI QA 可用 < 2秒

- [ ] **AI QA 回复质量不可靠**
  - 返回的答案有时候不靠谱，没有引用可靠信息来源
  - 可能需要改提示词（system prompt）
  - 考虑增加 `TAVILY_API_KEY` web grounding 提高答案质量
  - 或在回答中标注"此信息来自 MLS 数据"vs"此信息来自网络搜索"

## 🟡 P1 — Should Do

- [ ] **签到表单增加自动展开的可选字段**
  - 在基本字段（姓名/电话/邮箱）下方增加可展开区域
  - 比如：预算范围、是否有经纪人、购买时间线等
  - 这些字段在 schema 中已有定义: `interestLevel`, `buyingTimeline`, `priceRange`, `hasAgent`, `isPreApproved`

- [ ] **Custom Domain 邮件测试**
  - 目前 test domain 功能还没实操过
  - 需要实际配置一个 Resend 域名走通整个流程
  - 验证 DNS 记录 → domain verified → 发送测试邮件
  - 文件参考: `src/app/api/integrations/custom-domain/`

- [ ] **邮件 Draft → Send 全流程测试**
  - AI follow-up 生成 draft 之后，到实际发送的路由是否顺畅
  - Draft 预览弹窗需要支持滚动（长邮件被截断）
  - 需要理清 draft vs send 的区别：
    - `draft`: AI 生成了邮件内容但不会自动发送
    - `send`: 需要连接 Gmail/Microsoft/Custom Domain 其中一个 sender
    - 如果没有配置任何 sender，AI 仍会生成 draft 但不发送
  - 文件参考: `src/lib/follow-up-email.ts`, `resolveEffectiveFollowUpMode()`

- [ ] **自动邮件功能可用性测试**
  - 端到端测试：签到 → AI scoring → follow-up draft 生成 → 发送
  - 测试 Gmail / Microsoft 两种 sender 路径
  - 确认邮件内容质量、格式、收件人正确性

## 🟢 P2 — Nice to Have

- [ ] **项目回填到 Kevv 主系统**
  - OpenHouse sign-in 数据要同步回 Kevv CRM
  - Kevv sync worker 已经写好: `npm run kevv:sync`
  - 需要在主系统配好接收端 API
  - 环境变量: `KEVV_SYNC_BASE_URL`, `KEVV_SYNC_TOKEN`, `KEVV_SYNC_PATH`

- [ ] **API Comps 引入丰富 Seller Report**
  - 引入 comparable sales (comps) 数据 API
  - 用 comps 数据丰富 seller report 的市场分析部分
  - 需要评估数据源（MLS comps / listing provider / 第三方 API）

- [ ] **Seller Report 深度挖掘**
  - 发掘更多 seller report 能展示的数据维度
  - 考虑增加：区域热度、同类房源对比、visitor intent 分布图
  - 文件参考: `src/lib/seller-report.ts`, `src/lib/seller-report-metrics.ts`

- [ ] **Settings 页面 "Configured" 状态含义**
  - 检查设置页面的 "configured" 标签到底代表什么
  - 如果是指邮件 sender 已连接，确认逻辑是否正确
  - 如果没有实际用途，考虑移除避免用户困惑
  - 文件参考: `src/app/dashboard/settings/`

## 📝 待理解

- **邮件 Draft vs Send 机制**:
  - `draft` 模式: AI 生成 follow-up 邮件草稿，存在数据库里，不发送
  - `google` 模式: 通过连接的 Gmail 账号直接发送
  - `microsoft` 模式: 通过连接的 Microsoft 账号直接发送
  - `custom_domain` 模式: 通过 Resend 验证的团队域名发送（需要 Pro）
  - 模式选择在 Settings → Follow-up Email 里配置
  - 如果选了 google/microsoft 但 token 过期，会自动降级为 draft
  - 代码入口: `resolveEffectiveFollowUpMode()` in `src/lib/follow-up-email.ts`
