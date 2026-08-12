# 04 - ORM与数据访问

## 学习目标
- 深入 MyBatis/JPA 原理
- 掌握连接池与分库分表方案
- 能设计高性能数据访问层

## 核心知识点
### MyBatis
- **架构**：Configuration、SqlSession、Executor、StatementHandler
- **动态SQL**：OGNL、SqlSource、BoundSql
- **缓存**：一级缓存（SqlSession级）、二级缓存（Mapper级）
- **插件机制**：`Interceptor` 原理、分页插件、数据权限
- **MyBatis-Plus**：条件构造器、代码生成、逻辑删除

### JPA / Hibernate
- 实体生命周期：Transient/Persistent/Detached/Removed
- 一级/二级缓存、查询缓存
- N+1 问题与解决
- Spring Data JPA 方法命名规则、`@Query`

### 连接池
- **HikariCP**（默认首选）：为什么快
- **Druid**：监控强大
- 核心参数：`maximumPoolSize`、`connectionTimeout`、`idleTimeout`
- 连接泄漏排查

### 分库分表
- **ShardingSphere**（JDBC / Proxy）
- 分片策略：取模/范围/一致性哈希/时间
- 跨库 Join、分布式事务、分布式ID
- 数据迁移、双写方案

### 读写分离
- 主从延迟处理
- 强制走主库场景

## 实战任务
- [ ] 编写 MyBatis 自定义插件（SQL审计/性能监控）
- [ ] ShardingSphere 分库分表实战（订单表按用户ID分片）
- [ ] 对比 HikariCP / Druid / C3P0 性能
- [ ] 排查一次连接池泄漏问题

## 参考资料
- 《MyBatis 技术内幕》
- ShardingSphere 官方文档
- HikariCP Wiki

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->

- [2026-06-25-MySQL基础架构与SQL执行流程.md](2026-06-25-MySQL基础架构与SQL执行流程.md)
- [2026-06-25-MySQL索引详解.md](2026-06-25-MySQL索引详解.md)
- [2026-06-25-MySQL锁机制.md](2026-06-25-MySQL锁机制.md)
- [2026-06-25-数据库主从与分片.md](2026-06-25-数据库主从与分片.md)
- [2026-06-28-MySQL底层数据结构设计与核心知识点.md](2026-06-28-MySQL底层数据结构设计与核心知识点.md)
- [2026-07-03-数据库设计三大范式.md](2026-07-03-数据库设计三大范式.md)
- [2026-07-23-MySQL执行计划结果详解.md](2026-07-23-MySQL执行计划结果详解.md)
- [2026-07-23-MyBatis-Mapper工作原理.md](2026-07-23-MyBatis-Mapper工作原理.md)
- [2026-07-23-MySQL批量插入.md](2026-07-23-MySQL批量插入.md)
- [2026-08-12-深分页成本分析与解决方案.md](2026-08-12-深分页成本分析与解决方案.md)
