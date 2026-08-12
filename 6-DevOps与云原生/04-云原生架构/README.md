# 04 - 云原生架构

## 学习目标
- 理解云原生技术全景
- 掌握 ServiceMesh 与 Serverless 的落地场景
- 具备云原生架构的设计能力

## 核心知识点
### 云原生定义（CNCF）
**容器化 + 微服务 + 不可变基础设施 + 声明式API + DevOps**

### CNCF Landscape
- **编排调度**：Kubernetes、Nomad
- **服务网格**：Istio、Linkerd、Consul Connect
- **Serverless**：Knative、OpenFaaS、Kubeless
- **API网关**：Kong、Envoy、APISIX
- **可观测性**：Prometheus、OpenTelemetry、Grafana
- **存储**：Rook、Longhorn
- **安全**：OPA、Falco、Vault
- **数据库**：TiDB、CockroachDB、Vitess

### Service Mesh
- **为什么需要**：将通用能力下沉到基础设施
- **Istio 架构**：
  - 数据平面（Envoy Sidecar）
  - 控制平面（istiod）
- **核心能力**：
  - 流量管理（VirtualService/DestinationRule）
  - 安全（mTLS/RBAC）
  - 可观测性（遥测）
- **Sidecar vs Sidecarless（Ambient Mesh）**

### Serverless
- **FaaS**（Function as a Service）
- **BaaS**（Backend as a Service）
- **冷启动优化**
- **典型场景**：事件驱动、定时任务、低频业务
- **主流平台**：AWS Lambda、阿里函数计算、Knative

### 多集群与混合云
- **KubeFed / Karmada**（联邦）
- **集群管理**：Rancher、KubeSphere
- **混合云策略**

### FinOps（云成本管理）
- 资源利用率
- HPA/VPA/ClusterAutoscaler
- Spot实例利用
- 成本归因

## 实战任务
- [ ] 在 K8s 上部署 Istio 并实现灰度发布
- [ ] 用 Knative 部署一个 Serverless 应用
- [ ] 搭建 OpenTelemetry 统一观测体系
- [ ] 为团队制定 **云原生技术路线图**

## 参考资料
- 《云原生架构白皮书》阿里云
- 《Istio实战指南》
- 《Knative 原理与实战》
- CNCF 官方 Landscape
- 《云原生应用架构实践》

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
