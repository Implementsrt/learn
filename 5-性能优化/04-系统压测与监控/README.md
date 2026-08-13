# 04 - 系统压测与监控

## 学习目标
- 具备完整的压测能力
- 搭建生产级可观测性体系
- 能用数据驱动性能优化

## 压测体系
### 压测类型
- **基准测试**：单接口性能baseline
- **负载测试**：找性能拐点
- **压力测试**：系统极限
- **稳定性测试**：长时间运行
- **全链路压测**：生产流量回放

### 压测工具
- **JMeter**（GUI友好，功能全）
- **wrk / wrk2**（轻量、高并发）
- **Gatling**（Scala，报告美观）
- **阿里 PTS**（SaaS）
- **Locust**（Python、易扩展）

### 压测指标
- **吞吐量（TPS/QPS）**
- **响应时间**：P50/P95/P99/P999
- **并发用户数**
- **错误率**
- **资源利用率**（CPU/内存/IO/网络）

### 全链路压测
- **流量染色**
- **影子库/影子表**
- **Mock外部依赖**
- 典型案例：阿里双11

## 监控体系（可观测性三支柱）
### Metrics（指标）
- **Prometheus + Grafana**（主流）
- **Micrometer**（Spring Boot集成）
- **四大黄金指标**：延迟/流量/错误/饱和度
- **RED方法**：Rate/Errors/Duration
- **USE方法**：Utilization/Saturation/Errors

### Logging（日志）
- **ELK / EFK**（Elasticsearch + Logstash/Fluentd + Kibana）
- **Loki**（轻量，Grafana系）
- **统一日志格式**：TraceId/SpanId传递
- **日志采样**：减少成本

### Tracing（链路）
- **SkyWalking**（国产、无侵入）
- **Zipkin**
- **Jaeger**
- **OpenTelemetry**（CNCF标准）

### 告警
- **告警分级**：P0/P1/P2
- **告警收敛**：避免告警风暴
- **告警值班**（On-Call）
- **事后复盘**（Postmortem）

## 实战任务
- [ ] 搭建 Prometheus + Grafana + AlertManager
- [ ] 集成 SkyWalking 实现全链路追踪
- [ ] 对核心接口做 **全链路压测** 并产出报告
- [ ] 建立团队的 **SLO/SLI** 体系

## 参考资料
- 《Google SRE》系列
- 《Observability Engineering》
- SkyWalking / Prometheus 官方文档
- 阿里《尽在双11》

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->

- [2026-08-14-可观测性三支柱与故障排查.md](2026-08-14-可观测性三支柱与故障排查.md)
