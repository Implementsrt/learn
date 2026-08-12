# 02 - 数据库优化

## 学习目标
- 吃透 MySQL/InnoDB 底层原理
- 具备 SQL 优化的系统方法
- 掌握大数据量场景的架构方案

## 核心知识点
### InnoDB 存储引擎
- **B+树索引**：为什么是B+树？
- **聚簇索引 vs 辅助索引**、回表、覆盖索引
- **MVCC**：Read View、undo版本链、快照读 vs 当前读
- **锁**：行锁/Gap/Next-Key/意向锁、死锁分析
- **事务隔离级别**：RU/RC/RR/Serializable，幻读问题
- **三大日志**：
  - **Redo Log**：崩溃恢复（物理日志）
  - **Undo Log**：回滚 + MVCC
  - **Binlog**：主从复制 + 恢复（逻辑日志）
- **两阶段提交**：Redo与Binlog一致性

### 索引优化
- **最左前缀匹配**
- **索引下推（ICP）**
- **索引选择性、基数**
- **索引失效场景**：
  - 函数/表达式在左边
  - 隐式类型转换
  - `LIKE '%xx'`
  - `OR` 非索引列
  - 范围后的等值

### SQL 优化
- **EXPLAIN** 所有列含义：type/key/rows/Extra
- **慢查询日志**分析（pt-query-digest）
- **深分页优化**（游标/延迟关联）
- **大表 DDL**（pt-online-schema-change、gh-ost）
- **JOIN优化**：小表驱动大表、`STRAIGHT_JOIN`

### 架构方案
- **读写分离**：ProxySQL、MyCat、ShardingSphere
- **分库分表**：垂直/水平、中间件选型
- **数据归档**：冷热分离
- **迁移方案**：双写、Canal同步

### 其他数据库
- **PostgreSQL** vs MySQL
- **TiDB**（NewSQL、HTAP）
- **ClickHouse**（OLAP）
- **MongoDB**（文档型）

## 实战任务
- [ ] 在一张千万级表上做索引优化实战
- [ ] 深分页优化案例（from 100w, 10）
- [ ] 用 Canal 同步 MySQL → ES
- [ ] 一次完整的分库分表改造

## 参考资料
- 《MySQL技术内幕：InnoDB存储引擎》姜承尧 ★★★★★
- 《高性能MySQL》
- 丁奇《MySQL实战45讲》★★★★★
- 官方文档：InnoDB Architecture

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->

- [深分页成本分析与解决方案（ORM 与数据访问笔记）](../../3-Java框架/04-ORM与数据访问/2026-08-12-深分页成本分析与解决方案.md)
