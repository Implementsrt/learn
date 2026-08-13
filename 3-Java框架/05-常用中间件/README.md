# 05 - 常用中间件

## 学习目标
- 理解每个中间件的设计取舍
- 能结合业务场景做正确选型
- 掌握生产级部署与调优

## Redis
- **数据结构**：String/Hash/List/Set/ZSet/Bitmap/HyperLogLog/Geo/Stream
- **底层实现**：SDS、压缩列表、跳表、Dict
- **持久化**：RDB、AOF、混合持久化
- **高可用**：主从、哨兵、Cluster
- **过期策略 & 内存淘汰**
- **事务 & Lua 脚本**
- **Pipeline**
- **缓存三大问题**：穿透/击穿/雪崩

## Kafka
- **架构**：Broker、Topic、Partition、Replica、ISR
- **存储**：分段日志、索引、零拷贝
- **消费语义**：At most/At least/Exactly once
- **消费者组与Rebalance**
- **事务消息**
- **性能优化**：批量、压缩、页缓存

## RocketMQ
- 与 Kafka 对比
- 顺序消息、事务消息、延迟消息、死信队列
- **NameServer 设计**
- 消费模式：Push/Pull、广播/集群

## ElasticSearch
- 倒排索引、分词器
- 分片、副本、路由
- 查询 DSL、聚合分析
- 性能调优、深分页

## ZooKeeper
- **ZAB协议**、角色（Leader/Follower/Observer）
- Watcher机制
- 典型应用：分布式锁、配置中心、Master选举

## MySQL（深度）
- **InnoDB**：B+树、聚簇索引、辅助索引、回表
- **MVCC**：Read View、undo版本链
- **锁**：行锁/表锁/间隙锁/临键锁
- **事务隔离级别** 与 **幻读**
- **Redo/Undo/Binlog** 三大日志
- **执行计划 EXPLAIN**
- **主从复制、GTID**

## 实战任务
- [ ] Redis 集群搭建 + 故障演练
- [ ] Kafka 性能压测（百万TPS调优）
- [ ] ES 索引设计与大数据量迁移
- [ ] MySQL 慢查询 Top 10 优化

## 参考资料
- 《Redis设计与实现》
- 《Kafka权威指南》《深入理解Kafka》
- 《RocketMQ技术内幕》
- 《Elasticsearch：权威指南》
- 《MySQL技术内幕：InnoDB存储引擎》
- 《从Paxos到Zookeeper》

## 学习笔记
<!-- 每个中间件可建子目录：redis/、kafka/、mysql/ 等 -->

- [2026-08-12-各种MQ重试机制对比.md](2026-08-12-各种MQ重试机制对比.md)
- [2026-08-12-MQ并发数与限速机制对比.md](2026-08-12-MQ并发数与限速机制对比.md)
- [2026-08-12-MQ核心概念与顺序消费.md](2026-08-12-MQ核心概念与顺序消费.md)
- [2026-08-14-Redis内存与热点治理.md](2026-08-14-Redis内存与热点治理.md)
- [2026-08-14-Redis持久化与分布式锁.md](2026-08-14-Redis持久化与分布式锁.md)
