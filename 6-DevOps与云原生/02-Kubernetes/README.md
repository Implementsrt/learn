# 02 - Kubernetes

## 学习目标
- 掌握 K8s 核心对象与声明式API
- 具备生产集群运维能力
- 能开发自定义 Operator

## 核心知识点
### 架构
- **控制平面**：API Server / etcd / Scheduler / Controller Manager
- **节点组件**：kubelet / kube-proxy / CRI / CNI
- **声明式 API** 与 **控制器模式**

### 核心资源对象
- **工作负载**：
  - `Pod`（最小单元，共享网络/存储）
  - `Deployment`（无状态）
  - `StatefulSet`（有状态）
  - `DaemonSet`（每节点一个）
  - `Job` / `CronJob`
- **服务与路由**：
  - `Service`（ClusterIP/NodePort/LoadBalancer/Headless）
  - `Ingress` / `IngressController`（Nginx/Traefik）
  - `EndpointSlice`
- **配置**：`ConfigMap`、`Secret`
- **存储**：`PV`、`PVC`、`StorageClass`
- **调度**：`Node Affinity`、`Taint/Toleration`、`Topology Spread`

### 网络
- **CNI插件**：Flannel/Calico/Cilium
- **Service 实现原理**（iptables/IPVS）
- **DNS**（CoreDNS）
- **NetworkPolicy**

### 包管理
- **Helm**：Chart、Release、模板、values
- **Kustomize**：patch方式，无模板

### 扩展
- **CRD**（Custom Resource Definition）
- **Operator 模式**：Controller + CRD
- **client-go / kubebuilder / operator-sdk**
- **Admission Webhook**

### 运维
- 日志：`kubectl logs` + Loki/EFK
- 监控：Prometheus Operator + Grafana
- 故障排查：`kubectl describe/exec/debug`
- **滚动更新 & 回滚**

## 实战任务
- [ ] 搭建 K8s 集群（kubeadm 或 minikube/k3s）
- [ ] 将 Spring Boot 应用完整部署到 K8s（含 Ingress/HPA）
- [ ] 编写 Helm Chart 并发布
- [ ] 开发一个简单的 **Operator**（如：自定义缓存CRD）
- [ ] 配置 Prometheus + Grafana 监控 K8s 集群

## 必备命令
```bash
kubectl get/describe/logs/exec/port-forward
kubectl apply/delete/rollout
kubectl top nodes/pods
kubectl config / context
```

## 参考资料
- 《Kubernetes in Action》★★★★★
- 《Kubernetes 权威指南》
- 《深入剖析 Kubernetes》张磊（极客时间）
- 官方文档 kubernetes.io

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
