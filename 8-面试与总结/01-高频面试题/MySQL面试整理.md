# 六、MySQL

## 项目场景提炼索引

- Q1：分库分表后，跨分片分页和缺少分片键的查询怎么处理？
- Q2：为什么用 CDC/Canal 同步搜索索引，如何处理乱序、失败和重建？

## 1. 索引为什么用 B+ 树？

```
B+ 树特点：
  ① 非叶子节点只存索引（key），不存数据 → 每个节点能装更多 key → 树更矮
  ② 叶子节点存所有数据，用链表串联 → 范围查询高效
  ③ 所有查询都要到叶子节点 → 查询性能稳定

                   [10 | 20 | 30]              ← 非叶子（只存 key）
                  /    |     |    \
         [1,3,5,8] [11,15,18] [21,25] [31,35,40]  ← 叶子（存数据+链表串联）
              →         →          →       

对比：
  B 树：非叶子也存数据 → 节点能装的 key 少 → 树更高 → 磁盘 IO 多
  Hash：等值查询 O(1)，但不支持范围查询、排序
  红黑树：树太高（二叉），磁盘 IO 多
```

---

## 2. 聚簇索引和非聚簇索引？

```
聚簇索引（主键索引）：
  叶子节点存整行数据
  ┌─────────────────┐
  │ id=1 → 整行数据  │
  │ id=2 → 整行数据  │
  │ id=3 → 整行数据  │
  └─────────────────┘

非聚簇索引（二级索引 / 辅助索引）：
  叶子节点存主键值
  ┌──────────────────┐
  │ name="张三" → id=3 │
  │ name="李四" → id=1 │
  └──────────────────┘
  
  查到主键后，还要回到聚簇索引查整行数据 → 这叫"回表"
```

**覆盖索引：** 如果查询的列都在二级索引中，不需要回表，称为覆盖索引。

```sql
-- 索引：idx_name_age(name, age)
SELECT name, age FROM user WHERE name = '张三';  -- 覆盖索引，不回表 ✅
SELECT name, age, email FROM user WHERE name = '张三'; -- 需要回表 ❌
```

---

## 3. 索引失效的场景？

| 场景 | 示例 | 原因 |
|------|------|------|
| 对索引列使用函数 | `WHERE YEAR(create_time) = 2025` | 索引存的是原始值 |
| 隐式类型转换 | `WHERE phone = 13800138000`（phone 是 varchar） | 相当于对列加了函数 |
| 最左前缀不匹配 | 联合索引(a,b,c)，`WHERE b=1` | 跳过了 a |
| LIKE 左模糊 | `WHERE name LIKE '%张'` | 无法利用 B+ 树有序性 |
| OR 条件 | `WHERE a=1 OR b=2`（b 无索引） | 需要全表扫描 b |
| NOT / != / <> | `WHERE status != 1` | 优化器认为全扫更快 |
| IS NULL / IS NOT NULL | 看数据分布 | NULL 值多时可能不走索引 |

---

## 4. 事务的 ACID 和隔离级别？

**ACID：**
- **A 原子性：** 事务要么全成功，要么全回滚（undo log）
- **C 一致性：** 事务前后数据状态一致（约束不被破坏）
- **I 隔离性：** 并发事务互不干扰（锁 + MVCC）
- **D 持久性：** 事务提交后数据永久保存（redo log）

**隔离级别：**

| 级别 | 脏读 | 不可重复读 | 幻读 |
|------|------|-----------|------|
| READ UNCOMMITTED | ✅ | ✅ | ✅ |
| READ COMMITTED | ❌ | ✅ | ✅ |
| **REPEATABLE READ**（MySQL 默认） | ❌ | ❌ | ❌（InnoDB 通过间隙锁解决） |
| SERIALIZABLE | ❌ | ❌ | ❌ |

**MVCC 原理（多版本并发控制）：**
- 每行记录有隐藏列：创建版本号、删除版本号
- 每个事务有自己的快照（ReadView）
- 读操作读快照（不加锁），写操作加行锁
- 实现了读写不冲突

---

## 5. MySQL 锁的类型？

```
按粒度：
  全局锁 → 表锁 → 行锁

行锁类型（InnoDB）：
  ① 记录锁（Record Lock）：锁定一行
  ② 间隙锁（Gap Lock）：锁定索引之间的间隙（防幻读）
  ③ 临键锁（Next-Key Lock）：记录锁 + 间隙锁（InnoDB 默认）

按模式：
  共享锁（S锁 / 读锁）：SELECT ... LOCK IN SHARE MODE
  排他锁（X锁 / 写锁）：SELECT ... FOR UPDATE / INSERT / UPDATE / DELETE
  
  S 与 S 兼容
  S 与 X 互斥
  X 与 X 互斥
```

---

## 6. SQL 优化思路？

```
① EXPLAIN 分析执行计划
   重点看：type（ALL=全扫描，ref/range=用了索引）、rows、Extra

② 索引优化
   - 高区分度列建索引
   - 联合索引遵循最左前缀
   - 覆盖索引避免回表

③ SQL 优化
   - 避免 SELECT *
   - 小表驱动大表（IN vs EXISTS）
   - 分页优化：WHERE id > 上一页最大id LIMIT 10（替代 OFFSET）
   - 避免在 WHERE 中对索引列做运算/函数

④ 架构优化
   - 读写分离
   - 分库分表
   - 缓存热点数据
```


---

# 十九、MySQL 补充

## 1. EXPLAIN 详解

```sql
EXPLAIN SELECT * FROM user WHERE name = '张三' AND age > 18;
```

| 列名 | 说明 | 重点关注 |
|------|------|---------|
| **type** | 访问类型（重要！） | system > const > eq_ref > ref > range > index > **ALL** |
| **key** | 实际使用的索引 | NULL 表示没走索引 |
| **rows** | 预估扫描行数 | 越小越好 |
| **Extra** | 额外信息 | |

**type 从好到差：**

```
system     表只有一行（const 的特例）
const      主键或唯一索引等值查询，最多一行
eq_ref     关联查询中，被驱动表用主键/唯一索引
ref        非唯一索引等值查询
range      索引范围查询（BETWEEN、>、<、IN）
index      全索引扫描（比 ALL 好，但还是扫了整个索引）
ALL        全表扫描（最差，必须优化！）
```

**Extra 重要值：**

```
Using index          覆盖索引，不需要回表 ✅
Using where          服务器层过滤
Using index condition  索引下推（ICP），在存储引擎层过滤 ✅
Using temporary      使用了临时表（需优化）❌
Using filesort       使用了文件排序（需优化）❌
Using join buffer    关联查询未用索引（需优化）❌
```

---

## 2. binlog、redo log、undo log？

```
三种日志各司其职：

┌──────────────────────────────────────────────────────────────┐
│ redo log（重做日志）—— InnoDB 引擎层                          │
│                                                               │
│ 作用：保证持久性（D），崩溃恢复                                  │
│ 内容：物理日志，记录"在某个数据页上做了什么修改"                  │
│ 写入时机：事务执行中就写入（WAL：Write-Ahead Logging）          │
│ 大小：固定大小（如 4 个文件，每个 1GB），循环写                   │
│                                                               │
│ 崩溃恢复：MySQL 重启 → 读 redo log → 重放未刷盘的修改          │
├──────────────────────────────────────────────────────────────┤
│ undo log（回滚日志）—— InnoDB 引擎层                          │
│                                                               │
│ 作用：保证原子性（A）+ MVCC                                    │
│ 内容：逻辑日志，记录"反操作"                                    │
│   INSERT → 记录 DELETE                                        │
│   UPDATE → 记录 UPDATE 回原值                                 │
│   DELETE → 记录 INSERT 回来                                   │
│ 用途：                                                        │
│   ① 事务回滚时执行反操作                                       │
│   ② MVCC 读取历史版本（ReadView + undo 版本链）                │
├──────────────────────────────────────────────────────────────┤
│ binlog（归档日志）—— MySQL Server 层                          │
│                                                               │
│ 作用：主从复制 + 数据恢复                                      │
│ 内容：逻辑日志，记录 SQL 语句或行变更                            │
│ 三种格式：                                                     │
│   Statement：记录 SQL 语句（可能主从不一致）                    │
│   Row：记录行变更（数据量大但准确）                              │
│   Mixed：混合模式                                              │
│                                                               │
│ 主从复制：主库写 binlog → 从库 IO 线程读取 → relay log         │
│          → 从库 SQL 线程重放                                   │
└──────────────────────────────────────────────────────────────┘
```

**一条 UPDATE 语句的执行过程：**

```
UPDATE user SET name='李四' WHERE id=1;

① 从 Buffer Pool 读取 id=1 的数据页（没有则从磁盘加载）
② 写 undo log（旧值，用于回滚和 MVCC）
③ 在 Buffer Pool 中修改数据页（内存中修改）
④ 写 redo log（prepare 状态）
⑤ 写 binlog
⑥ 提交事务：redo log 改为 commit 状态
   → 这就是"两阶段提交"，保证 redo log 和 binlog 一致
```

---

## 3. 主从复制原理

```
主库（Master）                          从库（Slave）
  ↓ 写操作                                ↓
  写 binlog                            ① IO Thread
  ↓                                       连接主库
  binlog ──────────────────────────►   读取主库 binlog
                                       写入 relay log（中继日志）
                                          ↓
                                       ② SQL Thread
                                       读取 relay log
                                       重放 SQL
                                       写入从库数据
```

**主从延迟原因：**
- 从库单线程重放（MySQL 5.6+ 支持多线程）
- 从库硬件差
- 大事务
- 网络延迟

**主从延迟解决：**
- 强制走主库查询（写后读场景）
- 半同步复制（至少一个从库确认后才返回）
- 多线程复制

---

## 4. 分库分表

```
垂直拆分：
  按业务拆分
  用户库（user_db）、订单库（order_db）、商品库（product_db）

水平拆分：
  按数据拆分，相同表结构
  user_0（id % 4 == 0）
  user_1（id % 4 == 1）
  user_2（id % 4 == 2）
  user_3（id % 4 == 3）

分片策略：
  ① 取模：id % N（简单但扩容困难）
  ② 范围：id 1-100万 → 表1，100万-200万 → 表2（扩容容易但热点问题）
  ③ 一致性 Hash（扩容方便）

带来的问题：
  ① 跨库 JOIN → 代码层面关联 / 冗余字段
  ② 分布式事务 → Seata / 最终一致性
  ③ 全局 ID → 雪花算法
  ④ 聚合查询（count/order by/group by）→ 各分片查询后合并
  ⑤ 扩容迁移数据
  
常用中间件：ShardingSphere、MyCat
```

---

## 5. 慢 SQL 排查与优化

```
① 开启慢查询日志
  SET GLOBAL slow_query_log = ON;
  SET GLOBAL long_query_time = 1;    -- 超过 1 秒记录

② 分析慢 SQL
  EXPLAIN SELECT ...;
  看 type、key、rows、Extra

③ 常见优化手段
  - 加合适的索引（联合索引、覆盖索引）
  - 避免 SELECT *
  - 优化子查询为 JOIN
  - 拆分复杂 SQL
  - 大 IN 列表拆分
  - 分页优化（游标分页 / 延迟关联）

④ 表设计优化
  - 适当冗余（减少 JOIN）
  - 选择合适的数据类型（INT 比 VARCHAR 快）
  - 大字段（TEXT/BLOB）拆分到单独的表
```


---

# 二十六、MySQL 深入面试题

---

## 一、IN 和 EXISTS 的区别

```
核心区别：驱动表不同 + 查找方式不同

IN：子查询先执行，结果集加载到内存（HashSet），再遍历外表匹配
EXISTS：外表驱动，每一行去子查询里走索引验证是否存在

【时间复杂度速查】
  O(1)     → 常数时间，不管数据量多大耗时都一样（如 HashSet 查找）
  O(logN)  → 对数时间，数据翻倍耗时只加一点点（如 B+树索引查找）
  O(N)     → 线性时间，数据翻倍耗时也翻倍（如全表扫描）
  速度排序：O(1) > O(logN) > O(N)

-- IN 的执行过程：
SELECT * FROM user WHERE id IN (SELECT user_id FROM orders);
① 先执行子查询 → 扫描 orders 表 → 得到结果集 (1, 2, 5, 8, ...)
② MySQL Server 层（执行器）把结果集构建成内存中的哈希表
   → 这叫"物化"（Materialization），是 Server 层的优化
   → 不是 InnoDB 的数据结构，跟 Buffer Pool 无关
③ 遍历 user 表每一行 → 每行去哈希表里查 → O(1)

-- EXISTS 的执行过程：
SELECT * FROM user u WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id);
① 遍历 user 表每一行
② 每一行去 InnoDB 存储引擎层，走 orders 表的 B+树索引查找 → O(logN)
③ 有结果 → 返回，没结果 → 跳过

★ 本质区别：查找发生在不同的层，方式不同
  IN     → Server 层哈希表查找 → O(1)   → 内存操作，极快
  EXISTS → InnoDB 层 B+树查找  → O(logN) → 可能涉及磁盘 IO

性能分析：

  user 1000 行（小表），orders 100 万行（大表）：
    IN：扫描 orders 100万行建哈希表 + 遍历 user 1000行 × O(1) = 100万 + 1000 ≈ 100 万
    EXISTS：遍历 user 1000行 × 每行查 orders 索引 O(log100万) = 1000 × 20 = 2 万 ✅

    → EXISTS 快：外表只有 1000 行，1000 次索引查找远比扫描 100 万行建哈希表快

  user 100 万行（大表），orders 1000 行（小表）：
    IN：扫描 orders 1000行建哈希表 + 遍历 user 100万行 × O(1) = 1000 + 100万 ≈ 100 万
    EXISTS：遍历 user 100万行 × 每行查 orders 索引 O(log1000) = 100万 × 10 = 1000 万 ❌

    → IN 快：虽然都要遍历 100 万行，但 IN 每行 O(1) 哈希查找，EXISTS 每行 O(logN) 索引查找

口诀：小表驱动大表
  外表小，内表大 → 用 EXISTS（少量索引查找，避免大表装内存）
  外表大，内表小 → 用 IN（小结果集装哈希表，大表用 O(1) 匹配）

注意事项：
  ① EXISTS 的前提是内表关联字段有索引，否则每次全表扫描 → 灾难
  ② IN 子查询结果集太大（几百万）→ Server 层内存装不下 → 性能下降
  ③ NOT IN 子查询结果包含 NULL → 整个查询返回空！
     因为 id NOT IN (1, 2, NULL) 中 id != NULL 永远是 UNKNOWN
     NOT EXISTS 没有这个问题 → 做反向排除推荐用 NOT EXISTS
```

## 二、脏读、不可重复读和幻读

```
三个都是并发事务导致的读数据问题。

【脏读（Dirty Read）】
  读到了别人还没提交的数据
  事务 A 修改了数据但还没提交 → 事务 B 读到了 → A 回滚 → B 拿到的是"脏"数据

【不可重复读（Non-Repeatable Read）】
  同一个事务内，两次读同一行，值不一样
  事务 A 第一次读 age=25 → 事务 B UPDATE age=28 并提交 → A 第二次读 age=28
  重点：同一行数据的值变了（UPDATE 导致）

【幻读（Phantom Read）】
  同一个事务内，两次范围查询，行数不一样
  事务 A 第一次查 age>20 得到 3 条 → 事务 B INSERT 一条 age=22 → A 第二次查得到 4 条
  重点：行数变了（INSERT/DELETE 导致），像"幻觉"一样

隔离级别对应关系：
                     脏读     不可重复读    幻读
  Read Uncommitted   ❌会发生   ❌会发生    ❌会发生
  Read Committed     ✅解决     ❌会发生    ❌会发生
  Repeatable Read    ✅解决     ✅解决      ❌理论上会（MySQL 基本解决了）
  Serializable       ✅解决     ✅解决      ✅解决

MySQL InnoDB 默认 Repeatable Read，通过 MVCC + 间隙锁基本解决了幻读：
  普通 SELECT（快照读）→ MVCC 读事务开始时的快照，看不到新插入的行
  SELECT FOR UPDATE（当前读）→ 间隙锁锁住范围，阻止其他事务在范围内 INSERT
```

## 三、乐观锁和悲观锁

```
【悲观锁】假设一定会冲突 → 先加锁再操作
  数据库：SELECT ... FOR UPDATE（行锁，其他事务阻塞等待）
  Java：synchronized / ReentrantLock / Redis 分布式锁
  适用：写多、冲突频繁（扣库存、转账）

  BEGIN;
  SELECT * FROM account WHERE id = 1 FOR UPDATE;  -- 加排他锁
  UPDATE account SET balance = balance - 100 WHERE id = 1;
  COMMIT;  -- 释放锁

  特点：简单可靠，但并发低、可能死锁

【乐观锁】假设不会冲突 → 不加锁，更新时检查有没有被改过
  实现方式：版本号（version）
  
  ① 查询时带出 version
  SELECT id, balance, version FROM account WHERE id = 1;  -- version=3

  ② 更新时 WHERE 带上 version
  UPDATE account SET balance=900, version=version+1 WHERE id=1 AND version=3;
  
  影响行数=1 → 成功（没人改过）
  影响行数=0 → 失败（被别人改了）→ 重试或报错

  Java 层面：CAS（AtomicInteger 等）
    boolean success = atomicInt.compareAndSet(期望值, 新值);

  MyBatis-Plus 乐观锁：
    实体类字段加 @Version → 自动在 UPDATE 中带 version 条件

  适用：读多写少、冲突不频繁（编辑文章、修改配置）

  选择口诀：
    写多冲突频繁 → 悲观锁（扣库存、转账）
    读多冲突少   → 乐观锁（编辑、配置）
```

## 四、MySQL 索引深入

### 1. 聚簇索引和非聚簇索引的区别？

```
【聚簇索引（Clustered Index）】
  叶子节点存的是整行数据
  InnoDB 的主键索引就是聚簇索引
  一张表只能有一个聚簇索引（数据只能按一种方式物理排序）

  主键 B+ 树：
    叶子节点：[id=1, name=张三, age=25, ...整行数据]
              [id=2, name=李四, age=30, ...整行数据]

【非聚簇索引（二级索引 / 辅助索引）】
  叶子节点存的是主键值（不是整行数据）
  其他所有索引都是非聚簇索引

  name 索引 B+ 树：
    叶子节点：[name=张三 → id=1]
              [name=李四 → id=2]

  查询过程（回表）：
    SELECT * FROM user WHERE name = '张三';
    ① 在 name 索引树中找到 name='张三' → 拿到 id=1
    ② 拿着 id=1 回到主键索引树查整行数据 ← 这就是"回表"

【覆盖索引（避免回表）】
  如果查询的列都在索引中，就不需要回表

  CREATE INDEX idx_name_age ON user(name, age);
  SELECT name, age FROM user WHERE name = '张三';
  → name 和 age 都在索引中 → 直接返回，不用回表 ✅

  EXPLAIN 中 Extra 列显示 "Using index" 就是覆盖索引
```

### 2. 索引失效的常见场景？

```
① 对索引列使用函数或运算
   WHERE YEAR(create_time) = 2024    ❌ 索引失效
   WHERE create_time >= '2024-01-01' ✅

② 隐式类型转换
   phone 是 varchar 类型
   WHERE phone = 13800138000          ❌ 数字，触发隐式转换
   WHERE phone = '13800138000'        ✅ 字符串

③ LIKE 左模糊
   WHERE name LIKE '%张'              ❌ 左模糊索引失效
   WHERE name LIKE '张%'              ✅ 右模糊走索引

④ OR 条件中有一个没索引
   WHERE name = '张三' OR age = 25    如果 age 没索引 → 全表扫描

⑤ 联合索引不符合最左前缀
   INDEX(a, b, c)
   WHERE a=1 AND b=2 AND c=3    ✅ 全部命中
   WHERE a=1 AND b=2            ✅ 命中 a, b
   WHERE a=1 AND c=3            ✅ 命中 a（c 跳过了 b 所以 c 用不上）
   WHERE b=2 AND c=3            ❌ 缺少最左列 a，索引失效

⑥ NOT NULL / != / NOT IN
   某些情况下优化器认为全表扫描更快，放弃索引

⑦ 数据量太小
   表只有几十行，优化器直接全表扫描
```

### 3. EXPLAIN 执行计划怎么看？

```
EXPLAIN SELECT * FROM user WHERE name = '张三';

重点关注的列：
  type（访问类型，从好到差）：
    system > const > eq_ref > ref > range > index > ALL
    
    const：通过主键或唯一索引查询（最快）
    eq_ref：JOIN 时用主键关联
    ref：普通索引等值查询
    range：索引范围查询（BETWEEN、>、<、IN）
    index：扫描整个索引树（比全表好一点）
    ALL：全表扫描 ❌（需要优化）

  key：实际使用的索引名，NULL 表示没走索引

  rows：预估扫描行数，越小越好

  Extra（额外信息）：
    Using index：覆盖索引 ✅
    Using where：需要回表后再过滤
    Using filesort：需要额外排序 ❌（考虑加索引）
    Using temporary：用了临时表 ❌（考虑优化查询）
```


---

# 四十、MySQL 锁机制

---

## 一、锁的分类

### 1. 全景图

```
按粒度分：
  表锁 → 锁整张表（MyISAM、InnoDB 都支持）
  行锁 → 只锁一行或几行（InnoDB 独有）

按类型分：
  共享锁（S 锁 / 读锁）→ 多个事务可以同时读
  排他锁（X 锁 / 写锁）→ 只有一个事务能写

按思想分：
  乐观锁 → 不加锁，更新时检查版本号
  悲观锁 → 先加锁再操作

InnoDB 行锁的三种形式（RR 隔离级别下）：
  记录锁（Record Lock）→ 锁某一行
  间隙锁（Gap Lock）→ 锁一个范围（不包含记录本身）
  临键锁（Next-Key Lock）→ 记录锁 + 间隙锁
```

---

## 二、共享锁和排他锁

### 1. S 锁和 X 锁怎么用？

```
【共享锁（S 锁 / 读锁）】
  SELECT * FROM user WHERE id = 1 LOCK IN SHARE MODE;
  多个事务可以同时加 S 锁（读读不冲突）
  但加了 S 锁后，别人不能加 X 锁（不能写）

【排他锁（X 锁 / 写锁）】
  SELECT * FROM user WHERE id = 1 FOR UPDATE;
  或 UPDATE / DELETE 自动加 X 锁
  只有一个事务能加 X 锁，别人 S 锁和 X 锁都不能加

兼容性：
            S 锁    X 锁
  S 锁      兼容     冲突
  X 锁      冲突     冲突

  读读兼容，读写冲突，写写冲突

什么时候加锁：
  普通 SELECT         → 不加锁（MVCC 快照读）
  SELECT FOR UPDATE   → X 锁（你手动要求）
  SELECT LOCK IN SHARE MODE → S 锁（你手动要求）
  UPDATE / DELETE     → X 锁（InnoDB 自动加）
  INSERT              → X 锁（InnoDB 自动加）
```

---

## 三、表锁

### 1. 有哪些表锁？

```
【显式表锁（手动，几乎不用）】
  LOCK TABLES user READ;     -- 表级读锁
  LOCK TABLES user WRITE;    -- 表级写锁
  UNLOCK TABLES;             -- 释放

【意向锁（InnoDB 自动）】
  IS（意向共享锁）→ 事务打算给某些行加 S 锁
  IX（意向排他锁）→ 事务打算给某些行加 X 锁
  作用：加表锁前快速判断有没有行锁，不用逐行检查

【自增锁（AUTO-INC Lock）】
  INSERT 自增列时自动加，分配完 ID 就释放
  MySQL 8.0 默认用轻量级互斥锁（innodb_autoinc_lock_mode=2）

【元数据锁（MDL）】★ 重要
  任何 SQL 都会自动加 MDL：
    SELECT / DML → 加 MDL 读锁
    ALTER TABLE  → 加 MDL 写锁

  长事务没提交 → ALTER TABLE 拿不到 MDL 写锁 → 等着
  后面所有查询也跟着排队 → 整个表卡死
  → 线上加字段要小心！确保没有长事务

面试简答：
  "表锁主要有意向锁（行锁的标记）、自增锁（INSERT 自增 ID）、
   MDL 元数据锁（防查询时改表结构）。
   面试最常考的是 MDL 锁导致线上 ALTER TABLE 卡住的问题。"
```

---

## 四、行锁

### 1. 记录锁、间隙锁、临键锁？

```
这三种都是 InnoDB 在 RR 隔离级别下根据索引和条件自动选择的，你不用手动指定。

假设表里有 id：1, 5, 10, 15

【记录锁（Record Lock）】
  精确锁住某一行
  触发条件：唯一索引 + 等值查询 + 记录存在
  
  SELECT * FROM t WHERE id = 5 FOR UPDATE;
  → 只锁 id=5 这一行

【间隙锁（Gap Lock）】
  锁住两个记录之间的"间隙"，不包含记录本身
  触发条件：等值查询 + 记录不存在
  目的：防止其他事务在间隙中插入数据 → 防幻读
  
  SELECT * FROM t WHERE id = 7 FOR UPDATE;
  → id=7 不存在 → 锁住间隙 (5, 10)
  → 别人不能在 5~10 之间插入

【临键锁（Next-Key Lock）】
  = 记录锁 + 间隙锁（左开右闭）
  InnoDB 默认使用临键锁
  触发条件：普通索引查询、范围查询
  
  SELECT * FROM t WHERE id >= 5 AND id < 10 FOR UPDATE;
  → 锁住 (1, 5] + (5, 10)

注意：RC 隔离级别下没有间隙锁和临键锁，只有记录锁
```

### 2. InnoDB 自动选锁规则？

```
条件                              加什么锁
──────────────────────────────────────────
唯一索引 + 等值 + 记录存在         记录锁
唯一索引 + 等值 + 记录不存在       间隙锁
普通索引 + 等值                    临键锁 + 间隙锁
范围查询                           临键锁
没有索引                           锁全表 ❌

★ 行锁加在索引上，WHERE 不走索引 → 退化成表锁！
  所以 WHERE 条件一定要走索引
```

---

## 五、死锁

### 1. 什么是死锁？怎么解决？

```
两个事务互相等对方释放锁 → 谁也不让 → 卡死

例子：
  事务 A：UPDATE user SET age=25 WHERE id = 1;  ← 锁了 id=1
  事务 B：UPDATE user SET age=30 WHERE id = 2;  ← 锁了 id=2
  事务 A：UPDATE user SET age=25 WHERE id = 2;  ← 等 B 释放
  事务 B：UPDATE user SET age=30 WHERE id = 1;  ← 等 A 释放
  → 互相等 → 死锁

InnoDB 处理：
  自动检测死锁 → 回滚代价较小的事务 → 被回滚的收到 Deadlock 报错

怎么避免：
  ① 按相同顺序访问行（先锁 id 小的再锁大的）
  ② 事务尽量短（减少持锁时间）
  ③ 给 WHERE 条件加索引（避免行锁升级为表锁）

面试简答：
  "死锁是两个事务互相等对方的锁。InnoDB 会自动检测并回滚代价小的事务。
   避免方式是按固定顺序访问资源、缩短事务、确保走索引。"
```

---

## 六、乐观锁与悲观锁

### 1. 怎么选？

```
【悲观锁】
  先锁再操作：SELECT ... FOR UPDATE → 处理业务 → COMMIT 释放
  适合：写冲突多、不想重试

【乐观锁】
  不加锁，更新时检查：
  
  方式一：版本号
    UPDATE stock SET count=9, version=4 
    WHERE sku_id = 1001 AND version = 3;
    影响行数=0 → 被别人改过了 → 重试
  
  方式二：条件更新
    UPDATE stock SET count = count - 1 
    WHERE sku_id = 1001 AND count > 0;
  
  适合：读多写少、冲突概率低

  MyBatis-Plus @Version 注解可以自动实现乐观锁：
    实体类加 @Version 字段
    updateById 时自动在 WHERE 里加 version 条件

怎么选：
  写冲突多 → 悲观锁（乐观锁一直重试反而浪费）
  读多写少 → 乐观锁（不加锁，并发好）

面试简答：
  "悲观锁用 FOR UPDATE 先锁再操作，适合写冲突多的场景。
   乐观锁用版本号或条件更新，不加锁更新时检查，适合读多写少。
   MyBatis-Plus 的 @Version 可以自动实现乐观锁。"
```

---

## 七、MVCC 和锁的关系

### 1. 两者怎么配合？

```
MVCC 解决的：读不加锁，读写不冲突
  普通 SELECT → MVCC 快照读（读历史版本）→ 不加锁 → 不阻塞

锁解决的：写写冲突必须用锁
  UPDATE / DELETE → 当前读 → 加 X 锁
  SELECT FOR UPDATE → 当前读 → 加 X 锁

两者配合：
  读用 MVCC 不阻塞 → 并发好
  写用锁保证安全 → 数据一致

面试简答：
  "MVCC 让普通读不加锁，提高并发。
   写操作和当前读还是要加锁保证一致性。
   两者配合：读用 MVCC 不阻塞，写用锁保证安全。"
```


---

# 四十一、MySQL 主从复制与 binlog

---

## 一、binlog 日志

### 1. binlog 三种模式？

```
【STATEMENT 模式】
  记录原始 SQL 语句
  优点：日志量小
  缺点：NOW()、UUID()、RAND() 等不确定函数在从库重放结果可能不同 → 主从不一致

【ROW 模式】★ 推荐（MySQL 5.7.7+ 默认）
  记录每一行数据的具体变化
  优点：精确，主从一定一致，Canal 等工具容易解析
  缺点：日志量大（一条 UPDATE 改 10 万行 → 记 10 万条变更）

【MIXED 模式】
  MySQL 自动判断：
    安全的 SQL → 用 STATEMENT（省空间）
    不安全的 SQL（NOW/UUID/RAND）→ 自动切 ROW（保准确）
  
  实际生产直接用 ROW 最稳，不用 MIXED

面试简答：
  "binlog 有 STATEMENT（记 SQL）、ROW（记行变化）、MIXED（混合）。
   MySQL 5.7+ 默认 ROW，因为最安全，主从一定一致，也方便 Canal 解析。"
```

---

## 二、主从复制

### 1. 为什么要主从复制？

```
单机 MySQL 的问题：
  ① 单点故障 → 挂了就没了
  ② 读写都在一台 → 扛不住高并发
  ③ 没有备份

主从复制解决：
  ① 高可用 → 主库挂了，从库顶上
  ② 读写分离 → 主库写，从库读
  ③ 数据备份 → 从库天然是一份备份
```

### 2. 复制流程（三线程）？

```
涉及 3 个线程：
  主库：binlog dump 线程
  从库：IO 线程 + SQL 线程

流程：
  ① 主库执行写操作 → 写入 binlog
  ② 从库 IO 线程连接主库 → 拉取 binlog → 写入 relay log（中继日志）
  ③ 从库 SQL 线程读 relay log → 重放 SQL → 数据写入从库

relay log 的作用：
  解耦 IO 线程和 SQL 线程
  网络不稳时已拉取的数据不会丢
  拉取快执行慢时起缓冲作用

binlog 不是每次发整个文件：
  从库记住上次读到的 binlog 文件名 + 偏移量
  每次只发增量部分
```

### 3. 新从库搭建完整流程？

```
【第一步：mysqldump 全量导出】
  mysqldump --single-transaction --master-data=2 -A > full.sql
  
  --single-transaction：不锁表，MVCC 快照导出
  --master-data=2：自动记录导出时刻的 binlog 位置
  
  导出文件里会有：
  -- CHANGE MASTER TO MASTER_LOG_FILE='mysql-bin.000028', MASTER_LOG_POS=15426;

【第二步：从库导入全量数据】
  mysql < full.sql

【第三步：配置增量同步】
  CHANGE MASTER TO
    MASTER_HOST='主库IP',
    MASTER_LOG_FILE='mysql-bin.000028',   ← mysqldump 记录的
    MASTER_LOG_POS=15426;                 ← mysqldump 记录的
  START SLAVE;

  之后全自动同步，不需要人工干预

  如果 binlog 已被删除（过期清理）→ MySQL 会报错拒绝同步
  → 必须重新做全量导入 → 不会出现静默数据不一致
```

### 4. 三种同步模式？

```
【异步复制（默认）】
  主库写完 binlog → 立即返回客户端 → 不等从库确认
  优点：性能最好
  缺点：主库宕机，未同步的数据丢失

【半同步复制】★ 生产推荐
  主库写完 binlog → 等至少 1 个从库确认收到 → 才返回客户端
  从库只需写入 relay log 就确认（不需要执行完）
  优点：数据更安全
  缺点：比异步稍慢
  超时降级：从库一直没确认 → 自动降级成异步

【全同步复制】
  等所有从库执行完 → 才返回
  太慢，实际不用

面试简答：
  "默认异步复制，性能好但可能丢数据。
   生产推荐半同步复制，至少一个从库确认收到才返回，更安全。"
```

### 5. GTID 复制？

```
传统复制：从库记住 binlog 文件名 + 偏移量 → 换主库要手动算位置
GTID 复制：每个事务有全局唯一 ID → 从库记住已执行的 GTID 集合

  GTID 格式：server_uuid:transaction_id
  例如：3E11FA47-...-C80AA9429562:1-100

好处：
  换主库时从库说"我执行了 GTID 1-95"
  新主库自动从 96 开始发
  → 不用算 binlog 位置，一条命令搞定

配置：
  CHANGE MASTER TO MASTER_HOST='新主库IP', MASTER_AUTO_POSITION=1;
```

### 6. 主从延迟怎么处理？

```
原因：
  ① 从库 SQL 线程单线程重放（主库可以并发写）
  ② 从库机器性能差
  ③ 大事务执行耗时
  ④ 从库还要处理读请求

查看延迟：
  SHOW SLAVE STATUS;
  → Seconds_Behind_Master = 延迟秒数

解决：
  ① MySQL 5.7+ 多线程并行复制
  ② 从库用更好的机器
  ③ 关键业务读主库
  ④ 半同步复制保证数据至少到了从库
```

---

## 三、读写分离

### 1. 怎么实现？

```
写操作 → 走主库
读操作 → 走从库

实现方式：
  ① 代码层面：MyBatis-Plus @DS("master") / @DS("slave") 动态数据源
  ② 中间件：MyCat / ShardingSphere 自动路由
  ③ 注意：刚写完立刻读可能从库还没同步到 → 关键读操作走主库

面试简答：
  "读写分离通过主从复制实现，写走主库读走从库。
   可以用动态数据源注解或 ShardingSphere 中间件自动路由。
   刚写完的关键读操作要强制走主库避免读到旧数据。"
```

---

## 四、故障切换

### 1. 主库挂了怎么办？

```
① 手动切换：DBA 手动提升从库为主库
② MHA / Orchestrator：自动检测 → 自动选从库提升 → 自动切换
③ MySQL InnoDB Cluster：官方方案，Group Replication + MySQL Router

GTID 模式下故障切换更方便：
  从库指向新主库 → MASTER_AUTO_POSITION=1 → 自动找到该从哪继续

面试简答：
  "主库故障可以手动切换或用 MHA 自动切换。
   GTID 模式下切换更方便，从库自动定位缺失的事务。
   MySQL 官方推荐 InnoDB Cluster 实现自动故障转移。"
```


---

# 四十二、MySQL 分库分表

---

## 一、为什么要分库分表

### 1. 什么时候需要？

```
单库单表扛不住的两种情况：

【数据量大】
  单表超过 500 万~1000 万行 → 查询变慢（即使有索引）
  单表超过 2000 万行 → B+ 树层数增加，IO 次数增多
  → 需要分表

【并发量大】
  单库连接数有上限（MySQL 默认 151）
  所有读写都打到一个库 → CPU / IO / 连接数瓶颈
  → 需要分库
```

---

## 二、分库分表的方式

### 1. 垂直拆分和水平拆分？

```
【垂直分库】
  按业务拆分，不同业务不同库

  原来一个库：user 表、order 表、product 表、log 表
  拆成：
    用户库：user 表
    订单库：order 表
    商品库：product 表
    日志库：log 表

  好处：业务解耦，不同库可以独立扩容
  本质：微服务拆分时自然会做的事

【垂直分表】
  把一张宽表拆成多张表（按字段拆）

  原来：user 表有 50 个字段（name, age, ..., 大段简介, 头像URL...）
  拆成：
    user（常用字段）：id, name, age, phone
    user_detail（不常用字段）：id, bio, avatar, address

  好处：常用字段单独一张表，行更小，一页能放更多行，查询更快

【水平分库】
  同一张表的数据分散到多个库

  原来：1 个库，order 表 5000 万行
  拆成：
    库 1：order 表（订单 ID % 4 == 0 的数据）
    库 2：order 表（订单 ID % 4 == 1 的数据）
    库 3：order 表（订单 ID % 4 == 2 的数据）
    库 4：order 表（订单 ID % 4 == 3 的数据）

  每个库只有 1250 万行 → 压力分散

【水平分表】
  同一个库内，一张表拆成多张结构相同的表

  原来：order 表 5000 万行
  拆成：
    order_0（订单 ID % 4 == 0）
    order_1（订单 ID % 4 == 1）
    order_2（订单 ID % 4 == 2）
    order_3（订单 ID % 4 == 3）

  好处：单表数据量小，查询快
  缺点：还是在一个库里，连接数瓶颈没解决

总结：
  数据量大 → 水平分表
  并发量大 → 水平分库
  表字段多 → 垂直分表
  业务复杂 → 垂直分库
  通常水平分库 + 水平分表一起做
```

---

## 三、分片策略

### 1. 数据路由到哪个库/表？

```
【取模法】
  库编号 = order_id % 库数量
  表编号 = order_id % 表数量

  例：order_id = 123，4 个库
    123 % 4 = 3 → 路由到库 3

  优点：简单，数据分布均匀
  缺点：扩容时要重新分配数据（从 4 个库扩到 8 个库，几乎所有数据要搬）

【范围法】
  order_id 1~1000万 → 库 1
  order_id 1000万~2000万 → 库 2
  order_id 2000万~3000万 → 库 3

  优点：扩容方便（新数据直接写新库）
  缺点：热点问题（最新的数据都在最后一个库，压力不均）

【一致性哈希】
  把哈希值组织成一个环（0 ~ 2^32-1）：
    ① 节点映射到环上：hash("库A") → 环上位置 100
    ② 数据映射到环上：hash("order:1") → 环上位置 150
    ③ 数据顺时针找最近的节点 → 存到那个节点

  扩容时：
    新增节点只影响相邻节点的一段数据
    → 只迁移 1/N 的数据（取模法要迁移几乎全部）

  数据倾斜问题：
    只有 3 个节点 → 环上只有 3 个点 → 分成 3 段
    段的长短看哈希运气 → 可能某个节点扛了 65% 的数据

  解决 → 虚拟节点：
    每个真实节点生成 100~200 个"分身"撒到环上
    例如 3 个真实节点 × 100 个虚拟节点 = 300 个点
    300 个点把环切成 300 小段 → 每段很短很均匀
    数据路由到虚拟节点 → 再映射回真实节点

  虚拟节点不会增加扩容迁移量：
    加一个新真实节点 → 它的虚拟节点插到环上各处
    每个虚拟节点只从前一个节点"切走"一小段数据
    总共切走的 ≈ 1/N（N 是扩容后节点数）→ 这已经是理论最优

  对比：
                    取模法              一致性哈希
    3→4 节点扩容    ~75% 数据要搬       ~25% 数据要搬
    4→5 节点扩容    ~80% 数据要搬       ~20% 数据要搬
    N→N+1 扩容      ~(N-1)/N 要搬       ~1/N 要搬

  虚拟节点只管"分布均不均匀"，和"搬多少数据"无关

  适用：节点经常增减的场景（分布式缓存）

实际选择：
  大多数分库分表用取模法（简单够用）
  时间序列数据用范围法（日志、订单按时间分）
  分布式缓存用一致性哈希
```

---

## 四、分库分表带来的问题

### 1. 跨库 JOIN？

```
原来一个 SQL 能 JOIN 的表现在在不同库里 → 不能 JOIN

解决：
  ① 冗余字段（把常用的关联字段冗余存一份）
  ② 应用层组装（代码里分别查两个库再合并）
  ③ 宽表（用 ES 或大宽表存聚合数据）
```

### 2. 跨库事务？

```
原来一个事务能搞定，现在跨了多个库

解决：
  ① Seata 分布式事务
  ② 最终一致性（MQ + 补偿）
  ③ 尽量让相关数据在同一个库
```

### 3. 分布式 ID？

```
自增 ID 在分库后会冲突（两个库都从 1 开始自增）

解决：
  ① 雪花算法（Snowflake）→ 全局唯一 64 位 ID ★ 推荐
     结构：1 bit 符号位 + 41 bit 时间戳 + 10 bit 机器 ID + 12 bit 序列号
     每毫秒每台机器可生成 4096 个 ID
     有序递增 → 适合做主键
  ② UUID → 无序，不适合做主键（B+ 树插入效率低）
  ③ 号段模式（如美团 Leaf）→ 批量获取 ID 段
```

### 4. 排序分页？

```
SELECT * FROM order ORDER BY create_time LIMIT 10 OFFSET 100

数据分散在多个库 → 每个库都要查 → 合并排序 → 性能差
深分页（OFFSET 很大）更严重

解决：
  ① 禁止深分页（产品层面限制）
  ② 游标分页（WHERE id > 上一页最后一个 id LIMIT 10）
  ③ 搜索走 ES
```

### 5. 聚合查询？

```
COUNT / SUM / GROUP BY 要跨所有库汇总

解决：
  ① 应用层汇总
  ② 用 ES 做聚合查询
  ③ 定时任务预计算存到汇总表
```

---

## 五、常用中间件

### 1. 用什么工具？

```
【ShardingSphere】★ 主流
  Apache 开源，支持分库分表、读写分离、分布式事务
  两种模式：
    ShardingSphere-JDBC：嵌入应用，改配置不改代码
    ShardingSphere-Proxy：独立代理，对应用完全透明

【MyCat】
  数据库中间件，独立部署
  对应用透明，应用以为连的是一个 MySQL
  社区不如 ShardingSphere 活跃

选择建议：
  新项目 → ShardingSphere-JDBC（简单，主流）
  不想改代码 → ShardingSphere-Proxy 或 MyCat
```

---

## 六、面试总结

### 1. 怎么回答分库分表？

```
"分库分表主要解决单库单表的性能瓶颈。
 垂直拆分按业务和字段拆，水平拆分按数据行拆。
 分片策略常用取模法和范围法。
 分库分表后要解决跨库 JOIN、分布式事务、分布式 ID、
 排序分页等问题。中间件主流用 ShardingSphere。

 实际决策：单表不超过 1000 万行、并发不高就不需要分库分表，
 能用读写分离解决的先用读写分离，分库分表是最后的手段。"
```


---

# 四十三、MySQL 备份恢复

---

## 一、为什么要备份

### 1. 备份的意义？

```
① 硬件故障（磁盘坏了）→ 数据全没
② 人为误操作（DROP TABLE / DELETE 忘加 WHERE）→ 数据丢了
③ 安全事故（被攻击、勒索病毒）→ 数据被破坏
④ 主从复制不是备份 → 主库误删，从库也跟着删了

备份 = 最后的保命手段
```

---

## 二、备份方式

### 1. 三种备份的本质区别？

```
                mysqldump         binlog              xtrabackup
─────────────────────────────────────────────────────────────────
本质            SQL 语句           操作变更日志         物理数据文件
记录的是        最终数据状态       每次变化过程         数据页最终状态
类比            照片               录像                 拷硬盘
支持增量        ❌                 天然就是增量         ✅（按 LSN）
多次修改同一行  只有最终值          每次都记录           只有最终页状态
恢复速度        慢（执行 SQL）     慢（逐条回放）       快（拷文件）
```

### 2. mysqldump（逻辑备份）？

```
把数据导出成 SQL 语句（CREATE TABLE + INSERT INTO ...）

全库备份：
  mysqldump -u root -p --single-transaction --master-data=2 -A > full.sql

单库备份：
  mysqldump -u root -p --single-transaction mydb > mydb.sql

单表备份：
  mysqldump -u root -p --single-transaction mydb user > user.sql

参数说明：
  --single-transaction  不锁表（InnoDB MVCC 快照导出）
  --master-data=2       记录 binlog 位置（搭从库用）
  -A                    所有库

优点：简单，SQL 可读，跨版本兼容
缺点：慢（导出成 SQL 再导入要逐条执行），大库几个小时
不支持增量备份 → 靠 binlog 充当增量
```

### 3. xtrabackup（物理备份）？

```
直接拷贝 InnoDB 数据文件（.ibd 文件）

全量备份：
  xtrabackup --backup --target-dir=/backup/full

增量备份：
  xtrabackup --backup --target-dir=/backup/inc1 --incremental-basedir=/backup/full

优点：快（直接拷文件），支持增量备份
缺点：只能恢复到同版本 MySQL，不能跨版本

★ 增量备份原理（LSN 机制）：
  InnoDB 每个数据页（16KB）有一个 LSN（Log Sequence Number）
  每次修改数据页，该页的 LSN 就涨

  全量备份时：
    页 A 的 LSN = 400
    页 B 的 LSN = 533
    页 C 的 LSN = 998
    页 D 的 LSN = 200
    → 全部拷贝，记录全局最大 LSN = 998（作为基准点）

  增量备份时：
    扫描每个页，和基准点 998 比：
      页 A：LSN 还是 400 ≤ 998 → 没改 → 跳过
      页 B：LSN 变成 1005 > 998 → 改过 → 拷贝
      页 C：LSN 变成 1200 > 998 → 改过 → 拷贝
      页 D：LSN 还是 200 ≤ 998 → 没改 → 跳过

  注意：拷贝的是整个数据页的最终状态
    一个页被修改了 100 次 → 只拷最终的 16KB → 不像 binlog 记录每次变化
```

### 4. binlog 备份？

```
binlog 记录了所有写操作的变更记录
相当于"录像"，每次 INSERT/UPDATE/DELETE 都记一条

作用：配合全量备份实现时间点恢复
  全量备份 = 某一刻的快照
  binlog = 之后所有的变化
  恢复 = 快照 + 回放 binlog = 恢复到任意时刻
```

### 5. mysqldump vs xtrabackup 怎么选？★★★

```
                    mysqldump                   xtrabackup
─────────────────────────────────────────────────────────────────
类型                逻辑备份（导出 SQL）          物理备份（拷数据文件）
备份速度            慢（逐行导出 SQL）            快（直接拷 .ibd 文件）
恢复速度            慢（逐条执行 SQL）            快（拷回文件即可）
支持增量            ❌ 不支持                    ✅ 支持（基于 LSN）
锁                 --single-transaction 不锁表   热备，不锁表
                   （InnoDB MVCC 快照）
跨版本             ✅ SQL 通用，可跨版本          ❌ 只能同版本恢复
跨引擎             ✅ 支持所有引擎               ❌ 只支持 InnoDB
文件大小            较大（SQL 文本）              较小（二进制数据）
可读性             ✅ SQL 可直接查看编辑          ❌ 二进制，不可读
适用规模            中小库（< 50GB）              大库（几百 GB ~ TB 级）
部分恢复            ✅ 可恢复单表                 ⚠️ 可以但更复杂

实际选择：
  小库（几十 GB 以内）→ mysqldump 简单够用
  大库（几百 GB 以上）→ 必须用 xtrabackup
  需要跨版本迁移     → mysqldump
  需要增量备份       → xtrabackup
  日常备份           → xtrabackup 全量 + 增量
  搭建从库           → 两者都行，大库优先 xtrabackup
```

---

## 三、恢复方式

### 1. mysqldump 恢复？

```
mysql -u root -p < full.sql
→ 就是把 SQL 重新执行一遍
→ 几十 GB 的库可能要几个小时
```

### 2. xtrabackup 恢复？★★★

```
【为什么恢复前必须先 prepare？】

  xtrabackup 是热备 → 备份期间 MySQL 还在写数据
  → 备份的数据文件中：
    ① 有些脏页已经刷盘了（数据是新的）
    ② 有些脏页还在 Buffer Pool 没刷盘（数据是旧的）
    ③ redo log 里记录了这些未刷盘的修改
  → 直接用这些文件启动 MySQL → 数据不一致 ❌

  prepare 做的事 = 崩溃恢复：
    ① 把 redo log 中已提交事务的修改应用到数据页（前滚）
    ② 把 redo log 中未提交事务的修改撤销（回滚）
    → 让数据文件达到一致状态

  类比：
    备份 = 拍了张可能模糊的照片
    prepare = 把照片修清晰
    不 prepare 就用 = 照片模糊，数据不一致

  ★ prepare 是手动执行的，不是自动的！
    忘了 prepare 直接 copy-back → 启动后数据可能损坏

【全量恢复流程】
  ① prepare：xtrabackup --prepare --target-dir=/backup/full
  ② copy-back：xtrabackup --copy-back --target-dir=/backup/full
  ③ 修改权限：chown -R mysql:mysql /var/lib/mysql
  ④ 启动 MySQL

【增量恢复流程】★ 面试常问
  假设：全量 full + 增量 inc1 + 增量 inc2

  ① 先 prepare 全量（只做 redo 前滚，不回滚未提交事务）：
     xtrabackup --prepare --apply-log-only --target-dir=/backup/full

  ② 把 inc1 合并到全量：
     xtrabackup --prepare --apply-log-only --target-dir=/backup/full \
       --incremental-dir=/backup/inc1

  ③ 把 inc2 合并到全量（最后一个增量不加 --apply-log-only）：
     xtrabackup --prepare --target-dir=/backup/full \
       --incremental-dir=/backup/inc2

  ④ copy-back + 改权限 + 启动

  为什么中间步骤要 --apply-log-only？
    不加的话会回滚未提交事务 → 后续增量可能需要这些事务的 redo log
    最后一步不加 → 做完整的前滚 + 回滚 → 数据完全一致
```

### 3. binlog 时间点恢复（PITR）？

```
场景：今天上午 10:00 有人误删了数据

  ① 先恢复昨晚的全量备份（mysqldump 或 xtrabackup）
  ② 再用 binlog 回放到 10:00 之前：
     mysqlbinlog --stop-datetime="2026-04-15 09:59:59" mysql-bin.000028 | mysql

  → 数据恢复到误删前一刻

  也可以跳过误操作继续回放：
     mysqlbinlog --stop-position=12345 mysql-bin.000028 | mysql   ← 到误操作前
     mysqlbinlog --start-position=12400 mysql-bin.000028 | mysql  ← 跳过误操作继续
```

---

## 四、备份策略

### 1. 生产怎么配？

```
【小库方案（几十 GB 以内）】
  全量：mysqldump（每周一次）
  增量：靠 binlog（mysqldump 不支持增量）
  恢复：mysqldump 导入 + binlog 回放到目标时间点

【大库方案（几百 GB ~ TB 级）】★ 推荐
  全量：xtrabackup 全量（每周一次）
  增量：xtrabackup 增量（每天一次）
  恢复：全量 + 依次合并增量 + binlog 补尾到目标时间点

【binlog 保留策略】
  expire_logs_days = 30    → binlog 保留 30 天
  全量备份周期是每周 → binlog 至少保留 7 天 + 余量

【备份验证 ★ 极其重要】
  备份不验证 = 没有备份
  定期把备份恢复到测试环境验证能不能用
  很多公司出事时才发现备份是坏的
```

---

## 五、面试总结

### 1. 怎么回答备份恢复？

```
"MySQL 备份有逻辑备份（mysqldump）和物理备份（xtrabackup）。
 mysqldump 导出 SQL 语句，简单但慢，适合中小库；
 xtrabackup 直接拷数据文件，快且支持增量（基于 LSN），适合大库。

 生产策略：
   小库用 mysqldump 全量 + binlog 增量
   大库用 xtrabackup 全量 + xtrabackup 增量 + binlog 补尾
   两者都能实现 PITR 时间点恢复。

 关键点：
 ① 备份要定期验证
 ② binlog 保留时间要覆盖全量备份周期
 ③ 误删恢复流程：全量恢复 + binlog 回放到误操作前"
```


---

# 四十四、MySQL 读写分离

---

## 一、为什么要读写分离

### 1. 解决什么问题？

```
大多数业务读多写少（读占 80%~90%）

单库问题：
  所有读写都打到一个 MySQL → CPU / IO / 连接数瓶颈

读写分离：
  主库（Master）→ 只负责写（INSERT / UPDATE / DELETE）
  从库（Slave）→ 只负责读（SELECT）
  从库可以有多个 → 读的压力分散到多台机器

  1 主 3 从：
    写 → 主库
    读 → 3 个从库轮询（负载均衡）
    → 读的吞吐量直接翻 3 倍
```

---

## 二、实现方式

### 1. 代码层面 — @DS 动态数据源？

```yaml
# application.yml
spring:
  datasource:
    dynamic:
      primary: master
      datasource:
        master:
          url: jdbc:mysql://主库:3306/mydb
        slave:
          url: jdbc:mysql://从库:3306/mydb
```

```java
@DS("master")    // 走主库
public void createOrder(Order order) { ... }

@DS("slave")     // 走从库
public Order getOrder(Long id) { ... }
```

```
也可以用 AOP 自动切换：
  @Transactional 的方法 → 自动走 master
  纯读方法 → 自动走 slave

优点：简单，代码可控
缺点：侵入代码，每个方法要标注
```

### 2. @DS 的底层原理？

```
本质：AOP + ThreadLocal + AbstractRoutingDataSource

① @DS("slave") 注解被 AOP 拦截
② 方法执行前，把 "slave" 存入 ThreadLocal
③ MyBatis 获取连接时，调用 determineCurrentLookupKey()
④ 从 ThreadLocal 读出 "slave" → 去 Map<String, DataSource> 找到从库
⑤ 返回从库连接 → 执行 SQL
⑥ 方法执行完，清掉 ThreadLocal

伪代码：
  // AOP 切面
  @Around("@annotation(ds)")
  public Object around(ProceedingJoinPoint point, DS ds) {
      DynamicDataSourceContextHolder.push(ds.value());  // 存 ThreadLocal
      try {
          return point.proceed();
      } finally {
          DynamicDataSourceContextHolder.poll();  // 清掉
      }
  }

  // 数据源路由
  public class DynamicRoutingDataSource extends AbstractRoutingDataSource {
      @Override
      protected Object determineCurrentLookupKey() {
          return DynamicDataSourceContextHolder.peek();  // 从 ThreadLocal 取
      }
  }
```

### 3. 中间件代理 — 对应用透明？

```
应用连接中间件，中间件自动判断 SQL 类型并路由：
  SELECT → 从库
  INSERT / UPDATE / DELETE → 主库

常用中间件：
  ShardingSphere-JDBC：嵌入应用（jar 包），配置即可 ★ 推荐
  ShardingSphere-Proxy：独立部署，应用以为连的是普通 MySQL
  MyCat：独立部署的数据库代理
  MySQL Router：MySQL 官方代理

优点：对应用透明，不侵入代码
缺点：多一层中间件，要运维
```

---

## 三、主从延迟导致的问题

### 1. 最大的坑？

```
写完立刻读，读到旧数据

  下单 → INSERT 到主库
  跳转订单详情 → SELECT 走从库
  → 从库还没同步到 → 查不到 → 用户以为下单失败
```

### 2. 怎么解决？

```
【方案一：强制走主库】★ 最常用
  关键读操作强制走主库

  @DS("master")   // 刚写完的关键查询，走主库
  public Order getOrderAfterCreate(Long id) { ... }

  不是运行时判断"这条数据是不是刚写的"
  而是你写代码时根据业务场景预先决定：
    写完立刻要读的 → 走主库
    对实时性要求高的（支付状态、余额）→ 走主库
    普通列表查询 → 走从库（晚几百毫秒无所谓）

【方案二：延迟读】
  写完后等一小段时间再读（Thread.sleep）
  缺点：体验差，延迟时间不好定

【方案三：判断同步状态】
  写操作后记录 binlog 位置
  读的时候查从库的同步进度（SHOW SLAVE STATUS）
  没同步到 → 走主库；同步到了 → 走从库
  缺点：每次读前多一次从库状态查询，实现复杂

【方案四：会话一致性】
  同一个会话里，写完之后的读都走主库
  下一次新会话恢复走从库

实际选择：
  大多数用方案一（关键读走主库）就够了
```

---

## 四、读写分离 vs 分库分表

### 1. 怎么选？

```
                读写分离                   分库分表
解决的问题      读的压力大                  数据量大 / 写的压力大
数据量          不变（主从数据一样）         数据拆分到多个库
复杂度          低                         高（跨库 JOIN、分布式 ID...）
什么时候用      读多写少，读压力是瓶颈       单表千万级，写并发高

优先级：
  先做读写分离（简单有效）
  读写分离扛不住了 → 再做分库分表
```

---

## 五、面试总结

### 1. 怎么回答读写分离？

```
"读写分离通过主从复制实现，主库负责写，从库负责读。
 实现方式可以用 @DS 动态数据源注解或 ShardingSphere 中间件自动路由。
 @DS 底层是 AOP + ThreadLocal + AbstractRoutingDataSource。
 最大的问题是主从延迟导致写完读不到，
 解决方案是关键读强制走主库，非关键读允许走从库。
 读写分离是性能优化的第一步，扛不住了再考虑分库分表。"
```


---

# 四十五、SQL 执行流程与 EXPLAIN 执行计划

---

## 一、一条 SQL 的执行流程

### 1. 整体架构？

```
MySQL 分两层：
  Server 层（所有引擎共享）：连接器 → 查询缓存 → 解析器 → 优化器 → 执行器
  存储引擎层（可插拔）：InnoDB / MyISAM / Memory ...
```

### 2. SELECT 的完整流程？

```
客户端
  │
  ▼
连接器（认证 + 授权）
  验证用户名密码，查询权限
  连接建立后改权限不会立刻生效，要断开重连
  │
  ▼
查询缓存（MySQL 8.0 已删除）
  以前：SQL 完全匹配才命中缓存 → 表有写操作就全部清空 → 命中率极低
  MySQL 8.0 直接废弃
  │
  ▼
解析器（词法分析 + 语法分析）
  词法分析：拆成 token（SELECT、*、FROM、user...）
  语法分析：按语法规则组装语法树，检查语法和表名列名是否存在
  │
  ▼
优化器 ★ 最重要
  选择用哪个索引（根据统计信息选代价最小的）
  决定 JOIN 顺序（不同顺序性能差别巨大）
  选择执行策略（子查询改 JOIN？全表扫描 vs 索引扫描？）
  统计信息不准 → 优化器选错 → ANALYZE TABLE 更新 或 FORCE INDEX 强制
  │
  ▼
执行器
  先做权限检查
  调用存储引擎接口逐行执行
  结果集返回客户端
  │
  ▼
存储引擎（InnoDB：Buffer Pool → 磁盘）
```

### 3. UPDATE 的额外流程？

```
UPDATE user SET name = '李四' WHERE id = 1

除了 Server 层流程外，还涉及日志：
  ① InnoDB 在 Buffer Pool 中找到数据页
  ② 修改数据（先改内存）
  ③ 写 undo log（回滚 + MVCC）
  ④ 写 redo log（prepare 状态）
  ⑤ 写 binlog
  ⑥ redo log 改为 commit → 两阶段提交完成
```

---

## 二、EXPLAIN 执行计划

### 1. 怎么用？

```sql
EXPLAIN SELECT * FROM user WHERE name = '张三' AND age = 20;
```

```
返回关键字段：
+----+-------------+-------+------+---------------+------+---------+------+------+-------------+
| id | select_type | table | type | possible_keys | key  | key_len | ref  | rows | Extra       |
```

### 2. id — 执行顺序？

```
id 相同 → 从上到下执行
id 不同 → id 大的先执行（子查询先执行）
```

### 3. select_type — 查询类型？

```
SIMPLE   → 简单查询（无子查询、无 UNION）
PRIMARY  → 最外层查询
SUBQUERY → 子查询
DERIVED  → FROM 后的子查询（派生表）
UNION    → UNION 中第二个及之后的查询
```

### 4. type — 访问类型？★★★

```
从最好到最差：
  system → const → eq_ref → ref → range → index → ALL

【const】主键/唯一索引查一条
  WHERE id = 1 → 直接定位

【eq_ref】JOIN 时被驱动表用主键/唯一索引匹配
  A JOIN B ON A.id = B.id → B 用主键精确匹配

【ref】普通索引等值查询（可能多条）
  WHERE name = '张三'（name 有普通索引）
  → 精确定位一个值，取出所有匹配行

【range】索引范围扫描
  WHERE age > 20 / BETWEEN / IN (1,2,3)
  → 扫描索引的一段范围

  ref vs range：
    ref = 等值匹配，定位一个点 → 扫描少
    range = 范围匹配，扫描一段 → 可能多

【index】全索引扫描（扫整棵索引树，不回表）

【ALL】全表扫描 → 最差 → 必须优化

口诀："至少 range，ref 以上最好，ALL 必须优化"
```

### 5. key / possible_keys — 索引选择？

```
possible_keys：优化器觉得可能用到的索引
key：实际用的索引

key = NULL → 没走索引 → 全表扫描 → 要优化
possible_keys 有但 key 是 NULL → 优化器觉得全扫更快（统计信息可能不准）
  → 可以 FORCE INDEX(idx_name) 强制
```

### 6. key_len — 联合索引用了几个字段？

```
联合索引 idx_abc(a, b, c)：
  key_len = 4    → 只用了 a（int = 4 字节）
  key_len = 8    → 用了 a + b
  key_len = 12   → 用了 a + b + c

计算：int=4, bigint=8, varchar(n)=n×字符集+2, NULL 再+1
```

### 7. rows — 预估扫描行数？

```
越小越好
rows = 1 → 精确命中
rows = 50000 → 扫 5 万行 → 需要优化
```

### 8. Extra — 额外信息？★★★

```
【好的信号】
  Using index           → 覆盖索引，不回表
    例：索引 idx(name,age)，SELECT name,age FROM user WHERE name='张三'
  Using index condition → 索引下推（ICP），在索引层提前过滤，减少回表
    例：索引 idx(name,age)，SELECT * FROM user WHERE name LIKE '张%' AND age=20
  Select tables optimized away → 直接从索引取结果（MIN/MAX）
  Using MRR             → 多范围读优化，随机IO变顺序IO

【差的信号 → 需要优化】
  Using filesort        → 额外排序（ORDER BY 没走索引）
    例：索引 idx(name)，ORDER BY create_time → 建 idx(name, create_time)
  Using temporary       → 用了临时表（GROUP BY / DISTINCT）
    例：DISTINCT city 无索引 → 给 city 建索引
  Using join buffer     → JOIN 没有可用索引 → 给 JOIN 条件字段建索引

【正常信号】
  Using where           → Server 层额外过滤
  Distinct              → DISTINCT 优化，找到第一条匹配就跳过后续
  FirstMatch            → EXISTS/IN 子查询优化为第一条匹配即返回
  Materialized          → 子查询被物化到临时表避免重复执行
  Derived               → FROM 子查询作为派生表
  Range checked for each record → 每行重新判断用哪个索引（JOIN 条件复杂）
  No tables used        → SELECT 1 / SELECT NOW() 不涉及表

总结：
  必须优化：Using filesort、Using temporary、Using join buffer
  越好越好：Using index、Using index condition、Using MRR
```

### 9. 索引下推（ICP）是什么？

```
联合索引 idx_name_age(name, age)
SELECT * FROM user WHERE name LIKE '张%' AND age = 20;

name LIKE '张%' 匹配多个不同 name → 不同 name 下 age 无序 → age 不能走索引查找
但 age 的值仍然在索引记录里

【没有 ICP】
  存储引擎找到 name LIKE '张%' 的 4 条 → 全部回表 → Server 层再用 age=20 过滤
  → 回了 4 次表，其中 2 次白回

【有 ICP（MySQL 5.6+ 默认开启）】
  存储引擎找到 name LIKE '张%' 的记录
  → 在索引层直接检查 age=20（值就在索引里）
  → 不满足的跳过不回表 → 只回 2 次表

"下推" = 把过滤条件从 Server 层（上）推到存储引擎层（下）执行
前提：字段在索引里 + 需要回表（覆盖索引不需要下推）

覆盖索引 > 索引下推 > 回表后过滤
```

### 10. ICP 的适用条件和限制？

```
【ICP 只在同一个联合索引内部生效】
  联合索引 idx(name, age) → SELECT * WHERE name LIKE '张%' AND age=20
  → name 走索引定位，age 在同一个索引里 → ICP 生效 ✅

  name 有索引 idx_name，age 有独立索引 idx_age
  → SELECT * WHERE name LIKE '张%' AND age=20
  → 走 idx_name 定位 name → age 不在这个索引里 → ICP 无法生效 ❌
  → age 的过滤只能回表后由 Server 层做

  原因：ICP 是在"一棵索引树"内部做的优化
        存储引擎遍历索引记录时，只能看到当前索引里有的字段
        如果字段不在当前索引里 → 看不到 → 没法提前过滤

【覆盖索引不需要 ICP】
  联合索引 idx(name, age)
  SELECT name, age FROM user WHERE name LIKE '张%' AND age=20
  → 查询的字段都在索引里 → 覆盖索引 → 根本不回表
  → 不存在"减少回表"的优化空间 → ICP 不参与
  → EXPLAIN Extra 显示 Using index（覆盖索引），不显示 Using index condition

【ICP 只在需要回表时才有意义】
  回表的代价：每回一次表 = 一次随机 IO
  ICP 的价值：减少无效回表次数 → 减少随机 IO
  不回表 → 没有 IO 可省 → ICP 没用武之地

总结三种情况：
  查询            索引                    结果
  SELECT *        idx(name,age)          ICP ✅（有回表，索引里有 age）
  SELECT name,age idx(name,age)          覆盖索引 ✅（不回表，不需要 ICP）
  SELECT *        idx_name + idx_age     ICP ❌（age 不在 name 的索引树里）
```

---

## 三、面试总结

### 1. 怎么回答 SQL 执行流程？

```
"一条 SQL 进入 MySQL 后，先经过连接器做认证授权，
 然后解析器做词法和语法分析，
 再由优化器选择最优执行计划（用哪个索引、JOIN 顺序），
 最后执行器调用存储引擎接口逐行执行并返回结果。
 写操作还涉及 undo log、redo log、binlog，
 通过两阶段提交保证一致性。"
```

### 2. 怎么回答 EXPLAIN？

```
"EXPLAIN 主要看三个字段：
 ① type：至少 range，ALL 必须优化
 ② key：NULL 说明没走索引
 ③ Extra：Using index 好，Using filesort 和 Using temporary 要优化
 优化思路是根据 WHERE 和 ORDER BY 建联合索引，消除 filesort。"
```

---

---

# 四十六、索引失效场景

---

## 一、违反最左前缀原则

### 1. 联合索引的使用规则？

```
联合索引 idx_abc(a, b, c)

WHERE a = 1 AND b = 2 AND c = 3  → 全部命中 ✅
WHERE a = 1 AND b = 2            → 命中 a, b ✅
WHERE a = 1                      → 命中 a ✅
WHERE a = 1 AND c = 3            → 只命中 a（跳过 b，c 走索引下推）⚠️
WHERE b = 2 AND c = 3            → 完全不走索引 ❌（缺最左的 a）
WHERE c = 3                      → 完全不走索引 ❌

注意：WHERE 条件的书写顺序不影响索引：
  WHERE c = 3 AND a = 1 AND b = 2 → 优化器自动调整 → a, b, c 全命中 ✅
  失效的是"缺字段"，不是"写反了"
```

---

## 二、范围查询后面的字段失效

### 1. 为什么范围查询会影响后面的字段？

```
联合索引 idx_abc(a, b, c)

WHERE a = 1 AND b > 10 AND c = 3
  → a 走索引 ✅ → b 走索引（range）✅ → c 失效 ❌
  → 原因：b 是范围，不同 b 值下 c 无序

WHERE a = 1 AND b = 2 AND c > 3
  → a, b, c 全走索引 ✅（c 是最后一个，范围不影响别人）

建议：把范围查询的字段放联合索引最后
```

---

## 三、对索引列使用函数或运算

### 1. 为什么函数会导致失效？

```
WHERE YEAR(create_time) = 2026   → 失效 ❌
  B+ 树里存的是 create_time 原值，不是 YEAR() 后的值 → 没法匹配
改成：
  WHERE create_time >= '2026-01-01' AND create_time < '2027-01-01' → ✅

WHERE id + 1 = 10  → 失效 ❌（对列做了运算）
改成：WHERE id = 9  → ✅

WHERE LEFT(name, 3) = '张三丰'  → 失效 ❌
改成：WHERE name LIKE '张三丰%'  → ✅
```

---

## 四、隐式类型转换

### 1. 什么情况会隐式转换？

```
phone 是 varchar，有索引：
  WHERE phone = 13800138000    → 失效 ❌
    MySQL 把 phone 转成数字比较 → 等于对列做了 CAST 函数
  WHERE phone = '13800138000'  → ✅

id 是 int：
  WHERE id = '10'              → ✅
    MySQL 把 '10' 转成 10（对常量转换，不影响索引列）

规则：MySQL 把字符串转数字，不把数字转字符串
  字符串列传数字 → 列被转换 → 失效
  数字列传字符串 → 常量被转换 → 不失效
```

---

## 五、LIKE 以 % 开头

### 1. 哪些 LIKE 走索引？

```
WHERE name LIKE '张%'   → ✅（前缀匹配）
WHERE name LIKE '%三'   → ❌（不知道从哪开始找）
WHERE name LIKE '%三%'  → ❌

需要 %三% 模糊搜索 → 用全文索引或 Elasticsearch
```

---

## 六、OR 导致失效

### 1. OR 什么时候走索引？

```
WHERE a = 1 OR b = 2
  a 有索引但 b 没有 → 整个条件失效 ❌（OR 要求两边都能走索引）
  a 和 b 都有索引 → 可能用 index_merge（效率不高）

建议用 UNION ALL 替代：
  SELECT * FROM user WHERE a = 1
  UNION ALL
  SELECT * FROM user WHERE b = 2
  → 各走各的索引
```

---

## 七、其他可能失效的场景

### 1. NOT IN / != / IS NOT NULL？

```
WHERE id NOT IN (1, 2, 3)  → 可能失效（优化器判断）
WHERE name != '张三'        → 可能失效（匹配行太多，优化器放弃）
WHERE name IS NOT NULL      → 可能失效

不是一定失效，而是优化器判断走索引不如全扫 → 主动放弃索引
```

### 2. SELECT * 的影响？

```
SELECT * → 无法覆盖索引 → 必须回表 → 优化器可能因回表代价高而放弃索引
SELECT 需要的字段 → 可能覆盖索引 → 不回表 → 更快
```

---

## 八、面试总结

### 1. 索引失效速记表？

```
场景                        是否失效    原因
───────────────────────────────────────────────
缺最左字段                   ❌ 失效    B+ 树找不到入口
范围查询后面的字段            ❌ 失效    后续字段无序
对列用函数/运算              ❌ 失效    索引值和运算后的值不匹配
隐式类型转换（字符串列传数字）❌ 失效    等于对列做了 CAST 函数
LIKE '%xxx'                 ❌ 失效    不知道从哪开始查
OR 一边没索引               ❌ 失效    必须两边都有索引
NOT IN / != / IS NOT NULL   ⚠️ 可能     优化器判断是否值得走索引
SELECT *                    ⚠️ 间接     无法覆盖索引，增加回表代价
```

---

---

# 四十七、binlog 与 redo log 两阶段提交

---

## 一、两个日志的区别

### 1. redo log 和 binlog 分别是什么？

```
                redo log                    binlog
谁的？          InnoDB 存储引擎的            Server 层的（所有引擎共享）
记什么？        物理日志：哪个数据页改了什么    逻辑日志：执行了什么 SQL / 行变更
作用            崩溃恢复（crash recovery）    主从复制 + 数据归档
写入方式        循环写（固定大小，写满覆盖）    追加写（文件不断增长）
事务相关        事务执行过程中持续写入          事务提交时一次性写入
```

---

## 二、两阶段提交

### 1. 为什么需要两阶段提交？

```
一次 UPDATE 要同时写 redo log 和 binlog
如果只写了一个崩溃了：

先写 redo log，binlog 没写：
  主库重启 → redo log 恢复了修改 → 数据变了
  从库 → binlog 没这条 → 数据没变 → 主从不一致 ❌

先写 binlog，redo log 没写：
  主库重启 → redo log 没记录 → 数据没变
  从库 → binlog 有这条 → 数据变了 → 主从不一致 ❌

→ 需要保证两个日志要么都成功，要么都失败
```

### 2. 两阶段提交的流程？

```
UPDATE user SET name = '李四' WHERE id = 1;

  ① InnoDB 修改 Buffer Pool 中的数据页
  ② 写 undo log（用于回滚）
  ③ 写 redo log → 标记为 prepare 状态（持久化到磁盘）
  ④ 写 binlog → 持久化到磁盘
  ⑤ redo log → 标记改为 commit 状态

  ───────────────────────────────────────────→
  │ redo prepare  │ binlog 落盘 │ redo commit │
  │  (阶段一)     │  (阶段二)   │  (完成)     │
  ───────────────────────────────────────────→
```

### 3. 崩溃恢复怎么判断？

```
重启后扫描 redo log 中 prepare 状态的事务：

  redo log = prepare，binlog 有对应 XID → 提交（binlog 已成功）
  redo log = prepare，binlog 没有对应 XID → 回滚（binlog 没成功）
  redo log = commit → 正常，不处理

以 binlog 是否写成功作为事务最终是否成功的判据
```

---

## 三、日志刷盘策略

### 1. redo log 和 binlog 的写入过程？

```
两个日志都是三层结构：

  redo log：redo log buffer → OS page cache → 磁盘（fsync）
  binlog：binlog cache（每线程一个）→ OS page cache → 磁盘（fsync）
```

### 2. redo log 的刷盘参数？

```
innodb_flush_log_at_trx_commit：

  = 0：每秒一次 fsync，事务提交不 fsync → 最快，崩溃最多丢 1 秒
  = 1：每次提交都 fsync → 最慢，不丢数据 ★ 默认值
  = 2：每次提交 write 到 OS cache，每秒 fsync → 折中

  安全性：1 > 2 > 0
  性能：  0 > 2 > 1
```

### 3. redo log buffer 什么时候刷盘？

```
不只是事务提交时才刷！还有其他场景：

  ① 事务提交时 → 根据 innodb_flush_log_at_trx_commit 参数决定
  ② redo log buffer 占用空间达到一半 → 自动 write 到 OS page cache
     → 注意：只是 write，不是 fsync
  ③ InnoDB 后台线程每隔 1 秒 → write + fsync 一次
     → 这就是为什么设为 0 最多丢 1 秒
  ④ MySQL 正常关闭时 → 全部 fsync
  ⑤ 其他事务提交时可能顺带刷（组提交 group commit 优化）

  所以即使 innodb_flush_log_at_trx_commit = 0：
    后台线程每秒刷一次 + buffer 半满也会刷
    → 实际上 redo log 不会在内存里积太久
```

### 4. binlog 的刷盘参数？

```
sync_binlog：

  = 0：由操作系统决定何时 fsync
  = 1：每次提交都 fsync ★ 最安全
  = N：每 N 个事务 fsync 一次

binlog cache 细节：
  每个线程有自己独立的 binlog cache（内存缓冲区）
  参数：binlog_cache_size（默认 32KB）
  事务执行过程中 → 先写到自己线程的 binlog cache
  事务提交时 → binlog cache → OS page cache（write）→ 磁盘（fsync）
  → 一个大事务如果超过 32KB → 临时溢出到磁盘临时文件
```

### 5. 生产推荐配置？

```
双1配置：
  innodb_flush_log_at_trx_commit = 1
  sync_binlog = 1

  每次事务提交的完整落盘顺序：
    ① redo log prepare → fsync 到磁盘
    ② binlog → fsync 到磁盘
    ③ redo log commit → 写入（可以不立即 fsync）
    ④ 返回 "OK" 给客户端
  → 客户端收到 OK 时，redo log 和 binlog 都已在磁盘上
  → 最慢但最安全：崩溃后主从一定一致，不丢已提交事务

  性能优化 — 组提交（Group Commit）：
    多个事务的 binlog fsync 合并成一次 → 大幅减少 fsync 次数
    MySQL 5.6+ 自动开启
    参数：binlog_group_commit_sync_delay（微秒）→ 等一小段时间攒更多事务

  设为 0 的风险：
    binlog 落盘了但 redo log 还在内存 → 崩溃后主从不一致
```

---

## 四、undo log 的写入时机

### 1. undo log 什么时候写？怎么持久化？

```
事务中每次修改数据之前写 undo log（记录旧值用于回滚和 MVCC）
undo log 存在 undo 表空间（也是数据页）→ 先写到 Buffer Pool
undo log 的修改也会记到 redo log 里 → 由 redo log 保护持久性
→ undo log 不需要自己单独 fsync

崩溃恢复：先用 redo log 恢复 → undo log 也被恢复 → 再用 undo log 回滚未提交事务
```

---

## 五、面试总结

### 1. 怎么回答两阶段提交？

```
"binlog 是 Server 层的逻辑日志，用于主从复制；
 redo log 是 InnoDB 的物理日志，用于崩溃恢复。
 两阶段提交保证两者一致：
   先写 redo log（prepare），再写 binlog，最后 redo log 改为 commit。
 崩溃时根据 binlog 是否有对应 XID 来决定提交还是回滚。
 生产用双1配置（innodb_flush_log_at_trx_commit=1 + sync_binlog=1），
 保证每次提交都落盘，不丢数据。"
```

---

---

# 四十八、Buffer Pool 与 InnoDB 存储引擎

---

## 一、Buffer Pool

### 1. Buffer Pool 是什么？

```
InnoDB 在内存中开辟的缓存区域，缓存磁盘上的数据页和索引页
磁盘 IO 毫秒级，内存纳秒级（快 10 万倍）→ 热点数据放内存 → 性能飞升

默认 128MB，生产设为物理内存的 60%~80%：
  innodb_buffer_pool_size = 8G
```

### 2. 读写怎么走 Buffer Pool？

```
【读操作】
  先看 Buffer Pool 有没有目标数据页
  有 → 直接返回（命中）
  没有 → 从磁盘加载到 Buffer Pool → 返回

【写操作】
  在 Buffer Pool 中修改数据页 → 变成"脏页"
  写 redo log 保证崩溃不丢
  脏页后台异步刷盘（不用立刻刷）
```

### 3. 脏页什么时候刷盘？

```
① redo log 写满了 → 必须刷脏页腾空间（MySQL 会卡一下）
② Buffer Pool 不够用 → 淘汰旧页，脏页先刷盘再淘汰
③ 后台线程定期刷 → 正常不影响业务
④ MySQL 正常关闭 → 全部刷盘
```

### 4. LRU 淘汰策略？

```
传统 LRU 的问题：
  ① 预读失效：预读的页没人用却放到头部 → 挤走热数据
  ② 缓冲池污染：全表扫描大量冷数据涌入 → 热数据全被淘汰

InnoDB 改进版：young-old 分区 LRU

  ┌────────────────────┬──────────────┐
  │    young 区 (63%)   │  old 区 (37%) │
  │   （热数据）         │ （冷数据）    │
  └────────────────────┴──────────────┘

  规则：
  ① 新页先进 old 区头部（不进 young 区）
     → 预读的页不会挤走热数据
  ② old 区的页要待满 1 秒后再被访问才能进 young 区
     → 全表扫描的页只被访问一次 → 间隔 < 1秒 → 留在 old 区 → 很快淘汰
     → 真正的热数据间隔 > 1秒再被访问 → 进 young 区
  ③ young 区前 1/4 被访问不移动（减少链表操作开销）
  ④ 淘汰从 old 区尾部开始

  参数：
    innodb_old_blocks_pct = 37      → old 区占比
    innodb_old_blocks_time = 1000   → old 区待多久才能进 young（毫秒）

  命中率监控：
    SHOW STATUS LIKE 'Innodb_buffer_pool_read%';
    命中率 < 99% → Buffer Pool 太小
```

### 5. Change Buffer（写缓冲）？

```
【问题】
  修改非唯一二级索引时，目标数据页可能不在 Buffer Pool
  → 要从磁盘读进来 → 一次随机 IO → 很慢

【Change Buffer 优化】
  如果目标页不在 Buffer Pool → 不立刻读磁盘
  → 把修改操作缓存到 Change Buffer
  → 下次有人读这个页时 → 从磁盘读进来 → 顺便把 Change Buffer 里的修改合并（merge）
  → 省掉了立刻读磁盘的随机 IO

  适用条件（必须同时满足）：
    ① 非唯一二级索引（唯一索引需要读页检查唯一性 → 没法延迟）
    ② 目标页不在 Buffer Pool

  参数：
    innodb_change_buffer_max_size = 25  → 最多占 Buffer Pool 的 25%
    innodb_change_buffering = all       → 对 INSERT/DELETE/UPDATE 都缓冲

  适合场景：写多读少（日志表、账单表）
  不适合场景：写完立刻读（刚写就 merge，没省到 IO）

面试简答：
  "Change Buffer 是 InnoDB 对非唯一二级索引写操作的优化，
   目标页不在内存时先缓存修改，等下次读到这个页时再合并，
   减少了写操作的随机磁盘 IO。"
```

### 6. 多 Buffer Pool 实例？

```
单个 Buffer Pool → 一把大锁 → 高并发下成为瓶颈

解决：拆成多个实例
  innodb_buffer_pool_instances = 8（建议和 CPU 核数对齐）
  前提：innodb_buffer_pool_size ≥ 1GB 才生效

  每个实例有自己独立的 LRU 链表、free 链表、flush 链表
  数据页通过 hash(space_id, page_no) 分配到某个实例
  → 多个线程操作不同实例 → 锁竞争大幅减少

生产建议：
  Buffer Pool ≥ 8GB → 设 8 个实例
  Buffer Pool ≥ 16GB → 设 16 个实例
  每个实例不小于 1GB
```

### 7. Adaptive Hash Index（自适应哈希索引）？

```
InnoDB 自动优化：
  发现某些索引值被频繁访问 → 自动在内存里建哈希索引
  B+ 树查询 O(log n) → 哈希查询 O(1)

  完全自动，不需要手动建
  参数：innodb_adaptive_hash_index = ON（默认开启）

  注意：
    高并发下哈希索引的锁可能成为瓶颈 → 可以关闭试试
    SHOW ENGINE INNODB STATUS 可以看哈希索引的使用情况
```

---

## 二、InnoDB vs MyISAM

### 1. 核心对比？

```
                    InnoDB                      MyISAM
事务              ✅ 支持                      ❌ 不支持
行锁              ✅ 行级锁                    ❌ 只有表锁
外键              ✅ 支持                      ❌ 不支持
崩溃恢复          ✅ redo log                  ❌ 可能损坏
MVCC             ✅ 支持                      ❌ 不支持
聚簇索引          ✅ 主键即数据                  ❌ 索引和数据分开
COUNT(*)         慢（逐行扫描）                快（有计数器）
存储文件          .ibd                         .MYD + .MYI
默认引擎          MySQL 5.5+ 默认               5.5 之前默认
```

### 2. 索引结构的区别？

```
【InnoDB — 聚簇索引】
  主键索引叶子节点 → 完整行数据
  二级索引叶子节点 → 主键值 → 需要回表

  主键查询：一次查找
  二级索引查询：先查二级索引拿主键 → 再回表查主键索引 → 两次查找

【MyISAM — 非聚簇索引】
  主键索引和二级索引叶子节点 → 都存数据行的磁盘地址
  数据单独存在 .MYD 文件
  → 主键和二级索引都是一次查找（直接拿地址读数据）
  → 没有"回表"概念
```

### 3. 为什么 InnoDB 的 COUNT(*) 慢？

```
MyISAM：有变量记录总行数 → COUNT(*) 直接返回 → O(1)
InnoDB：MVCC 导致不同事务看到的行数不同 → 没法维护固定计数器 → 必须逐行扫描

解决：Redis 缓存计数 / 额外计数表 / SHOW TABLE STATUS（近似值）
```

### 4. 为什么推荐自增主键？

```
InnoDB 聚簇索引 → 数据按主键顺序存储
自增 → 新数据总是插到最后 → 顺序写 → 不会页分裂
UUID → 随机插入 → 频繁页分裂 → 写性能差 + 空间浪费
```

---

## 三、面试总结

### 1. 怎么回答 Buffer Pool？

```
"Buffer Pool 是 InnoDB 的内存缓存，缓存数据页和索引页。
 读操作先查 Buffer Pool，未命中从磁盘加载。
 写操作在内存修改产生脏页，由 redo log 保证持久性，后台异步刷盘。
 淘汰策略是 young-old 分区 LRU，新页先放 old 区，
 待满 1 秒后再被访问才能进 young 区，防止全表扫描污染热数据。"
```

### 2. 怎么回答 InnoDB vs MyISAM？

```
"InnoDB 支持事务、行锁、MVCC、崩溃恢复，MyISAM 都不支持。
 InnoDB 用聚簇索引，主键叶子节点直接存数据，二级索引存主键需回表；
 MyISAM 索引和数据分离，叶子节点存地址。
 InnoDB 的 COUNT(*) 慢是因为 MVCC，推荐自增主键避免页分裂。"
```

---

---

# 四十九、大表优化

---

## 一、SQL 和索引优化（不改架构）

### 1. 索引和 SQL 层面怎么优化？

```
① 加合适的索引（联合索引 > 单列索引），用 EXPLAIN 验证
② 避免 SELECT *，只查需要的字段 → 覆盖索引
③ 避免索引失效（参考第四十六章）
```

### 2. 深分页怎么优化？

```
问题：LIMIT 1000000, 10 → 扫前 100 万行再丢弃 → 极慢

【方案一：延迟关联】
  SELECT * FROM order a
  INNER JOIN (SELECT id FROM order LIMIT 1000000, 10) b ON a.id = b.id
  → 子查询只扫索引拿 id（覆盖索引，不回表）→ 再回表 10 条

【方案二：游标分页】★ 推荐
  SELECT * FROM order WHERE id > 上次最后的id LIMIT 10
  → 直接从索引定位 → 最快
  → 前提：有连续自增 id 或能记住上次位置

【方案三：避免大事务】
  一个事务更新 100 万行 → 锁太多 → 改成分批：每次 1000 条 + COMMIT
```

---

## 二、表结构优化（小改架构）

### 1. 垂直拆分？

```
大宽表（50 个字段）→ 拆成多个窄表
  user 表：id, name, phone, age            ← 常查的
  user_ext 表：id, address, bio, avatar    ← 不常查的
  → 常查的表一页存更多行 → Buffer Pool 利用率更高
```

### 2. 冷热分离？

```
订单表 3 年 1 亿行，90% 查询只查最近 3 个月
→ 3 个月前的数据迁移到 order_archive → 主表瞬间变小

  INSERT INTO order_archive SELECT * FROM order WHERE create_time < '3个月前'
  DELETE FROM order WHERE create_time < '3个月前'
```

### 3. 分区表？

```
按时间/范围把一张表分散到多个物理文件，逻辑上还是一张表

  CREATE TABLE order (
    id BIGINT, create_time DATE, ...
  ) PARTITION BY RANGE (YEAR(create_time)) (
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027)
  );

  查 2026 年 → 只扫 p2026 分区（分区裁剪）
  局限：唯一索引必须包含分区字段，跨分区查询可能更慢
```

---

## 三、架构层优化（大改）

### 1. 从轻到重的优化顺序？

```
① SQL 和索引优化         → 零成本，立刻见效
② 深分页优化             → 改 SQL 就行
③ 垂直拆分 / 冷热分离    → 小改表结构
④ 分区表                 → 不改 SQL，改建表语句
⑤ 读写分离               → 加从库（第四十四章）
⑥ 缓存（Redis）          → 加中间件
⑦ 分库分表               → 最后手段，成本最高（第四十二章）
⑧ 搜索引擎（ES）/ 分析库 → 复杂查询 / 模糊搜索 / 大数据分析
```

---

## 四、面试总结

### 1. 怎么回答大表优化？

```
"大表优化分层处理：
 第一步先看索引和 SQL 有没有优化空间（EXPLAIN 分析、避免深分页）；
 第二步考虑冷热分离归档历史数据或分区表；
 第三步做读写分离分担读压力；
 最后实在扛不住再考虑分库分表。
 分库分表是最后手段，因为引入了跨库 JOIN、分布式事务等复杂度。"
```


# 五十、项目场景：分片查询与检索同步

## Q1：分库分表后，跨分片分页和缺少分片键的查询怎么处理？

### 结论（30 秒版）

先尽量补齐分片键，让请求路由到单库单表；确实缺少分片键时才做受控广播查询，并限制分片数量、查询字段和超时时间。跨分片分页不能简单把每个分片的前 `size` 条拼起来，而是各分片按统一稳定排序取候选集，应用层归并后再截取本页；深分页优先改成游标分页。全局唯一 ID 解决唯一性，不等于所有分片上的物理顺序严格一致。

### 查询决策

| 场景 | 处理方式 | 主要风险 |
| --- | --- | --- |
| 带完整分片键 | 精确路由到目标分片 | 最优，但调用方必须携带可信分片键 |
| 只带部分条件 | 根据可推导条件缩小分片范围 | 需要验证路由规则和数据权限 |
| 完全没有分片键 | 受控广播，分片并行查询后归并 | 放大数据库压力，必须限流和超时 |
| 深分页 | 游标/`search_after`/离线导出 | 不能无限增加 `OFFSET` 或跨分片扫描 |

### 跨分片分页

假设每个分片按 `created_at DESC, id DESC` 排序：

1. 向目标分片并行查询候选数据，候选量应覆盖当前偏移和页面大小；数据量较大时改用游标，避免每页重复扫描大量历史行。
2. 在应用层使用同一比较器按 `created_at` 和 `id` 归并，`id` 作为并列时的稳定 tie-breaker。
3. 归并后截取本页，并返回下一页游标；不能把各分片结果直接拼接，否则全局顺序错误。
4. 总数统计要明确是精确值还是近似值；精确 `COUNT` 需要并行查询各分片后求和，且要处理查询期间的数据变化。

```java
// 各分片返回同一排序规则的候选集，应用层归并后再取本页。
List<Order> candidates = queryEachShard(shardTargets, cursor, limitPerShard);
candidates.sort(Comparator
    .comparing(Order::getCreatedAt).reversed()
    .thenComparing(Order::getId).reversed());
return candidates.stream().limit(pageSize).toList();
```

代码示例只表达归并原则；生产实现还要限制候选集大小，处理重复数据、空分片、超时分片和取消请求。

### 缺少分片键的边界

- 广播查询只能用于低频、可控的后台或明确的读场景，不能让所有列表接口默认广播。
- 广播查询要设置并发上限、单分片超时、总超时和结果上限，部分分片失败时要定义是整体失败还是返回降级结果。
- 需要跨分片聚合、模糊检索和复杂排序时，优先建立面向查询的索引或汇总模型，不要长期把数据库当搜索引擎。
- 分片键来自请求时还要做数据权限校验，不能因为用户可修改分片键就访问其他租户数据。

### 常见追问

- Q：Snowflake ID 趋势递增后，能不能直接按 ID 做全局分页？
  A：它通常具有趋势递增特征，但受时钟回拨、机器号和分片写入时序影响，不能把它当作严格的全局时间序列；若业务排序按时间，应使用时间字段加 ID 的稳定游标。
- Q：为什么不直接把所有分片结果查出来再排序？
  A：会造成内存、网络和数据库压力随分片数及偏移增长；应在分片侧先过滤、排序、限制候选量，再做有界归并。

## Q2：为什么用 CDC/Canal 同步搜索索引，如何处理乱序、失败和重建？

### 结论（30 秒版）

业务代码同时写数据库和搜索引擎时，任一写入失败都会产生双写不一致。更稳妥的边界是关系库作为事实源，由 binlog CDC（如 Canal）捕获变更，经过消息队列异步投递给索引消费者；消费者使用业务主键和版本号做幂等更新与乱序保护，失败进入重试/死信并支持补偿，索引重建采用全量快照、增量位点衔接和别名切换。

### 同步链路

~~~plantuml
@startuml
title 关系库到搜索索引的 CDC 同步链路
database "关系库" as DB
participant "binlog CDC" as CDC
queue "消息队列" as MQ
participant "索引消费者" as Consumer
database "搜索索引" as ES
participant "校验/补偿任务" as Repair

DB -> CDC : 提交事务并产生 binlog
CDC -> MQ : 发送变更事件
MQ -> Consumer : 至少一次投递
Consumer -> Consumer : 主键幂等 + version 比较
Consumer -> ES : upsert / delete
Consumer -> MQ : 成功 ACK 或进入重试
Repair -> DB : 抽样/全量校验事实
Repair -> ES : 修复差异
@enduml
~~~

事件至少包含：实体主键、操作类型、业务版本或可比较序列、事件 ID、发生时间和必要的字段快照。只传“重新查询主键”时，要考虑删除事件、历史版本被覆盖和回源时序问题。

### 一致性与失败处理

- **幂等**：索引写入使用 `upsert` 或等价的幂等写，事件 ID 可用于消费去重，但不能替代实体版本判断。
- **乱序**：以业务版本、数据库变更序列或可靠的单调版本比较，旧版本事件到达时丢弃；不要只按消费者收到的时间判断新旧。
- **删除**：删除事件也必须携带可比较版本，避免旧的更新事件在删除后又把文档写回来。
- **重试**：网络故障和索引临时不可用可延迟重试；mapping 错误、字段类型错误等永久问题进入死信并告警。
- **回源边界**：搜索索引适合列表过滤和排序，强一致状态、权限和大字段按需回源关系库或通过版本校验。

### 全量重建与增量衔接

1. 记录增量消费位点或建立可比较的快照边界。
2. 按主键范围或时间分片读取关系库，批量写入新索引，控制并发和背压。
3. 持续消费快照边界之后的增量事件，必要时对快照期间的变更按版本重放。
4. 完成数量、抽样字段、删除数据和版本校验后，通过别名原子切换新索引。
5. 保留旧索引和回滚窗口，稳定后再清理，删除前确认没有未消费位点。

### 常见追问

- Q：为什么不继续业务双写？
  A：双写简单但一致性责任分散在每个业务入口，漏写、部分成功和异常重试都容易产生差异；CDC 让数据库事实变更统一进入同步链路，但仍需要重试、对账和监控。
- Q：CDC 丢消息怎么办？
  A：持久化位点并监控位点延迟，消费失败进入可重放队列；通过定期全量/增量对账发现差异，必要时按主键补建，不能只依赖实时链路。
- Q：ES version 为什么不直接用消息时间？
  A：消息到达时间不代表数据库提交顺序，网络和重试会乱序；应使用数据库变更版本、CDC 位点或业务单调版本，并明确跨分片的可比范围。

