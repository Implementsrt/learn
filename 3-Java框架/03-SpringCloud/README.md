# 03 - SpringCloud

## 学习目标
- 掌握微服务五大核心组件及其原理
- 能独立搭建和治理生产级微服务集群
- 熟悉 Spring Cloud Alibaba 生态

## 核心组件
### 服务注册与发现
- **Eureka**（AP，停服务）vs **Nacos**（AP/CP可切换）vs **Consul**（CP）vs **ZooKeeper**（CP）
- 心跳机制、健康检查、自我保护
- 服务实例元数据

### 负载均衡
- **Ribbon**（客户端）vs **LoadBalancer**（新版替代）
- 负载均衡算法：轮询/随机/权重/一致性哈希
- **OpenFeign**：声明式调用、与 Ribbon/LoadBalancer 集成

### 熔断降级与限流
- **Hystrix**（已停更）
- **Sentinel**：流控、熔断、系统保护、热点限流
- **Resilience4j**：函数式API、轻量级
- 限流算法：令牌桶/漏桶/滑动窗口

### 网关
- **Spring Cloud Gateway**（基于 WebFlux）
- Route/Predicate/Filter 三大核心
- 全局过滤器、自定义过滤器
- 与 Nacos 动态路由

### 配置中心
- **Nacos Config**、**Apollo**
- 动态刷新（`@RefreshScope`）
- 配置版本、灰度发布

### 分布式追踪
- **Sleuth + Zipkin**
- **SkyWalking**
- TraceId / SpanId 传播

## 实战任务
- [ ] 搭建完整的微服务脚手架（Nacos + Gateway + Sentinel + SkyWalking）
- [ ] 实现 Gateway 自定义鉴权过滤器
- [ ] Sentinel 规则持久化到 Nacos
- [ ] 模拟服务雪崩并用熔断降级化解

## 参考资料
- 《Spring Cloud Alibaba 微服务原理与实战》
- Nacos / Sentinel 官方文档
- 阿里中间件团队博客

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
