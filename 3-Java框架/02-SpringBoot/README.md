# 02 - SpringBoot

## 学习目标
- 吃透自动装配原理
- 能开发企业级 Starter
- 掌握 Actuator 与生产级配置

## 核心知识点
### 启动流程
- `SpringApplication.run` 完整流程
- `SpringApplicationRunListener` 事件机制
- **Environment** 构建与 `@ConfigurationProperties` 绑定
- **Banner** 与 **EmbeddedWebServer**

### 自动装配
- `@SpringBootApplication` 三合一注解
- `@EnableAutoConfiguration` 原理
- `SpringFactoriesLoader`（2.7-）
- `AutoConfiguration.imports`（2.7+）
- `@Conditional` 系列条件注解
- **自动装配失效排查**

### Starter 开发
- 命名规范（官方 `spring-boot-starter-xxx` / 自定义 `xxx-spring-boot-starter`）
- `spring.factories` / `META-INF/spring/...imports`
- `@ConfigurationProperties` + `@EnableConfigurationProperties`
- 自定义条件注解

### Actuator
- 内置端点：`/health`/`/metrics`/`/env`/`/loggers`
- 自定义 Endpoint、HealthIndicator、Metric
- 与 Prometheus 集成（Micrometer）

### 配置管理
- 配置文件优先级
- `@Value` vs `@ConfigurationProperties`
- Profile 多环境
- 配置加密（Jasypt）

## 实战任务
- [ ] 开发一个 **企业级 Starter**（如：统一日志/限流/审计）
- [ ] 自定义 Actuator 端点（如：动态日志级别）
- [ ] 集成 Prometheus + Grafana 监控
- [ ] Debug Spring Boot 启动流程

## 参考资料
- Spring Boot Reference Guide 官方文档
- 《Spring Boot 揭秘与实战》
- GitHub: `spring-projects/spring-boot` 源码

## 学习笔记

- [2026-07-22-SpringBoot核心组件与原理.md](2026-07-22-SpringBoot核心组件与原理.md)
