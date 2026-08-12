# 03 - CI/CD

## 学习目标
- 搭建高效的持续交付流水线
- 掌握主流发布策略与回滚机制
- 实践 GitOps 理念

## 核心知识点
### CI（持续集成）
- **代码质量门禁**：
  - 单元测试覆盖率
  - SonarQube 静态扫描
  - 依赖漏洞扫描（OWASP Dependency Check）
  - 镜像扫描（Trivy）
- **构建缓存**：Maven/Gradle缓存、Docker层缓存
- **并行化**：测试分组、矩阵构建

### CD（持续部署/交付）
- **环境管理**：dev/test/staging/prod
- **配置管理**：12-Factor、外部化配置
- **制品管理**：Nexus/Harbor/Artifactory

### 发布策略
- **滚动更新**：逐批替换（K8s默认）
- **蓝绿部署**：两套环境、瞬间切换
- **金丝雀发布**：小流量验证
- **A/B 测试**：基于用户分流
- **Feature Flag**：代码级开关（LaunchDarkly/Apollo）

### 主流工具
- **Jenkins**（老牌、插件丰富）
  - Pipeline as Code（Jenkinsfile）
  - 共享库（Shared Library）
- **GitLab CI**（GitLab内置）
- **GitHub Actions**（GitHub内置，YAML）
- **ArgoCD / FluxCD**（GitOps首选）
- **Tekton**（Kubernetes原生）

### GitOps
- **核心理念**：Git 作为唯一真实来源
- **拉模式**（ArgoCD） vs **推模式**（传统CI）
- 优势：审计、回滚、多环境一致

### DevSecOps
- **SAST**（静态代码分析）
- **DAST**（动态应用安全测试）
- **SCA**（软件成分分析）
- **Secret 扫描**（GitLeaks/TruffleHog）

## 实战任务
- [ ] 搭建 Jenkins Pipeline 从代码到K8s部署
- [ ] 用 GitHub Actions 实现多环境自动发布
- [ ] 用 ArgoCD 落地 GitOps 工作流
- [ ] 实现金丝雀发布 + 自动回滚

## 参考资料
- 《持续交付》Jez Humble ★★★★★
- 《DevOps实践指南》
- Weaveworks GitOps 白皮书
- ArgoCD / Jenkins 官方文档

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
