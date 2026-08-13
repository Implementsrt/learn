# 七、Redis

## 项目场景提炼索引

- Q1：同一个系统中，锁、限流、缓存、幂等、布隆过滤器分别怎么选？
- Q2：短链如何生成、存储和防止缓存穿透？

## 1. Redis 数据类型及使用场景？

| 类型 | 底层结构 | 使用场景 |
|------|---------|---------|
| String | SDS | 缓存、计数器、分布式锁、Session |
| Hash | 哈希表/ziplist | 对象属性存储（用户信息） |
| List | 双向链表/ziplist | 消息队列、最新列表 |
| Set | 哈希表/intset | 去重、交集并集（共同好友） |
| ZSet（Sorted Set） | 跳表+哈希表 | 排行榜、延时队列 |
| Bitmap | String | 签到、在线状态 |
| HyperLogLog | 概率算法 | UV 统计（允许误差） |

---

## 2. 缓存穿透、缓存击穿、缓存雪崩？

```
┌─────────────────────────────────────────────────────────────────┐
│ 缓存穿透：查询一个不存在的数据，缓存和数据库都没有                    │
│                                                                   │
│   请求 key="-1" → 缓存没有 → 数据库没有 → 每次都打到数据库          │
│                                                                   │
│   解决：                                                          │
│   ① 缓存空值（key → null，设短 TTL）                              │
│   ② 布隆过滤器（请求前先判断 key 是否可能存在）                     │
│   ③ 参数校验（拦截非法 ID）                                       │
├─────────────────────────────────────────────────────────────────┤
│ 缓存击穿：热点 key 过期的瞬间，大量并发请求同时打到数据库             │
│                                                                   │
│   热点 key 过期 → 1000 个请求同时查数据库 → 数据库压力暴增           │
│                                                                   │
│   解决：                                                          │
│   ① 互斥锁：只让一个线程查数据库，其他等待                          │
│   ② 热点 key 永不过期（后台异步更新）                              │
│   ③ 逻辑过期：值中存过期时间，发现过期则异步更新                     │
├─────────────────────────────────────────────────────────────────┤
│ 缓存雪崩：大量 key 同时过期 或 Redis 宕机                          │
│                                                                   │
│   大面积缓存失效 → 请求全部打到数据库 → 数据库崩溃                   │
│                                                                   │
│   解决：                                                          │
│   ① 过期时间加随机值，避免同时过期                                  │
│   ② Redis 集群 + 哨兵，保证高可用                                  │
│   ③ 限流降级                                                     │
│   ④ 多级缓存（本地缓存 + Redis）                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Redis 持久化：RDB vs AOF？

| 对比 | RDB（快照） | AOF（追加日志） |
|------|------------|----------------|
| 方式 | 某一时刻的全量快照 | 记录每条写命令 |
| 触发 | save/bgsave/自动 | 每秒/每命令/手动 |
| 恢复速度 | 快（直接加载二进制） | 慢（重放所有命令） |
| 数据安全 | 可能丢失最后一次快照后的数据 | 最多丢 1 秒数据 |
| 文件大小 | 小（压缩的二进制） | 大（可用 rewrite 压缩） |
| 推荐 | 备份、冷备 | 数据安全要求高的场景 |

**Redis 4.0+：** 混合持久化，RDB + AOF 结合使用。

---

## 4. Redis 分布式锁？

```java
// 加锁：SET key value NX EX 30
// NX = 不存在才设置（原子操作）
// EX 30 = 30秒过期（防死锁）
Boolean locked = redis.opsForValue()
    .setIfAbsent("lock:order:123", requestId, 30, TimeUnit.SECONDS);

// 释放锁（Lua 脚本保证原子性）
// 必须判断是不是自己的锁，防止误删别人的锁
String script = 
    "if redis.call('get',KEYS[1]) == ARGV[1] then " +
    "  return redis.call('del',KEYS[1]) " +
    "else return 0 end";
redis.execute(script, "lock:order:123", requestId);
```

**问题与优化：**
- 锁过期了业务没执行完 → Redisson 看门狗（自动续期）
- Redis 主从切换锁丢失 → RedLock（多节点加锁）

---

## 5. Redis 内存淘汰策略？

| 策略 | 说明 |
|------|------|
| noeviction | 内存满了直接报错（默认） |
| allkeys-lru | 所有 key 中淘汰最近最少使用的 |
| volatile-lru | 有过期时间的 key 中淘汰 LRU |
| allkeys-random | 随机淘汰 |
| volatile-random | 有过期时间的 key 中随机淘汰 |
| volatile-ttl | 淘汰 TTL 最短的 |
| allkeys-lfu | 所有 key 中淘汰最不经常使用的（Redis 4.0+） |
| volatile-lfu | 有过期时间的 key 中淘汰 LFU |

**推荐：** 缓存场景用 `allkeys-lru`。


---

# 二十、Redis 补充

## 1. Redis 单线程为什么这么快？

```
① 纯内存操作：数据在内存中，读写纳秒级
② 单线程避免锁竞争和上下文切换
③ IO 多路复用（epoll）：一个线程处理大量连接
④ 高效的数据结构：SDS、跳表、压缩列表等
⑤ 简单的协议：RESP 协议，解析快

注意：Redis 6.0 引入了多线程 IO（读写网络数据），但命令执行仍然是单线程。
```

---

## 2. Redis 集群模式

```
三种模式：

① 主从复制（Replication）
   主节点写，从节点读
   从节点异步复制主节点数据
   问题：主节点挂了需要手动切换

② 哨兵模式（Sentinel）
   在主从基础上增加哨兵进程
   哨兵监控主节点，主节点挂了自动选举新主节点
   客户端通过哨兵获取当前主节点地址
   
   ┌──────────┐
   │ Sentinel1 │──监控──► Master ◄──── Slave1
   │ Sentinel2 │──监控──►        ◄──── Slave2
   │ Sentinel3 │──监控──►        ◄──── Slave3
   └──────────┘
   主节点挂了 → 哨兵投票 → 选举 Slave1 为新 Master

③ Cluster 集群（推荐）
   数据分片：16384 个槽（slot）分配到不同节点
   每个节点负责一部分 slot
   每个节点都有从节点做备份
   
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Master A  │  │ Master B  │  │ Master C  │
   │ slot 0-5460│  │5461-10922│  │10923-16383│
   │ ↕         │  │ ↕         │  │ ↕         │
   │ Slave A   │  │ Slave B   │  │ Slave C   │
   └──────────┘  └──────────┘  └──────────┘
   
   key 分配：CRC16(key) % 16384 = slot 编号 → 找到对应节点
```

---

## 3. 热 Key 和大 Key 问题

```
热 Key（Hot Key）：
  某个 key 被大量访问（如热门商品、明星微博）
  → 单个 Redis 节点压力过大
  
  解决：
  ① 本地缓存（Caffeine / Guava Cache）
  ② key 拆分：key_1, key_2, key_3 随机读
  ③ 读写分离

大 Key（Big Key）：
  某个 key 的 value 过大（如 Hash 有几百万个 field）
  → 操作耗时、网络传输慢、内存不均
  
  发现：redis-cli --bigkeys / MEMORY USAGE key
  
  解决：
  ① 拆分：user:1:basic, user:1:detail
  ② 压缩 value
  ③ 异步删除：UNLINK（非阻塞删除）
```

---

## 4. Redis 事务和 Lua 脚本

```
Redis 事务（MULTI/EXEC）：
  MULTI       开启事务
  SET k1 v1   入队
  SET k2 v2   入队
  EXEC        执行

  注意：Redis 事务不支持回滚！
  语法错误 → 整个事务不执行
  运行时错误 → 错误命令失败，其他命令正常执行

  实际开发中更多用 Lua 脚本代替事务（原子性更好）：

// Lua 脚本：原子操作（单线程执行，不会被打断）
// 示例：扣减库存
String script = 
    "local stock = redis.call('get', KEYS[1]) " +
    "if tonumber(stock) > 0 then " +
    "  redis.call('decr', KEYS[1]) " +
    "  return 1 " +
    "else " +
    "  return 0 " +
    "end";

Long result = redis.execute(script, Collections.singletonList("stock:1001"));
```

---

## 5. 缓存与数据库一致性方案

```
方案一：Cache Aside（旁路缓存）— 最常用
  读：先读缓存 → 命中则返回 → 没命中则读 DB → 写入缓存
  写：先更新 DB → 再删缓存

方案二：延时双删
  写：删缓存 → 更新 DB → 延时500ms → 再删缓存
  （详见之前的延时双删讲解）

方案三：订阅 binlog
  写：只更新 DB
  Canal 监听 MySQL binlog → 异步更新/删除缓存
  优点：与业务代码完全解耦
  缺点：架构复杂

┌──────────┐   binlog   ┌────────┐   更新缓存   ┌────────┐
│  MySQL   │──────────►│ Canal  │──────────────►│ Redis  │
└──────────┘           └────────┘              └────────┘
```


---

# 二十五、Redis 深入面试题

---

## 一、Redis 内存淘汰策略

### 1. Redis 有哪些内存淘汰策略？

```
当 Redis 内存满了，新数据写不进去，就需要淘汰策略决定删掉谁。
配置：maxmemory-policy <策略名>

共 8 种（Redis 4.0 之后）：

【不淘汰】
① noeviction（默认）：内存满了直接报 OOM 错误，不删任何 key

【从设置了过期时间的 key 中淘汰】
② volatile-lru：     最近最少使用（LRU）
③ volatile-lfu：     最不经常使用（LFU）← Redis 4.0 新增
④ volatile-ttl：     即将过期的优先淘汰（TTL 最小的）
⑤ volatile-random：  随机淘汰

【从所有 key 中淘汰】
⑥ allkeys-lru：      最近最少使用（LRU）★ 最常用
⑦ allkeys-lfu：      最不经常使用（LFU）← Redis 4.0 新增
⑧ allkeys-random：   随机淘汰

选择建议：
  有明显冷热数据（缓存场景）         → allkeys-lru（最常用）
  有偶尔全量扫描导致冷数据挤掉热数据   → allkeys-lfu
  所有 key 都设了过期时间            → volatile-lru / volatile-ttl
  不允许丢数据                      → noeviction
```

### 2. Redis 的 LRU 是怎么实现的？（不是精确 LRU）

```
精确 LRU 用双向链表 + HashMap：
  每次访问 → 移到链表头部
  淘汰时 → 删链表尾部
  问题：每个 key 多两个指针（prev + next）= 16 字节
       Redis 几千万个 key → 额外浪费几百 MB 内存

Redis 的近似 LRU：
  每个 key 的 redisObject 中有一个 24 bit 的 lru 字段，记录最后访问时间（秒级）

  typedef struct redisObject {
      unsigned type:4;
      unsigned encoding:4;
      unsigned lru:24;       // ★ 最后一次访问的时间戳
      int refcount;
      void *ptr;
  } robj;

  淘汰流程：
  ① 随机采样 N 个 key（N = maxmemory-samples，默认 5）
  ② 比较这 N 个 key 的 lru 字段
  ③ 淘汰 lru 值最小的（最久没访问的）
  ④ 内存还不够就重复以上步骤

  maxmemory-samples 越大越精确：
    samples=5  → 接近精确 LRU（默认，性价比最高）
    samples=10 → 非常接近精确 LRU
    samples=1  → 基本就是随机淘汰
```

### 3. Redis 的 LFU 是怎么实现的？

```
LFU（Least Frequently Used）按访问频率淘汰，Redis 4.0 新增。

复用同一个 24 bit lru 字段，但含义变了：
  ┌─── 16 bit ───┬─── 8 bit ───┐
  │  ldt (时间)    │  counter    │
  │  上次衰减时间   │  访问频率    │
  └──────────────┴─────────────┘

【counter 概率递增（对数增长）】
  不是每次访问 +1，而是概率 +1，counter 越大加的概率越小：
    p = 1.0 / (counter * lfu_log_factor + 1)
    if (random() < p) counter++

  lfu_log_factor 默认 10 时：
    访问 1 次       → counter ≈ 1
    访问 100 次     → counter ≈ 18
    访问 10000 次   → counter ≈ 37
    访问 100 万次   → counter ≈ 55
  8 bit（最大 255）完全够用

【counter 时间衰减】
  防止历史热 key 永远不被淘汰：
    每次访问时检查距离上次衰减过了几分钟
    counter = counter - (elapsed_minutes / lfu_decay_time)
    lfu_decay_time 默认 1 → 每过 1 分钟 counter 减 1

  示例：counter=50 的 key 停止访问 30 分钟 → counter = 50-30 = 20

【淘汰流程】
  ① 随机采样 N 个 key
  ② 对每个 key 先做衰减，再比较 counter
  ③ 淘汰 counter 最小的

【LRU vs LFU】
  LRU 的问题：大量冷数据被扫了一遍 → 刷新了访问时间 → 热数据反而被淘汰
  LFU 的优势：冷数据即使被扫一遍，频率还是低，不会挤掉热数据
```

---

## 二、Redis 内存碎片

### 1. 什么是内存碎片？怎么处理？

```
Redis 使用内存分配器（jemalloc）分配内存
分配器按固定大小的块分配：8B、16B、32B、48B、64B ...

  存 41 字节 → 分配 48 字节 → 浪费 7 字节 → 内部碎片
  频繁创建/删除不同大小的 key → 内存出现空洞 → 外部碎片

查看碎片率：
  INFO memory
  → mem_fragmentation_ratio = used_memory_rss / used_memory

  = 1.0~1.5 → 正常
  > 1.5     → 碎片较多，需要处理
  < 1.0     → Redis 用了 swap，性能严重下降 ❌

处理方式：
  ① 重启 Redis → 数据从 RDB/AOF 重新加载 → 碎片消除（简单粗暴）
  ② Redis 4.0+ 在线碎片整理（不用重启）：
     config set activedefrag yes
     
     相关参数：
       active-defrag-threshold-lower 10   → 碎片率 > 10% 开始整理
       active-defrag-threshold-upper 100  → 碎片率 > 100% 全力整理
       active-defrag-cycle-min 1          → 整理占 CPU 最小百分比
       active-defrag-cycle-max 25         → 整理占 CPU 最大百分比

  原理：jemalloc 把数据从碎片化的内存区域搬到连续区域 → 释放空洞

面试简答：
  "Redis 内存碎片可以通过 INFO memory 查看 mem_fragmentation_ratio，
   大于 1.5 就需要处理。Redis 4.0+ 支持在线碎片整理 activedefrag，
   不需要重启就能整理碎片。"
```

---

## 三、Redis 哨兵与分片集群

### 1. Redis 哨兵（Sentinel）的作用？

```
核心作用：主从架构下的自动故障转移

没有哨兵：
  Master 挂了 → 手动把 Slave 提升为 Master → 手动改配置 → 期间服务不可用

有哨兵（一般 3 个，奇数）：
  Sentinel1    Sentinel2    Sentinel3
      │            │            │
      └────────────┼────────────┘ 监控
                   ▼
  Master ──复制──→ Slave1 / Slave2

三大功能：
① 监控（Monitoring）
   每隔 1 秒向 Master/Slave 发 PING
   一个哨兵认为挂了 → "主观下线"
   多个哨兵都认为挂了 → "客观下线"

② 故障转移（Failover）
   哨兵之间选出一个 Leader（Raft 算法）
   Leader 从 Slave 中选一个提升为新 Master
   选择标准：优先级 > 复制偏移量最大（数据最新）> ID 最小
   让其他 Slave 复制新 Master

③ 通知（Notification）
   通知客户端新 Master 的地址，客户端自动切换连接
```

### 2. 分片集群的槽位为什么是 16384？

```
Redis Cluster 把数据分成 16384 个槽（slot），编号 0~16383
每个 key 通过 CRC16(key) % 16384 算出属于哪个槽
每个 Master 节点负责一部分槽

为什么是 16384？Redis 作者 antirez 亲自解释过：

① 心跳包大小（核心原因）
   节点之间每秒发送 PING/PONG 心跳，携带一个 bitmap 标记"我负责哪些槽"
   bitmap 大小 = 槽数量 / 8
   16384 个槽 → bitmap = 16384 / 8 = 2KB ✅
   65536 个槽 → bitmap = 65536 / 8 = 8KB ❌ 心跳包太大

② 集群规模
   Redis 建议最多 1000 个节点
   16384 / 1000 = 每节点至少 16 个槽 → 粒度足够

③ 计算效率
   16384 = 2^14，CRC16 取模等价于取低 14 位（& 0x3FFF），位运算快
```


---

# 三十三、Redis 持久化与分布式锁

---

## 一、Redis 持久化

### 1. RDB 和 AOF 的区别？

```
【RDB（Redis Database）】
  定时对内存数据做快照，生成 dump.rdb 文件
  
  触发方式：
    手动：SAVE（阻塞）/ BGSAVE（fork 子进程，不阻塞）
    自动：配置 save 60 10000（60 秒内改了 10000 次就触发）
  
  优点：
    ① 文件紧凑，恢复速度快
    ② 适合备份和灾难恢复
  缺点：
    ① 两次快照之间的数据可能丢失
    ② fork 子进程时大内存会有短暂卡顿

【AOF（Append Only File）】
  每次写操作都追加到 appendonly.aof 文件
  
  同步策略：
    always：  每次写操作都同步到磁盘 → 最安全，性能最差
    everysec：每秒同步一次（默认）→ 最多丢 1 秒数据 ★
    no：      由操作系统决定何时同步 → 性能最好，可能丢较多数据
  
  AOF 重写（Rewrite）：
    AOF 文件会越来越大 → 触发重写 → 用最少的命令重建当前数据
    例：对同一个 key 做了 100 次 SET → 重写后只保留最后一条
  
  优点：数据安全性高
  缺点：文件大，恢复慢

【混合持久化】（Redis 4.0+，推荐）
  AOF 重写时把 RDB 格式的数据写在 AOF 文件前面
  → 恢复时先加载 RDB 部分（快），再重放 AOF 部分（全）
  → 兼顾恢复速度和数据安全

实际项目：一般 RDB + AOF 都开启，AOF 用 everysec 策略
```

### 2. RDB 和 AOF 都开启时，Redis 重启加载哪个？

```
优先加载 AOF！

  启动时判断流程：
    AOF 开启？
      是 → 加载 AOF 文件（数据更完整）
      否 → 加载 RDB 文件
  
  为什么优先 AOF？
    RDB 是定时快照 → 两次快照之间的数据可能丢失
    AOF 是实时追加 → 丢的数据更少（最多 1 秒）
    → AOF 的数据更全 → 优先用 AOF

  混合持久化（Redis 4.0+）：
    AOF 文件前半段是 RDB 格式，后半段是 AOF 命令
    加载时：先快速加载 RDB 部分 → 再回放 AOF 部分
    → 速度快 + 数据全
```

### 3. AOF 重写的详细流程？

```
为什么要重写？
  AOF 记录每条写命令 → 文件越来越大
  SET name "张三" → SET name "李四" → SET name "王五"
  → 重写后只保留最终的 SET name "王五"

触发条件（自动）：
  auto-aof-rewrite-min-size 64mb        → AOF 文件至少 64MB 才考虑重写
  auto-aof-rewrite-percentage 100       → AOF 文件比上次重写后增长了 100% 触发

重写流程（BGREWRITEAOF）：
  ① 主进程 fork 子进程（和 RDB 的 BGSAVE 一样用 COW）
  ② 子进程遍历内存数据 → 用最少的命令写到新 AOF 临时文件
  ③ 主进程继续处理客户端请求 → 新的写命令同时追加到：
     a. 旧 AOF 文件（保证重写期间崩溃不丢数据）
     b. AOF 重写缓冲区（记录重写期间的增量）
  ④ 子进程写完 → 通知主进程
  ⑤ 主进程把 AOF 重写缓冲区的增量追加到新 AOF 文件
  ⑥ 用新 AOF 文件替换旧 AOF 文件（原子 rename）

  关键点：
    fork 瞬间会短暂阻塞 → 内存越大阻塞越久
    COW（写时复制）→ 主进程写数据时才复制内存页
    重写不是分析旧 AOF 文件 → 而是直接读内存生成
```

### 4. RDB vs AOF 对比表？

```
                    RDB                         AOF
─────────────────────────────────────────────────────────────
持久化方式         定时全量快照                   实时追加写命令
文件格式           二进制（紧凑）                 文本命令（可读）
文件大小           小                           大（重写后会缩小）
恢复速度           快（直接加载二进制）            慢（逐条回放命令）
数据安全           可能丢两次快照间的数据          最多丢 1 秒（everysec）
fork 影响          BGSAVE 时 fork               BGREWRITEAOF 时 fork
对性能影响         fork 瞬间阻塞                 everysec 每秒 fsync
适合场景           备份、灾难恢复、数据不太敏感    数据安全要求高
```

## 二、Redis 分布式锁

### 1. Redis 分布式锁怎么实现？

```
最简单的版本：
  SET lock_key unique_value NX EX 30
  
  NX：key 不存在才设置（保证互斥）
  EX 30：30 秒过期（防止死锁）
  unique_value：每个客户端唯一标识（释放时校验是不是自己的锁）

释放锁（Lua 脚本保证原子性）：
  if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
  else
      return 0
  end

  为什么用 Lua？
  → GET 和 DEL 要原子执行
  → 不用 Lua 的话：GET 判断是自己的 → 还没 DEL 就过期了 → 别人拿到锁 → 你把别人的锁 DEL 了
```

### 2. Redisson 分布式锁的优势？

```
Redisson 是 Redis 的 Java 客户端，封装了分布式锁的最佳实践。

RLock lock = redissonClient.getLock("order:lock:" + orderId);
try {
    boolean acquired = lock.tryLock(5, 30, TimeUnit.SECONDS);
    // 等待 5 秒，锁过期 30 秒
    if (acquired) {
        // 业务代码
    }
} finally {
    lock.unlock();
}

Redisson 解决了手动实现的几个问题：

① 锁续期（看门狗 Watchdog）★
   默认锁过期 30 秒
   后台启动一个 Watchdog 线程，每 10 秒检查一次
   如果业务还没执行完 → 自动续期到 30 秒
   避免了"业务没执行完锁就过期了"的问题
   注意：只有没设置过期时间时 Watchdog 才生效

② 可重入锁
   同一个线程可以多次获取同一把锁
   用 Redis Hash 结构：key=锁名，field=线程标识，value=重入次数

③ 锁释放的安全性
   内部用 Lua 脚本保证判断和删除的原子性

④ 阻塞等待
   tryLock 支持等待时间，内部用 Redis 的发布订阅机制
   锁释放时发布消息 → 等待的线程收到通知去竞争
```

### 3. Redis 分布式锁在主从架构下的问题？

```
问题场景：
  ① 客户端 A 在 Master 上加锁成功
  ② Master 还没把锁同步给 Slave 就挂了
  ③ Slave 提升为新 Master → 新 Master 上没有这把锁
  ④ 客户端 B 在新 Master 上也加锁成功
  → 两个客户端同时持有锁 ❌

解决方案：RedLock（Redis 作者提出）
  部署多个独立的 Redis 实例（奇数个，如 5 个）
  加锁时向所有实例发送加锁请求
  超过半数（3/5）加锁成功 → 认为加锁成功
  
  但 RedLock 有争议（Martin Kleppmann 质疑过），
  实际项目中如果对一致性要求极高，建议用 ZooKeeper 分布式锁
```


---

# 三十六、Redis 缓存一致性与高可用

---

## 一、缓存与数据库双写一致性

### 1. 旁路缓存 Cache Aside 模式？

```
最常用的缓存模式，读写流程由应用自己控制：

【读流程】
  ① 先查 Redis → 命中直接返回
  ② 未命中 → 查数据库
  ③ 查到后写回 Redis
  ④ 返回结果

【写流程】
  ① 先更新数据库
  ② 再删除缓存（不是更新缓存）

为什么是"删缓存"而不是"更新缓存"？
  ① 缓存可能是多表联合计算的结果，更新逻辑复杂
  ② 写多读少时，频繁更新缓存是浪费（可能更新了但没人读）
  ③ 删除更简单，下次读到时再重建

为什么不是"先删缓存再更新数据库"？
  并发场景会出问题：
    线程 A：删缓存
    线程 B：读缓存未命中 → 查库得到旧值 → 写回缓存
    线程 A：更新数据库为新值
    → 结果：缓存是旧值，数据库是新值 ❌

"先更新数据库再删缓存"也有小概率问题：
    线程 A：查库得到旧值（缓存刚好过期）
    线程 B：更新数据库 → 删缓存
    线程 A：把旧值写回缓存
    → 但这个概率极低（读比写快得多，几乎不会发生）

延时双删（进一步保障）：
    ① 先删缓存
    ② 更新数据库
    ③ sleep 一小段时间（如 500ms）
    ④ 再删一次缓存
    → 第二次删除清掉可能被回填的脏数据
    → 缺点：延迟时间不好定，实际用得不多

面试简答：
  "Cache Aside 是最常用的缓存模式。
   读：先查缓存，未命中查库回填缓存。
   写：先更新数据库，再删缓存。
   删缓存而不是更新缓存，因为简单且避免写多读少的浪费。"
```

### 2. 其他缓存模式？Read/Write Through、Write Behind？

```
【Read Through（读穿透）】
  应用只和缓存交互，不直接查库
  缓存未命中时 → 缓存组件自动查库 → 自动回填 → 返回应用

  和 Cache Aside 的区别：
    Cache Aside：应用自己查库、自己写缓存
    Read Through：缓存组件帮你查库和回填（对应用透明）

  实现：Spring Cache @Cacheable 就是这种思路

【Write Through（写穿透）】
  应用写缓存 → 缓存组件同步写库 → 两者都成功才返回

  优点：缓存和数据库始终一致
  缺点：每次写都要写库，写性能差

【Write Behind / Write Back（写回）】
  应用只写缓存 → 缓存组件异步批量写库

  优点：写性能极高（不等数据库）
  缺点：缓存挂了数据丢失 ❌ → 数据一致性最差

  适用场景：对一致性要求不高的写密集场景
    如：点赞计数、浏览量统计

【四种模式对比】
                    谁负责读库    谁负责写库    一致性    性能
  Cache Aside       应用          应用         较好     较好    ★ 最常用
  Read Through      缓存组件      应用         较好     较好
  Write Through     应用          缓存组件     最好     写慢
  Write Behind      应用          缓存组件     最差     写最快
```

### 3. 订阅 binlog 刷缓存？

```
通过监听 MySQL binlog，数据库变更后异步删除/刷新缓存。

实现架构：
  MySQL → binlog → Canal / Debezium → MQ → 消费者删除 Redis 缓存

流程：
  ① 应用只负责更新数据库（不管缓存）
  ② Canal 监听 MySQL binlog，解析出变更事件
  ③ 变更事件发到 MQ（RabbitMQ / Kafka）
  ④ 消费者消费事件 → 删除对应的 Redis key

优点：
  ① 应用代码不需要关心缓存删除，解耦
  ② 即使删缓存失败，MQ 会重试，最终一致性有保障
  ③ 多系统共享缓存时，一个系统写库，所有缓存自动刷新

适用场景：
  读多写少、一致性要求较高的数据
  如：商品详情、订单状态、账户信息

面试简答：
  "对于一致性要求更高的场景，可以订阅 MySQL binlog，
   通过 Canal 感知数据变更，再异步删除 Redis 缓存，
   相当于对'删缓存失败'做最终一致性补偿。"
```

### 4. 缓存降级：Redis 挂了怎么办？

```
缓存降级 = Redis 不可用时，系统退化到更保守的策略，保证核心功能。

不同业务不同策略：

【核心交易类】（支付、下单）
  → 限流 + 直接查库 + 熔断保护数据库
  → 不能返回默认值（金额不能瞎返回）

【非核心展示类】（推荐列表、广告位、排行榜）
  → 返回默认值 / 空列表 / 降级提示
  → 用户体验稍差但不影响核心功能

【热点查询类】（商品详情、用户信息）
  → 本地缓存短暂兜底（Caffeine / Guava）
  → 同时告警运维处理 Redis

实际做法：
  ① 在 Redis 调用外层包 try-catch
  ② catch 里走降级逻辑（查库 / 返回默认 / 本地缓存）
  ③ 配合 Sentinel 或 Hystrix 做熔断
  ④ Redis 恢复后自动切回正常流程

面试简答：
  "Redis 挂了不能全部打到数据库，否则会雪崩。
   核心接口走限流+查库，非核心返回默认值，
   热点接口用本地缓存兜底，配合熔断避免连锁故障。"
```

---

## 二、HotKey 热点 Key

### 1. 什么是 HotKey？

```
某个 key 的访问量远高于其他 key：

举例：
  双十一某爆款商品 product:detail:1001 → 每秒 10 万次访问
  微博热搜 topic:hot:xxx → 所有人同时看

危害：
  ① 单节点压力过大（集群下这个 key 只在一个节点上）
  ② CPU 飙高，影响同节点的其他 key
  ③ 带宽打满，网卡成瓶颈
  ④ 集群数据倾斜
```

### 2. 怎么发现 HotKey？

```
① redis-cli --hotkeys（需要开启 LFU 淘汰策略）
   redis-cli --hotkeys
   → 输出访问频率最高的 key

② 业务侧埋点
   在代码中统计每个 key 的访问次数
   超过阈值告警

③ 代理层统计
   在 Redis 代理（如 Twemproxy、Codis）或网关层统计请求分布

④ INFO commandstats
   查看各命令执行次数，间接判断

⑤ 云厂商工具
   阿里云/腾讯云 Redis 控制台有热点分析功能
```

### 3. 怎么处理 HotKey？

```
【方案一：本地缓存】★ 最常用
  在 JVM 内用 Caffeine / Guava 缓存热点数据
  请求先查本地缓存 → 命中直接返回 → 不走 Redis
  
  Caffeine cache = Caffeine.newBuilder()
      .maximumSize(1000)
      .expireAfterWrite(5, TimeUnit.SECONDS)  // 短过期，减少不一致
      .build();
  
  优点：不走网络，极快
  缺点：多实例之间本地缓存不同步，有短暂不一致

【方案二：多副本分散读】
  把热点 key 复制多份：
    hot:product:1001:0
    hot:product:1001:1
    hot:product:1001:2
  
  读的时候随机选一个：
    String key = "hot:product:1001:" + random.nextInt(3);
  
  → 读请求分散到不同节点

【方案三：读写分离】
  主节点只写，多个从节点分担读

【方案四：拆分热点】
  一个大 ZSet 排行榜 → 拆成多个分段排行榜

面试简答：
  "HotKey 的核心思路是分散热点。
   最常用的是本地缓存，请求不出 JVM；
   也可以用多副本方式把热点 key 复制多份分散到不同节点。"
```

---

## 三、主从延迟

### 1. 为什么有主从延迟？怎么处理？

```
原因：Redis 主从复制是异步的
  Master 写完立即返回客户端 → 再异步发给 Slave
  中间有时间差 → 从库读到旧数据

加剧延迟的因素：
  ① 网络抖动
  ② Slave 处理能力不足
  ③ Master 瞬时大量写入
  ④ 全量同步期间（RDB 传输 + 加载）
  ⑤ BigKey 传输耗时

处理方案：

【方案一：核心读走主库】
  对一致性要求高的查询，直接读主库
  如：用户刚修改的资料、刚下的订单

【方案二：写后短时间读主库】
  用户刚写完的几秒内强制读主库，之后再走从库
  实现：写操作后在 ThreadLocal / Redis 打标记，几秒内读主库

【方案三：监控复制偏移量】
  INFO replication 查看：
    master_repl_offset: 12345（主库写到的位置）
    slave_repl_offset:  12300（从库同步到的位置）
    差值 = 45 → 延迟了 45 字节的命令

  差值过大时告警

【方案四：减少延迟源头】
  避免 BigKey、控制写入峰值、保障网络带宽

面试简答：
  "主从延迟的根因是异步复制。处理方式是核心读走主库，
   写后短时间强制读主，同时监控复制偏移量做告警。"
```

---

## 四、集群路由

### 1. Hash Tag 是什么？

```
Redis Cluster 计算槽位时，如果 key 包含 {}，只对 {} 里的内容做哈希：

  user:{1001}:name  → CRC16("1001") → 槽 X
  user:{1001}:age   → CRC16("1001") → 槽 X（同一个槽）
  user:{1001}:email → CRC16("1001") → 槽 X（同一个槽）

作用：
  让相关的 key 落在同一个节点
  → 可以用 MGET、Pipeline、Lua 脚本、事务

注意：
  如果 {user} 开头的 key 太多 → 数据都堆在一个节点 → 倾斜
  只适合同一业务实体的多属性，不适合大量不同实体
```

### 2. MOVED 和 ASK 的区别？

```
【MOVED】槽位已经永久迁移
  客户端访问节点 A → 节点 A 返回：MOVED 3999 192.168.1.2:6379
  含义：槽 3999 已经不在我这了，永久搬到了 192.168.1.2
  
  客户端应该：
    ① 更新本地 slot → node 映射表
    ② 以后这个槽的请求直接发到新节点
    ③ 重试当前请求到新节点

【ASK】槽位正在迁移中（临时重定向）
  客户端访问节点 A → 节点 A 返回：ASK 3999 192.168.1.2:6379
  含义：槽 3999 正在搬家，这个 key 可能已经搬过去了，你去问问
  
  客户端应该：
    ① 先向新节点发送 ASKING 命令
    ② 再发送真正的命令
    ③ 不要更新本地映射（因为搬家还没完成）

为什么扩容迁槽时会有 ASK？
  迁槽是渐进式的，不是瞬间完成：
    源节点：一部分 key 还在
    目标节点：已经接收了一部分 key
  过渡期内，客户端可能访问到还没搬走的 key → 正常返回
  也可能访问到已经搬走的 key → 返回 ASK

区别总结：
  MOVED：永久迁移，更新映射
  ASK：临时重定向，不更新映射
```

### 3. 集群下的批处理怎么做？

```
【核心问题】
  单机 Redis：MGET key1 key2 key3 → 一次网络往返，没问题
  
  Redis Cluster：
    key1 → CRC16(key1) % 16384 = slot 3000  → 节点 A
    key2 → CRC16(key2) % 16384 = slot 8000  → 节点 B
    key3 → CRC16(key3) % 16384 = slot 12000 → 节点 C
    
    MGET key1 key2 key3 发给节点 A
    → 节点 A 发现 key2、key3 不在自己身上
    → 返回 MOVED 重定向错误（不会帮你转发）
    → 命令失败
  
  同样受影响：MGET / MSET / Pipeline / Lua 脚本 / 事务（MULTI/EXEC）
    → 都要求所有 key 在同一个 slot

【方案一：Hash Tag（哈希标签）】
  原理：key 包含 {} 时，只取 {} 内的部分做 CRC16
    CRC16("{user}:1001") = CRC16("user") = slot 5649
    CRC16("{user}:1002") = CRC16("user") = slot 5649
    → 同一个 slot → 可以 MGET
  
  优点：最简单，不改代码逻辑
  缺点：相同 tag 的 key 全挤一个节点 → 数据倾斜（hot spot，热点）
  适用：key 数量可控、明确知道哪些 key 需要一起操作

【方案二：串行逐个执行】
  for (key : keys) { results.add(redis.get(key)); }
  
  100 个 key = 100 次网络往返（RTT，Round-Trip Time，往返时延）
  RTT = 1ms → 100ms，性能不可接受
  适用：key 数量极少（< 5 个）

【方案三：并行 slot 分组（生产推荐）】
  ① 计算每个 key 的 slot：CRC16(key) % 16384
  ② 按 slot → node 映射，把 key 分组到各节点
  ③ 每个节点的 key 组装成一条 Pipeline
  ④ 并行发送到各节点
  ⑤ 汇总结果，按原始 key 顺序排好返回
  
  ┌─────────────────────────────────────────────────┐
  │ 输入：MGET key1, key2, key3, key4, key5         │
  ├─────────────────────────────────────────────────┤
  │ 分组：                                           │
  │   节点 A (slot 0-5460)     → [key1, key4]       │
  │   节点 B (slot 5461-10922) → [key2, key5]       │
  │   节点 C (slot 10923-16383)→ [key3]             │
  ├─────────────────────────────────────────────────┤
  │ 并行执行：                                       │
  │   Pipeline → 节点 A: GET key1, GET key4  ──┐    │
  │   Pipeline → 节点 B: GET key2, GET key5  ──┼→并行│
  │   Pipeline → 节点 C: GET key3            ──┘    │
  ├─────────────────────────────────────────────────┤
  │ 汇总：按原始顺序 [v1, v2, v3, v4, v5]          │
  └─────────────────────────────────────────────────┘
  
  耗时 = MAX(各节点 Pipeline 耗时) ≈ 1 次 RTT
  Spring Data Redis 的 multiGet 底层就是这么实现的

【方案四：Lettuce 异步 API】
  利用 Lettuce 的异步命令 + setAutoFlushCommands(false)
  攒一批命令 → flushCommands() 一次性发送
  底层自动路由到正确节点，不需要手动分组

【方案对比】
  方案            网络往返    数据倾斜风险    适用场景
  ──────────────────────────────────────────────────
  Hash Tag       1 次       高（全挤一节点） key 少、明确关联
  串行           N 次       无              key 极少（< 5）
  并行 slot 分组  ≈1 次     无              通用，生产推荐
  Lettuce 异步   ≈1 次     无              已用 Lettuce 客户端

面试简答：
  "Redis Cluster 下批处理的核心问题是 key 分散在不同 slot、不同节点，
   MGET/Pipeline 不能跨节点。解决方案是按 slot 分组，
   每组 Pipeline 并行发到对应节点，最后汇总结果。
   Spring Data Redis 的 multiGet 底层就是这么做的。
   如果需要强制相关 key 在同一节点，可以用 Hash Tag，
   但要注意数据倾斜。"
```

---

## 五、脑裂问题

### 1. Redis 脑裂是什么？怎么解决？

```
场景：
  主节点和哨兵/从节点之间网络分区
  → 哨兵以为主节点挂了 → 选出新主节点
  → 但旧主节点还在运行，还在接受写请求
  → 两个主节点同时写 → 数据分叉

  网络恢复后：
    旧主节点降为从节点
    → 从新主节点全量同步
    → 旧主节点在脑裂期间接收的写全部丢失 ❌

解决方案：

【配置层面】
  在 redis.conf 中设置：
    min-replicas-to-write 1      # 至少有 1 个从节点在线才允许写
    min-replicas-max-lag 10      # 从节点延迟不超过 10 秒

  → 如果主节点发现没有从节点跟上 → 拒绝写入
  → 脑裂时旧主节点被隔离 → 检测到没有从节点 → 自动拒绝写
  → 客户端写失败 → 不会产生脏数据

【架构层面】
  ① 保障网络可靠性，减少分区概率
  ② 核心一致性场景不把 Redis 当唯一数据源
  ③ 业务层做幂等兜底

面试简答：
  "Redis 脑裂是网络分区导致新旧主节点同时写入，恢复后旧主数据丢失。
   解决方式是配置 min-replicas-to-write 和 min-replicas-max-lag，
   让孤立的主节点自动拒绝写入，同时业务层做幂等兜底。"
```


---

# 三十七、Redis 底层数据结构与线程模型

---

## 一、底层数据结构

### 1. RedisObject 是什么？

```
Redis 中每个 value 不是裸数据，外面包了一层 redisObject：

typedef struct redisObject {
    unsigned type:4;      // 数据类型（string/hash/list/set/zset）
    unsigned encoding:4;  // 编码方式（int/raw/hashtable/skiplist...）
    unsigned lru:24;      // LRU/LFU 淘汰信息
    int refcount;         // 引用计数（内存回收用）
    void *ptr;            // 指向真实数据的指针
} robj;

作用：
  ① 同一种类型可以有不同编码（如 Hash 可以是 ziplist 或 hashtable）
  ② Redis 根据数据量自动选择最优编码
  ③ LRU/LFU 淘汰策略的信息也存在这里

查看某个 key 的编码：
  OBJECT ENCODING mykey
```

### 2. SDS（Simple Dynamic String）是什么？

```
Redis 自己实现的字符串，不用 C 语言原生的 char*。

SDS 结构：
  struct sdshdr {
      int len;      // 当前字符串长度
      int alloc;    // 分配的总空间
      char buf[];   // 实际存储数据
  };

为什么不用 C 字符串？

  C 字符串的问题          SDS 的解决
  ─────────────────────────────────────────
  获取长度 O(n)           len 字段直接读，O(1)
  以 \0 结尾，不能存二进制  用 len 判断结束，二进制安全
  修改时可能缓冲区溢出     自动检查空间，不够就扩容
  每次修改都要重新分配内存  空间预分配 + 惰性释放

空间预分配：
  扩容后 len < 1MB → 额外分配 len 大小的空闲空间（翻倍）
  扩容后 len ≥ 1MB → 额外分配 1MB 空闲空间
  → 减少连续追加时的内存重分配次数

面试简答：
  "Redis 用 SDS 代替 C 字符串，因为 SDS 获取长度是 O(1)，
   支持二进制安全，自动扩容避免溢出，还有空间预分配减少重分配。"
```

### 3. ziplist 和 quicklist？

```
【ziplist（压缩列表）】
  一块连续内存，紧凑排列所有元素
  
  结构：zlbytes | zltail | zllen | entry1 | entry2 | ... | zlend
  
  优点：内存紧凑，省空间（没有指针开销）
  缺点：
    ① 插入/删除可能触发连锁更新（cascading update）
    ② 元素多了之后遍历慢
  
  使用场景：Hash、ZSet 在元素少且元素小时用 ziplist
    hash-max-ziplist-entries 512    # 元素数量 ≤ 512
    hash-max-ziplist-value 64      # 每个元素 ≤ 64 字节
    超过阈值 → 自动转为 hashtable / skiplist

  注意：Redis 7.0 开始用 listpack 替代 ziplist，解决了连锁更新问题

【quicklist（快速列表）】
  List 类型的底层实现
  
  本质：双向链表 + 每个节点里存一个 ziplist/listpack
  
  为什么不用纯链表？
    纯链表每个元素一个节点 → 指针开销大（前后指针各 8 字节）
  为什么不用纯 ziplist？
    ziplist 太大时插入删除代价高
  
  quicklist 折中：
    链表提供灵活的增删
    每个节点内部用 ziplist 提供紧凑存储
    → 既省内存又保证性能
```

### 4. intset（整数集合）？

```
Set 类型在元素全是整数且数量少时，用 intset：

  结构：encoding | length | contents[]
  
  encoding：int16 / int32 / int64（根据最大值自动升级）
  contents：有序数组，支持二分查找

  升级机制：
    原来全是 int16 → 插入一个 int32 的值
    → 整个数组升级为 int32（不能降级）

  优点：紧凑，二分查找 O(log n)
  缺点：元素多了之后转为 hashtable
  
  阈值：set-max-intset-entries 512
```

### 5. hashtable（哈希表）？

```
Redis 的哈希表实现，和 Java HashMap 类似：
  数组 + 链表（拉链法解决冲突）

特点：
  渐进式 rehash ★
    扩容/缩容时不是一次性搬完
    而是每次操作时顺便搬几个
    → 避免大 hash 表一次 rehash 卡住

  rehash 期间同时维护两张表（ht[0] 和 ht[1]）：
    查找：先查 ht[0]，没有再查 ht[1]
    新增：直接加到 ht[1]
    每次操作：从 ht[0] 搬一部分到 ht[1]
    搬完后：释放 ht[0]，ht[1] 变为 ht[0]
```

### 6. skiplist（跳表）—— 为什么 ZSet 用跳表？

```
跳表 = 多层有序链表

原始链表：     1 → 3 → 5 → 7 → 9 → 11 → 13
第一层索引：   1 ────→ 5 ────→ 9 ────→ 13
第二层索引：   1 ─────────→ 9 ─────────→

查找 9：从最高层开始
  第二层：1 → 9 ✅（两步就找到）
  如果是原始链表：1 → 3 → 5 → 7 → 9（四步）

时间复杂度：O(log n)（和平衡树一样）

ZSet 为什么用跳表而不是红黑树？
  ① 实现简单：跳表代码比红黑树简单得多，容易调试维护
  ② 范围查询快：找到起点后沿链表往后走就行
     红黑树范围查询需要中序遍历，实现复杂
  ③ 插入删除简单：只需要修改前后指针
     红黑树需要旋转和变色
  ④ 内存友好：可以通过调整层数控制空间和时间的平衡

ZSet 的完整结构：
  dict（哈希表）+ skiplist（跳表）
  
  dict：member → score 映射（O(1) 查某个成员的分数）
  skiplist：按 score 排序（范围查询、排名查询）
  
  两者配合：
    ZSCORE key member → 走 dict，O(1)
    ZRANGEBYSCORE key min max → 走 skiplist，O(log n + m)
    ZRANK key member → 走 skiplist，O(log n)

面试简答：
  "ZSet 用 dict + skiplist 组合实现。dict 负责 O(1) 查分数，
   skiplist 负责排序和范围查询。选跳表而不是红黑树是因为
   实现简单、范围查询更自然、内存可控。"
```

### 7. 各类型的编码方式汇总

```
类型      元素少/小              元素多/大
───────────────────────────────────────────
String    int / embstr           raw
Hash      ziplist/listpack       hashtable
List      quicklist              quicklist
Set       intset                 hashtable
ZSet      ziplist/listpack       skiplist + dict

Redis 会根据数据量和元素大小自动切换编码
小数据用紧凑结构省内存，大数据用高效结构保性能
```

---

## 二、线程模型

### 1. Redis 6.0 多线程到底多了什么？

```
Redis 6.0 之前：完全单线程
Redis 6.0 之后：IO 多线程 + 命令执行仍然单线程

多线程只负责：
  ① 读取客户端请求数据（read socket）
  ② 发送响应数据给客户端（write socket）
  ③ 协议解析的辅助处理

主线程仍然负责：
  ① 执行命令（SET/GET/HSET...）
  ② 修改内存数据
  ③ 所有核心逻辑

  IO 线程1 ──读请求──┐
  IO 线程2 ──读请求──┤
  IO 线程3 ──读请求──┼→ 主线程串行执行命令 →┬─写响应→ IO 线程1
  IO 线程4 ──读请求──┘                      ├─写响应→ IO 线程2
                                            ├─写响应→ IO 线程3
                                            └─写响应→ IO 线程4

为什么不把命令执行也多线程化？
  ① Redis 的瓶颈在网络 IO，不在命令执行（纯内存操作极快）
  ② 单线程无锁，实现简单，不会有并发 bug
  ③ 多线程执行需要加锁，锁的开销可能比单线程还慢

开启方式：
  io-threads 4              # IO 线程数（建议 CPU 核数的一半）
  io-threads-do-reads yes   # 读也用多线程

面试简答：
  "Redis 6.0 的多线程只用于网络 IO 读写，命令执行仍然是单线程。
   因为 Redis 的瓶颈在网络 IO 不在命令执行，
   这样既提升了网络吞吐，又保持了单线程无锁的简单性。"
```

### 2. fork 对持久化的影响？为什么大实例会卡顿？

```
BGSAVE 和 BGREWRITEAOF 都用 fork 创建子进程做持久化。

fork 的代价：

【① fork 瞬间阻塞】
  fork() 系统调用会复制父进程的页表
  内存越大 → 页表越大 → 阻塞时间越长
  
  10GB 内存 → fork 大约 20ms
  25GB 内存 → fork 大约 50ms
  50GB 内存 → fork 大约 100ms+（可感知的卡顿）

【② 写时复制 COW（Copy On Write）】
  fork 后父子进程共享物理内存
  → 主进程继续处理写请求
  → 修改的内存页会被复制一份（COW）
  → 写越多，额外内存开销越大
  
  极端情况：如果 fork 后所有数据都被修改
  → 内存占用翻倍

【③ 磁盘 IO 压力】
  子进程要把全量数据写到磁盘
  大实例 = 大文件 = 磁盘 IO 压力大

优化措施：
  ① 控制单实例内存（建议 ≤ 10GB）
  ② 避免 BigKey（减少 COW 影响）
  ③ 在低峰期做 RDB/AOF 重写
  ④ 使用 SSD
  ⑤ 调整 auto-aof-rewrite-min-size 和 auto-aof-rewrite-percentage
  ⑥ 关闭 THP（Transparent Huge Pages），减少 COW 的页复制粒度

面试简答：
  "Redis 后台持久化依赖 fork 子进程。fork 本身会阻塞主线程，
   内存越大阻塞越久。fork 后主进程写数据触发写时复制，
   导致额外内存开销。所以大内存实例持久化容易卡顿，
   建议单实例控制在 10GB 以内。"
```


---

# 三十八、Redis 生产实践场景

---

## 一、Redis 限流

### 1. Redis 怎么实现限流？

```
【方案一：固定窗口计数器】
  每秒一个 key，记录请求次数：
  
  INCR rate:user:1001:20260414120001   // 当前秒计数 +1
  EXPIRE rate:user:1001:20260414120001 2  // 2 秒过期
  
  判断：计数 > 阈值 → 拒绝
  
  缺点：窗口边界突刺问题
    第 1 秒末尾 100 次 + 第 2 秒开头 100 次 = 1 秒内 200 次

【方案二：滑动窗口（Lua + ZSet）】★ 推荐
  用 ZSet 记录每次请求：
    member = 请求唯一 ID（如 UUID）
    score = 当前时间戳
  
  Lua 脚本（保证原子性）：
    ① ZREMRANGEBYSCORE key 0 (now - window)   // 删除窗口外的旧记录
    ② count = ZCARD key                        // 统计窗口内请求数
    ③ if count < limit then
         ZADD key now uuid                     // 未超限，记录请求
         return 1                              // 允许
       else
         return 0                              // 拒绝
       end
  
  优点：精确，无边界问题
  缺点：每次请求都操作 ZSet，成本略高

【方案三：令牌桶】
  固定速率往桶里放令牌，请求来了拿令牌：
    有令牌 → 放行
    没令牌 → 拒绝或等待
  
  适合需要平滑控制速率、允许一定突发的场景

面试简答：
  "Redis 限流常用滑动窗口方案，用 ZSet 记录请求时间戳，
   Lua 脚本保证原子性，每次请求先清理窗口外记录再统计数量。
   简单场景用计数器，需要平滑限速用令牌桶。"
```

---

## 二、Redis 延时队列

### 1. Redis 怎么做延时队列？

```
用 ZSet 实现：
  member = 任务 ID / 任务内容
  score = 任务执行时间戳（毫秒）

生产者（投递延时任务）：
  // 30 分钟后执行
  long executeTime = System.currentTimeMillis() + 30 * 60 * 1000;
  ZADD delay:queue executeTime "order:cancel:1001"

消费者（轮询取到期任务）：
  while (true) {
      // 取出 score ≤ 当前时间的任务（已到期）
      Set<String> tasks = ZRANGEBYSCORE delay:queue 0 System.currentTimeMillis() LIMIT 0 1;
      
      if (tasks.isEmpty()) {
          Thread.sleep(500);  // 没有到期任务，休息一下
          continue;
      }
      
      String task = tasks.iterator().next();
      // 用 ZREM 保证只有一个消费者能抢到（原子性）
      if (ZREM delay:queue task > 0) {
          // 抢到了，处理任务
          handleTask(task);
      }
  }

实际场景：
  下单 30 分钟未支付自动取消
  预约提醒（提前 15 分钟通知）
  延迟重试

注意：
  ① 多消费者用 ZREM 做原子抢占，防重复消费
  ② 轮询间隔不能太长（影响精度）也不能太短（浪费 CPU）
  ③ 更复杂的场景建议用 RabbitMQ 死信队列或 RocketMQ 延时消息

面试简答：
  "Redis 做延时队列用 ZSet，score 存执行时间戳，
   消费者按当前时间扫描到期任务，用 ZREM 原子抢占防重复。
   简单延时场景够用，复杂场景建议用专业消息队列。"
```

---

## 三、Redis 排行榜

### 1. Redis 怎么做排行榜？

```
ZSet 天然适合排行榜：
  member = 用户 ID
  score = 分数 / 销量 / 热度

常用命令：
  ZADD rank:game 1000 user:1001       // 设置分数
  ZINCRBY rank:game 50 user:1001      // 加 50 分
  ZREVRANGE rank:game 0 9 WITHSCORES  // Top 10（分数从高到低）
  ZREVRANK rank:game user:1001        // 查某用户排名（0 开始）
  ZSCORE rank:game user:1001          // 查某用户分数

实际场景：
  游戏积分排行榜
  电商销量排行
  热搜排行

数据量大时的优化：
  ① 分时间段：rank:game:20260414（每天一个排行榜）
  ② 分页查：ZREVRANGE rank:game 0 19（前 20 名）
  ③ 定期清理过期排行榜

面试简答：
  "排行榜用 ZSet，score 存分数，
   ZREVRANGE 取 TopN，ZREVRANK 查个人排名，
   ZINCRBY 实时更新分数，天然有序，不需要额外排序。"
```

---

## 四、Redis 分布式 Session

### 1. Redis 怎么做分布式 Session？

```
问题：
  传统 Session 存在单机内存里
  集群部署时，用户请求可能到不同机器 → Session 不共享 → 登录失效

解决：Session 存 Redis

  登录成功后：
    String sessionId = UUID.randomUUID().toString();
    redis.setex("session:" + sessionId, 1800, JSON.toJSON(userInfo));
    // Cookie 返回 sessionId
  
  请求校验时：
    String sessionId = request.getCookie("SESSION_ID");
    String userInfo = redis.get("session:" + sessionId);
    if (userInfo == null) → 未登录

Spring Session + Redis（一行配置搞定）：
  spring.session.store-type=redis
  spring.session.timeout=30m
  
  → Spring 自动把 Session 存 Redis
  → 开发者代码不用改
  → 多节点自动共享

续期策略：
  每次请求成功后刷新过期时间
  EXPIRE session:xxx 1800

面试简答：
  "分布式 Session 把登录态从单机内存改存到 Redis，
   所有节点通过 sessionId 去 Redis 查用户信息。
   Spring Session 框架可以无侵入地实现，一行配置搞定。"
```

---

## 五、Redis 幂等控制

### 1. Redis 怎么做幂等？

```
【方案一：唯一 Token】
  适合：表单重复提交

  流程：
    ① 进入页面时，服务端生成 Token 存 Redis：
       SET token:submit:abc123 1 EX 300
    ② 提交时带上 Token
    ③ 服务端用 Lua 脚本校验并删除（原子操作）：
       if redis.call('get', KEYS[1]) == ARGV[1] then
           redis.call('del', KEYS[1])
           return 1   -- 第一次提交，放行
       else
           return 0   -- Token 不存在或已用过，拒绝
       end
    ④ 第二次提交 → Token 已删除 → 拒绝

【方案二：SETNX 请求去重】
  适合：接口幂等

  流程：
    每个请求带一个唯一标识（如 requestId）
    SET idempotent:order:create:req123 1 NX EX 300
    
    返回 OK → 第一次请求，继续执行业务
    返回 nil → 重复请求，直接拒绝

  代码：
    Boolean success = redis.opsForValue()
        .setIfAbsent("idempotent:" + requestId, "1", 300, TimeUnit.SECONDS);
    if (!success) {
        return Result.fail("请勿重复提交");
    }
    // 执行业务...

【方案三：状态机】
  适合：有状态流转的业务

  UPDATE order SET status='已支付' WHERE id=1001 AND status='待支付'
  → 第一次：影响行数=1，成功
  → 第二次：status 已经不是"待支付"了，影响行数=0，跳过

面试简答：
  "Redis 幂等控制核心是给每个请求一个唯一标识，用 SETNX 保证只处理一次。
   表单场景用 Token 机制，接口场景用 requestId + SETNX，
   有状态流转的场景用状态机兜底。"
```


---

# 三十九、Redis 查漏补缺（下）

---

## 一、BigKey 危害与处理

### 1. 什么是 BigKey？有什么危害？

```
判断标准：
  String 类型：value > 10KB 就要注意，> 1MB 很严重
  Hash / List / Set / ZSet：元素数 > 5000 或总大小 > 10MB

危害：
  ① 阻塞：BigKey 的读写耗时长，单线程模型下阻塞其他请求
  ② 网络拥塞：一次请求传输几 MB 数据，占满带宽
  ③ 集群倾斜：BigKey 所在节点内存远大于其他节点
  ④ 删除慢：DEL 一个大 key 可能阻塞几百毫秒（用 UNLINK 异步删除）
  ⑤ 持久化慢：fork 写时复制时，BigKey 所在的内存页被频繁复制
  ⑥ 主从延迟：BigKey 同步耗时，加大主从延迟

排查方式：
  redis-cli --bigkeys            → 扫描最大的 key
  redis-cli --memkeys            → 按内存占用排序
  rdbtools（离线分析 RDB 文件）  → 最全面
```

### 2. String BigKey 怎么处理？

```
【方案一：压缩】
  JSON / XML 等文本数据压缩效果好（减少 70%~90%）：
  
  // 存的时候压缩
  byte[] compressed = GZIPUtil.compress(jsonString.getBytes());
  redis.opsForValue().set("product:desc:1001", compressed);
  
  // 取的时候解压
  byte[] compressed = redis.opsForValue().get("product:desc:1001");
  String jsonString = new String(GZIPUtil.decompress(compressed));
  
  也可以换序列化方式：JSON → Protobuf / MessagePack（小 30%~50%）

【方案二：拆分成多个小 key】
  原来：article:1001 → 10MB 的文章
  拆成：
    article:1001:chunk:0 → 第 1 个 1MB
    article:1001:chunk:1 → 第 2 个 1MB
    ...
    article:1001:meta    → {"totalChunks": 10}

【方案三：改存储位置】
  大段 HTML / 文章内容 → 放 OSS / MongoDB
  图片 / 文件的 Base64 → 放 OSS，Redis 只存 URL
  大 JSON 报表         → 放数据库

【方案四：只缓存需要的部分】
  把大对象拆成热数据和冷数据：
    user:basic:1001（Hash）→ name, age, city（热数据，放 Redis）
    user:detail:1001       → 完整信息（冷数据，查数据库）

选择优先级：
  ① 该不该放 Redis → ② 能不能只存一部分 → ③ 压缩 → ④ 拆分
```

### 3. Hash / List / Set / ZSet BigKey 怎么拆分？

```
【Hash 拆分：按字段分片】
  原来：user:detail:1001 有 50000 个 field → BigKey

  拆成多个小 Hash：
    user:detail:1001:0  → field 哈希值 % 10 == 0 的字段
    user:detail:1001:1  → field 哈希值 % 10 == 1 的字段
    ...
    user:detail:1001:9
  
  读写时：先算 field 落在哪个分片 → 操作对应的小 Hash

【ZSet 拆分：按时间/分段】
  原来：rank:game 有 100 万条 → BigKey

  按时间拆分：rank:game:20260414（每天一个排行榜）
  按分数分段：rank:game:0-1000、rank:game:1001-5000
  按业务拆分：rank:game:region:guangdong

面试简答：
  "BigKey 的核心危害是阻塞和内存倾斜。
   String BigKey 优先考虑压缩或改存储位置，
   集合类型 BigKey 按字段/时间/业务维度拆分成多个小 key。
   排查用 redis-cli --bigkeys 或 rdbtools。"
```

---

## 二、Redis 分布式锁

### 1. 分布式锁怎么实现？

```
用 String 类型，核心命令：SET key value NX EX

【加锁】
  SET lock:order:1001 "uuid-abc" NX EX 30
  
  SET           → 设置 key-value
  lock:order:1001 → key（锁名）
  "uuid-abc"    → value（谁加的锁，UUID 标识）
  NX            → 只在 key 不存在时才设置（核心）
  EX 30         → 30 秒后自动过期（防死锁）
  
  返回 OK  → 加锁成功
  返回 nil → 加锁失败（别人持有）

【释放锁（Lua 脚本保证原子性）】
  if redis.call('get', KEYS[1]) == ARGV[1] then
      redis.call('del', KEYS[1])
      return 1
  else
      return 0
  end
  
  为什么不能直接 DEL？
    张三加的锁，李四可能误删
    释放前要检查 value 是不是自己的 → 检查 + 删除必须原子 → 用 Lua

【为什么 value 要存 UUID】
  线程 A 加锁 → 超时自动过期 → 锁没了
  线程 B 加锁成功
  线程 A 做完了 → DEL → 把线程 B 的锁删了 ❌
  
  用 UUID：释放时检查 value 是不是自己的 → 不是就不删

【为什么要设过期时间】
  加锁后宕机 → DEL 永远不会执行 → 死锁
  设了 EX 30 → 30 秒后自动消失 → 不会死锁
```

### 2. Redisson 分布式锁？

```
简单实现的问题：
  ① 业务执行超过 30 秒 → 锁过期了但业务没做完
  ② 不支持可重入（同一线程再次加锁会失败）

Redisson 解决了这些：

【看门狗机制（自动续期）】
  加锁成功后，后台线程每 10 秒检查：
    锁还在？业务还没做完？→ 自动续期 30 秒
  业务做完手动释放 → 看门狗停止

【可重入锁】
  Redisson 用 Hash 类型（不是 String）：
    HSET lock:order:1001 "uuid:threadId" 1   ← 加锁次数 = 1
    再次加锁：HINCRBY → 加锁次数变 2
    释放：HINCRBY -1 → 减到 0 才真正删除

【红锁 RedLock（多节点）】
  主从模式下主库加锁后宕机 → 从库没同步到 → 锁丢了
  RedLock：同时向 N 个独立 Redis 实例加锁 → 过半成功才算加锁成功

Java 代码：
  RLock lock = redisson.getLock("lock:order:1001");
  try {
      lock.lock();       // 加锁（自动续期）
      doSomething();     // 执行业务
  } finally {
      lock.unlock();     // 释放锁
  }

面试简答：
  "Redis 分布式锁用 SET NX EX 实现，value 存 UUID 防误删，
   EX 防死锁。生产环境用 Redisson，支持看门狗自动续期、
   可重入锁、红锁多节点加锁。"
```

---

## 三、Redis 监控与调优

### 1. 监控关注什么？

```
【常用监控命令】
  INFO memory          → 内存使用情况
  INFO stats           → 命中率、QPS
  INFO replication     → 主从同步状态
  SLOWLOG GET 10       → 最近 10 条慢查询
  CLIENT LIST          → 当前连接的客户端
  DBSIZE               → 当前库有多少 key

【重点关注指标】
  内存使用率 > 80%       → 准备扩容或清理
  命中率太低             → 缓存策略有问题
  慢查询                 → 有 BigKey 或复杂命令
  主从延迟               → 同步有问题
  连接数接近上限          → 连接池配置不对

【监控工具】
  redis-cli --stat（实时刷新状态）
  RedisInsight、Prometheus + Grafana
  云厂商 Redis 控制台自带监控面板
```

### 2. 调优方向？

```
【内存调优】
  ① 选对数据结构（Hash 比多个 String 省内存）
  ② 避免 BigKey，设合理过期时间
  ③ 选合适的淘汰策略（allkeys-lru / volatile-lru）

【性能调优】
  ① 避免慢命令（KEYS * → 用 SCAN 代替）
  ② Pipeline 批量操作，减少网络往返
  ③ Redis 6.0 开启 IO 多线程
  ④ 连接池配置合理

【持久化调优】
  ① 单实例内存 ≤ 10GB（减少 fork 阻塞）
  ② 低峰期做 RDB/AOF 重写
  ③ 关闭 THP，使用 SSD

面试简答：
  "监控方面，用 INFO 命令关注内存使用率、命中率、慢查询，
   结合 Prometheus + Grafana 做可视化告警。
   调优方面，避免 BigKey、用 Pipeline 批量操作、
   控制单实例内存、合理配置连接池。"
```

---

## 四、过期删除策略

### 1. 过期删除和内存淘汰的区别？

```
过期删除策略：key 到了 EXPIRE 设定的时间怎么删掉
内存淘汰策略：内存满了删掉谁

这是两个完全不同的机制！

  设了 EXPIRE 的 key 到期 → 过期删除策略决定什么时候删
  Redis 内存用满了         → 内存淘汰策略决定踢掉谁
```

### 2. Redis 怎么删过期 key？

```
【策略一：惰性删除】
  不主动扫描，访问 key 时才检查
  
  GET key1
    → 先检查 key1 过期了没
    → 过期了 → 删掉 → 返回 nil
    → 没过期 → 正常返回
  
  优点：对 CPU 友好（不用主动扫描）
  缺点：过期 key 没人访问就永远不删 → 内存泄漏

【策略二：定期删除】
  Redis 每秒 10 次（每 100ms）主动扫一批：
    ① 随机抽 20 个设了过期时间的 key
    ② 删除其中已过期的
    ③ 如果过期占比 > 25% → 再抽 20 个继续
    ④ 如果过期占比 ≤ 25% → 停止
  
  优点：主动清理，不依赖访问
  缺点：随机抽样，可能漏掉一些

【两者配合 + 内存淘汰兜底】
  定期删除 → 后台每秒扫 10 次清理一批
  惰性删除 → 访问时发现过期就删
  还有漏网的 → 内存淘汰策略兜底（内存满了强制踢 key）
  → 三层保障

面试简答：
  "Redis 过期删除用惰性删除 + 定期删除配合。
   惰性删除是访问时检查是否过期；
   定期删除是每秒 10 次随机抽样检查并删除。
   两者互补，漏掉的由内存淘汰策略兜底。"
```

---

## 五、Redis 事务

### 1. Redis 事务怎么用？

```
MULTI       → 开启事务
命令1       → 放入队列（不执行）
命令2       → 放入队列
EXEC        → 一次性执行所有命令
DISCARD     → 取消事务

例子：
  > MULTI
  > SET name "张三"       → QUEUED
  > SET age 25            → QUEUED
  > INCR age              → QUEUED
  > EXEC
  1) OK
  2) OK
  3) (integer) 26
```

### 2. Redis 事务和 MySQL 事务的区别？

```
                    MySQL 事务            Redis 事务
原子性              全成功或全失败         部分支持（不支持回滚）
回滚                支持 ROLLBACK         不支持

Redis 不支持回滚的例子：
  MULTI
  SET name "张三"      → 成功
  INCR name            → 报错（字符串不能 INCR）
  SET age 25           → 成功
  EXEC
  → 第 2 条报错，但第 1、3 条照样执行了 ❌

两种错误的区别：
  语法错（如 SETT 拼错）→ 整个事务取消，一条都不执行
  运行错（如对字符串 INCR）→ 错的那条失败，其他照常执行

为什么不支持回滚？
  Redis 作者认为命令错误是编程 bug，不应该出现在生产环境
  不支持回滚 → 实现简单 → Redis 更快
```

### 3. WATCH 乐观锁？

```
WATCH 可以实现 CAS（Compare And Swap）效果：

  WATCH balance          ← 监视 balance
  GET balance            ← 读到 100
  MULTI
  DECRBY balance 50      ← 扣 50
  EXEC

  如果 WATCH 之后、EXEC 之前别的客户端改了 balance：
    → EXEC 返回 nil → 事务取消 → 需要重试

实际中更常用 Lua 脚本代替事务：
  Lua 原子执行 + 支持逻辑判断 → 事务的上位替代

面试简答：
  "Redis 事务用 MULTI/EXEC 打包命令一次执行，
   但不支持回滚。WATCH 可以实现乐观锁。
   实际开发中更常用 Lua 脚本代替事务。"
```

---

## 六、Redis 特殊数据类型

### 1. Bitmap、HyperLogLog、GeoSpatial？

```
【Bitmap（位图）】
  底层就是 String，操作单个 bit
  
  SETBIT login:2024-04-14 1001 1     ← 用户 1001 今天登录了
  GETBIT login:2024-04-14 1001       ← 检查是否登录
  BITCOUNT login:2024-04-14          ← 今天多少人登录了
  
  1MB = 800 万 bit → 能标记 800 万用户的登录状态
  适合：签到、活跃用户统计、布隆过滤器

【HyperLogLog（基数统计）】
  底层也是 String，用于去重计数
  
  PFADD uv:2024-04-14 "user:1001"
  PFADD uv:2024-04-14 "user:1002"
  PFADD uv:2024-04-14 "user:1001"   ← 重复不计
  PFCOUNT uv:2024-04-14              → 2
  
  不管放多少数据，固定占 12KB
  有 0.81% 的误差
  适合：UV 统计（不需要精确，只要大概数）

【GeoSpatial（地理位置）】
  底层是 ZSet，经纬度转 geohash 作为 score
  
  GEOADD city:pos 113.26 23.13 "广州"
  GEOADD city:pos 114.06 22.54 "深圳"
  GEODIST city:pos "广州" "深圳" km       → 计算距离
  GEORADIUS city:pos 113.26 23.13 100 km → 附近 100km 的城市
  
  适合：附近的人、附近的店

面试简答：
  "Bitmap 底层是 String，用于签到和活跃统计，非常省内存。
   HyperLogLog 固定 12KB 做去重计数，有 0.81% 误差，适合 UV 统计。
   GeoSpatial 底层是 ZSet，支持距离计算和范围查询，适合 LBS 场景。"
```


# 四十、项目场景：Redis 多能力组合设计

## Q1：同一个系统中，锁、限流、缓存、幂等、布隆过滤器分别怎么选？

### 结论（30 秒版）

先按问题选能力，不要把所有场景都叫“缓存”：锁解决同一资源的并发互斥，限流解决单位时间的流量预算，缓存解决读性能，幂等解决重复请求，布隆过滤器只负责快速判断“肯定不存在”。Redis 只保存适合它的临时状态，业务最终结果、唯一约束和审计仍应落在持久化存储中。

### 能力选型表

| 问题 | Redis 方案 | 关键边界 | 持久化兜底 |
| --- | --- | --- | --- |
| 同一资源并发修改 | Redisson 分布式锁 | 看门狗只续租，不替代业务超时和状态校验 | 数据库状态条件更新/唯一约束 |
| 多实例流量控制 | Lua 令牌桶或滑动窗口 | 按接口、租户、设备等维度限额，拒绝后要有降级策略 | 配置中心和监控告警 |
| 读多写少 | Cache Aside | 先更新事实源，再删除/失效缓存；明确短暂不一致 | 关系库或其他事实源 |
| 重复请求/重复消费 | `SET NX EX` + 业务状态机 | TTL 只拦截窗口内重复，不能代表最终成功 | 唯一键、状态表、幂等流水 |
| 缓存穿透 | Bloom Filter + 空值缓存 | 可能误判存在，不能作为放行的唯一依据 | 数据库查询和过滤器重建 |
| 临时任务抢占 | ZSet/Stream/锁 | 处理失败要有重试、租约和恢复机制 | 任务表或消息队列 |

### 设计顺序

1. 先确认事实源、状态机和唯一业务键，再决定 Redis 保存什么。
2. 明确 key 的租户、业务对象和版本维度，避免不同业务共用一个模糊 key。
3. 需要多个 Redis 操作共同完成时使用 Lua 或可靠客户端原子命令，避免“先查后改”的竞态。
4. 为每类 key 设置合理 TTL、容量上限和淘汰策略，并监控命中率、延迟、内存和大 key。
5. Redis 不可用时按业务重要性降级：核心约束回到数据库或拒绝请求，非核心功能返回兜底结果。

### 常见误区

- 分布式锁拿到后仍要再次检查业务状态，锁不能替代数据库条件更新。
- `SETNX` 成功只表示抢到幂等窗口，不表示后续业务一定成功；失败后的状态和重试策略必须单独设计。
- 布隆过滤器存在误判，判断“可能存在”后仍要查缓存或数据库；删除能力不足时要考虑重建或计数型结构。
- 令牌桶限流只解决入口配额，不能代替消费者并发控制、连接池保护和下游熔断。

### 相关追问

- Q：为什么不用 Redis 锁保证订单最终一致？
  A：锁只覆盖一段临界区，进程宕机、超时和外部调用仍会产生中间状态；最终一致要靠状态机、重试、补偿和对账。
- Q：Redis 标记和数据库唯一键都需要吗？
  A：高并发入口可以用 Redis 快速拦截，数据库唯一键或条件更新负责最终正确性，两者职责不同。

## Q2：短链如何生成、存储和防止缓存穿透？

### 结论（30 秒版）

短链生成应把“短码唯一”和“跳转高性能”分开：用全局唯一序列或业务 ID 做 Base62 编码，短链表保存短码到长 URL 的映射并建立唯一索引，Redis 缓存热点映射；访问时先做格式和黑名单校验，再用布隆过滤器拦截明显不存在的短码，可能存在时仍需查 Redis 和数据库。短码一旦对外使用，映射、过期、撤销和审计规则都要明确。

### 生成与访问链路

```text
创建长 URL
  -> 生成全局唯一 ID
  -> Base62 编码为 shortCode
  -> 唯一索引写入短链表
  -> 写入 Redis（可设置 TTL）

访问 shortCode
  -> 格式/状态/权限校验
  -> Bloom Filter：肯定不存在则直接返回
  -> Redis 命中则跳转
  -> 未命中查库并回填
  -> 记录点击事件（异步）
```

### 关键边界

- Base62 只是编码，不提供加密；对连续 ID 敏感时，要评估可枚举风险，必要时使用随机码、加密映射或访问控制。
- 数据库唯一索引是并发下的最终防线，不能只用“先查再插入”判断冲突。
- 短链写入和缓存写入失败时，以数据库映射为准，由重试或回填任务修复缓存。
- 长 URL、过期时间、创建者、状态和访问统计应分开治理；点击统计不应阻塞跳转主链路。
- 302 适合需要动态控制和统计的短链，301 更利于缓存但会降低后续控制能力，按业务选择。
- 对已撤销或过期短码应返回明确状态，不能因为 Redis 旧缓存继续放行。

### 常见追问

- Q：布隆过滤器能保证短链一定存在吗？
  A：不能。返回“不存在”时可以确定不存在；返回“可能存在”仍需继续查 Redis 或数据库。
- Q：短链映射能不能直接更新？
  A：如果外部已传播，直接修改目标会改变用户看到的内容并影响审计；通常保留原映射，修改目标生成新版本或新短码。

