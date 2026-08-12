# 01 - Docker与容器化

## 学习目标
- 理解容器技术底层原理
- 熟练编写高质量 Dockerfile
- 掌握镜像优化与安全最佳实践

## 核心知识点
### 底层原理
- **Namespace**：PID/Net/Mount/UTS/IPC/User
- **Cgroups**：资源限制（CPU/Memory/IO）
- **UnionFS**：分层存储（OverlayFS）
- **容器 vs 虚拟机**
- **runC / containerd / CRI-O**

### Docker 核心概念
- 镜像（Image）、容器（Container）、仓库（Registry）
- Volume（数据卷）、Bind Mount、tmpfs
- 网络模式：bridge/host/none/container/自定义

### Dockerfile 最佳实践
- **多阶段构建**（减小镜像）
- **合理分层**（利用缓存）
- **选择合适的基础镜像**：
  - `alpine`（小但可能有兼容问题）
  - `distroless`（无shell，更安全）
  - `slim` 版本
- **非root用户运行**
- **`.dockerignore`**
- **固定版本**（避免 `:latest`）

### 镜像优化
- 从 1GB+ 优化到 <100MB 的方法
- 层合并、清理缓存
- Spring Boot Layered JARs

### 容器安全
- 最小权限原则
- 镜像扫描（Trivy/Clair）
- Secret管理（不要写入镜像）
- 只读文件系统

### Compose（本地开发）
- `docker-compose.yml` 编排
- 服务依赖、健康检查、网络

## 实战任务
- [ ] 为 Spring Boot 应用写多阶段 Dockerfile
- [ ] 将镜像从 500MB 优化到 <150MB
- [ ] 用 Docker Compose 搭建 MySQL+Redis+App 本地环境
- [ ] 使用 Trivy 做镜像安全扫描

## 参考资料
- 《Docker Deep Dive》
- Docker 官方文档
- Google Container Best Practices

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
