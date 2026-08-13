# 二、Java 并发

## 1. synchronized 和 ReentrantLock 的区别？

| 对比 | synchronized | ReentrantLock |
|------|-------------|---------------|
| 实现 | JVM 内置，monitorenter/monitorexit | JDK API（AQS） |
| 锁释放 | 自动释放（出作用域/异常） | 手动 unlock()，必须在 finally 里 |
| 可中断 | 不可中断 | lockInterruptibly() 可中断 |
| 公平锁 | 非公平 | 可选公平/非公平 |
| 条件变量 | 只有一个 wait/notify | 可以有多个 Condition |
| 锁升级 | 偏向锁→轻量级锁→重量级锁 | 无 |

**synchronized 锁升级过程（JDK 1.6+）：**

```
无锁 → 偏向锁 → 轻量级锁（CAS 自旋）→ 重量级锁（OS 互斥量）

偏向锁：只有一个线程访问，在对象头记录线程 ID，无需 CAS
轻量级锁：有竞争但不激烈，CAS 自旋尝试获取
重量级锁：竞争激烈，线程阻塞挂起（涉及内核态切换）
```

---

## 2. volatile 关键字的作用？

- **可见性：** 一个线程修改 volatile 变量后，其他线程立即可见（强制从主内存读取）
- **禁止指令重排序：** 通过内存屏障防止编译器和 CPU 重排序
- **不保证原子性：** `i++` 不是原子操作，volatile 无法保证

**经典用法：DCL 单例模式**

```java
public class Singleton {
    private static volatile Singleton instance; // 必须加 volatile
    
    public static Singleton getInstance() {
        if (instance == null) {                  // 第一次检查（无锁）
            synchronized (Singleton.class) {
                if (instance == null) {           // 第二次检查（有锁）
                    instance = new Singleton();
                    // 这行实际分三步：① 分配内存 ② 初始化对象 ③ 引用指向内存
                    // 没有 volatile，② 和 ③ 可能重排序
                    // 另一个线程可能拿到未初始化的对象
                }
            }
        }
        return instance;
    }
}
```

---

## 3. 线程池参数详解？

```java
new ThreadPoolExecutor(
    corePoolSize,      // 核心线程数（不会被回收）
    maximumPoolSize,   // 最大线程数
    keepAliveTime,     // 非核心线程空闲存活时间
    TimeUnit.SECONDS,
    workQueue,         // 任务队列
    threadFactory,     // 线程工厂
    handler            // 拒绝策略
);
```

**执行流程：**

```
提交任务
  ↓
当前线程数 < corePoolSize？ ─── 是 ──→ 创建核心线程执行
  ↓ 否
任务队列未满？ ─── 是 ──→ 放入队列等待
  ↓ 否
当前线程数 < maximumPoolSize？ ─── 是 ──→ 创建非核心线程执行
  ↓ 否
执行拒绝策略
```

**四种拒绝策略：**

| 策略 | 行为 |
|------|------|
| AbortPolicy（默认） | 抛出 RejectedExecutionException |
| CallerRunsPolicy | 由提交任务的线程自己执行 |
| DiscardPolicy | 直接丢弃，不抛异常 |
| DiscardOldestPolicy | 丢弃队列中最老的任务，重新提交当前任务 |

**常见队列：**

| 队列 | 特点 |
|------|------|
| LinkedBlockingQueue | 无界（默认 Integer.MAX_VALUE），可能 OOM |
| ArrayBlockingQueue | 有界，需指定容量 |
| SynchronousQueue | 不存储任务，直接交给线程（Executors.newCachedThreadPool 用） |

**为什么不建议用 Executors 创建线程池？**
- `newFixedThreadPool` / `newSingleThreadExecutor`：用 LinkedBlockingQueue 无界队列，可能 OOM
- `newCachedThreadPool`：maximumPoolSize 为 Integer.MAX_VALUE，可能创建大量线程

---

## 4. ThreadLocal 原理？内存泄漏？

**原理：** 每个线程内部有一个 ThreadLocalMap，以 ThreadLocal 对象为 key，存储线程私有数据。

```
Thread 对象
  └── ThreadLocalMap
        ├── Entry(ThreadLocal_A → value_A)
        ├── Entry(ThreadLocal_B → value_B)
        └── ...
        
Entry 的 key 是 WeakReference<ThreadLocal>
```

**内存泄漏：**
- ThreadLocal 被回收后，key 变成 null（弱引用）
- 但 value 还被 Entry 强引用，无法回收
- 线程池中线程长期存活，value 一直不会被回收

**解决：** 用完后手动调用 `threadLocal.remove()`

---

## 5. AQS（AbstractQueuedSynchronizer）是什么？

AQS 是 Java 并发包的基础框架，ReentrantLock、Semaphore、CountDownLatch 都基于它。

**核心：**
- 一个 `int state` 变量（表示锁状态）
- 一个 FIFO 等待队列（CLH 队列变体）

```
state = 0：无锁
state = 1：已锁定
state > 1：重入次数

        ┌──────┐   ┌──────┐   ┌──────┐
HEAD ──►│Node A│──►│Node B│──►│Node C│  ← 等待队列
        │等待中 │   │等待中 │   │等待中 │
        └──────┘   └──────┘   └──────┘
```


---

# 十六、Java 并发补充

## 1. CAS 是什么？ABA 问题？

```
CAS（Compare And Swap）：
  比较并交换，CPU 原子指令

  CAS(内存值V, 预期值A, 新值B)
    如果 V == A：把 V 改成 B，返回 true
    如果 V != A：不修改，返回 false（说明被其他线程改了）

  特点：无锁，乐观锁思想
  应用：AtomicInteger、ConcurrentHashMap、AQS
```

**ABA 问题：**

```
线程1 读到 A → 准备改成 C
  线程2 把 A 改成 B
  线程2 又把 B 改成 A
线程1 CAS 发现值还是 A → 成功修改

值虽然相同，但中间经历了变化，可能导致问题

解决：AtomicStampedReference（带版本号）
  不仅比较值，还比较版本号
  每次修改版本号+1
```

---

## 2. CountDownLatch、CyclicBarrier、Semaphore？

```java
// CountDownLatch：倒计时器，等待多个线程完成
CountDownLatch latch = new CountDownLatch(3); // 计数器=3

// 三个线程分别执行
executor.submit(() -> { doTask(); latch.countDown(); }); // 计数-1
executor.submit(() -> { doTask(); latch.countDown(); });
executor.submit(() -> { doTask(); latch.countDown(); });

latch.await(); // 主线程阻塞，等计数器归零
System.out.println("三个任务都完成了");
// 一次性的，不能重置

// CyclicBarrier：栅栏，等待所有线程到达屏障点后一起继续
CyclicBarrier barrier = new CyclicBarrier(3, () -> {
    System.out.println("所有线程到齐，一起出发");
});

// 三个线程
executor.submit(() -> { prepare(); barrier.await(); go(); });
executor.submit(() -> { prepare(); barrier.await(); go(); });
executor.submit(() -> { prepare(); barrier.await(); go(); });
// 可重用（await 后自动重置）

// Semaphore：信号量，控制并发数
Semaphore semaphore = new Semaphore(3); // 最多3个线程同时执行

for (int i = 0; i < 10; i++) {
    executor.submit(() -> {
        semaphore.acquire(); // 获取许可（没有则阻塞）
        try {
            accessDatabase(); // 最多3个线程同时进入
        } finally {
            semaphore.release(); // 释放许可
        }
    });
}
// 应用：限流、数据库连接池
```

**对比：**

| 工具 | 用途 | 可重用 |
|------|------|--------|
| CountDownLatch | 一个等多个 | 否 |
| CyclicBarrier | 多个互相等 | 是 |
| Semaphore | 控制并发数 | - |

---

## 3. CompletableFuture（异步编排）

```java
// 异步执行
CompletableFuture<User> future = CompletableFuture.supplyAsync(() -> {
    return userService.getById(1L); // 在线程池中异步执行
});

// 链式处理
CompletableFuture.supplyAsync(() -> getUserInfo(userId))
    .thenApply(user -> getOrderList(user))       // 同步转换
    .thenApplyAsync(orders -> calculateTotal(orders)) // 异步转换
    .thenAccept(total -> log.info("总金额: {}", total)) // 消费结果
    .exceptionally(ex -> { log.error("异常", ex); return null; }); // 异常处理

// 多个异步任务并行
CompletableFuture<User> userFuture = CompletableFuture.supplyAsync(() -> getUser(id));
CompletableFuture<List<Order>> orderFuture = CompletableFuture.supplyAsync(() -> getOrders(id));
CompletableFuture<Account> accountFuture = CompletableFuture.supplyAsync(() -> getAccount(id));

// 等所有完成
CompletableFuture.allOf(userFuture, orderFuture, accountFuture).join();

// 取结果
User user = userFuture.get();
List<Order> orders = orderFuture.get();
Account account = accountFuture.get();

// 任一完成
CompletableFuture.anyOf(future1, future2).thenAccept(result -> { ... });

// 两个结果合并
userFuture.thenCombine(orderFuture, (user, orders) -> {
    return new UserOrderVO(user, orders);
});
```

---

## 4. 线程的生命周期（6 种状态）

```
     ┌──────────────────────────────────────────────────┐
     │                                                    │
     │   NEW ──start()──► RUNNABLE ◄──────────────────── │
     │                      │    ↑                        │
     │               ┌──────┴────┴──────┐                 │
     │               ↓                  ↓                 │
     │          BLOCKED           WAITING/TIMED_WAITING    │
     │     (等待获取锁)        (wait/sleep/join/park)      │
     │               │                  │                 │
     │               └──────┬───────────┘                 │
     │                      ↓                             │
     │                 TERMINATED（执行完毕）               │
     └──────────────────────────────────────────────────┘

NEW：           new Thread()，还没 start
RUNNABLE：      调用 start()，可能在运行也可能在等 CPU 时间片
BLOCKED：       等待获取 synchronized 锁
WAITING：       Object.wait()、Thread.join()、LockSupport.park()
TIMED_WAITING： Thread.sleep(ms)、wait(ms)、join(ms)
TERMINATED：    run() 方法执行结束
```

---

## 5. 死锁的条件和排查？

```
四个必要条件（缺一不可）：
  ① 互斥：资源只能被一个线程持有
  ② 持有并等待：持有资源的同时请求其他资源
  ③ 不可抢占：不能强制剥夺其他线程的资源
  ④ 循环等待：A 等 B，B 等 A

排查：
  ① jstack <pid>           查看线程堆栈
  ② jconsole / VisualVM    可视化检测死锁
  ③ 日志中线程长时间无响应

预防：
  ① 按固定顺序获取锁（打破循环等待）
  ② 设置超时时间：tryLock(timeout)
  ③ 减少锁的粒度和持有时间
```

```java
// 死锁示例
Object lockA = new Object();
Object lockB = new Object();

// 线程1
new Thread(() -> {
    synchronized (lockA) {
        Thread.sleep(100);
        synchronized (lockB) { ... } // 等 lockB
    }
}).start();

// 线程2
new Thread(() -> {
    synchronized (lockB) {
        Thread.sleep(100);
        synchronized (lockA) { ... } // 等 lockA
    }
}).start();
// 互相等待 → 死锁！
```

---

## 6. wait() 和 sleep() 的区别？

| 对比 | wait() | sleep() |
|------|--------|---------|
| 所属类 | Object | Thread |
| 是否释放锁 | **释放** | **不释放** |
| 使用位置 | 必须在 synchronized 内 | 任意位置 |
| 唤醒方式 | notify() / notifyAll() | 时间到自动唤醒 |
| 作用 | 线程间通信 | 暂停执行 |


---

# 二十七、Java 并发深入面试题

---

## 一、ConcurrentHashMap 计数原理

### 1. JDK 1.7 怎么统计元素个数？

```
JDK 1.7 结构：Segment[] 分段锁，每个 Segment 内部有 count

size() 策略：先乐观再悲观
  ① 不加锁尝试统计（最多 3 次）
     第 1 次遍历所有 Segment 求 count 之和 = sum1，记录 modCount 之和
     第 2 次再遍历，如果两次 modCount 一样（没人改过）→ 返回 sum2
     不一样 → 再试第 3 次
  ② 3 次都不一致 → 对所有 Segment 加锁 → 统计 → 解锁

  结果不是强一致的：返回后其他线程可能又修改了
```

### 2. JDK 1.8 怎么统计元素个数？（LongAdder 思想）

```
1.8 抛弃了 Segment，用 baseCount + CounterCell[] 计数，和 LongAdder 思想一样：

  private transient volatile long baseCount;
  private transient volatile CounterCell[] counterCells;

  @sun.misc.Contended  // 避免伪共享
  static final class CounterCell {
      volatile long value;
  }

put 时计数（addCount）：
  ① 先 CAS 更新 baseCount → 成功就结束
  ② CAS 失败（有竞争）→ 根据线程 hash 分散到 CounterCell[index]
  ③ CAS CounterCell → 成功就结束
  ④ 还失败 → 扩容 CounterCell 数组或重新 hash

size() 统计：
  return baseCount + 所有 CounterCell 的值之和
  和 LongAdder.sum() 一模一样，不是强一致的

优势：
  竞争分散到多个 Cell，每个线程操作自己的 Cell，几乎不冲突
  比 1.7 的加锁方案性能好得多
```

### 3. 什么是 LongAdder？和 AtomicLong 的区别？

```
LongAdder 是 JDK 1.8 新增的高性能计数器。

AtomicLong：所有线程 CAS 抢同一个 value → 高并发下大量 CAS 失败重试
LongAdder：一个 base + 多个 Cell，分散竞争

  竞争不激烈 → CAS 更新 base（和 AtomicLong 一样）
  竞争激烈   → 分散到不同的 Cell 各自累加
  求总数     → base + 所有 Cell 的值

  类比：
    AtomicLong = 一个收银台，所有人排一队
    LongAdder  = 多个收银台，各排各的，关门时合计

                    AtomicLong         LongAdder
  写入性能（高并发）  差（抢一个变量）    好（分散到 Cell）
  读取性能           O(1) 直接读        O(n) 遍历求和
  强一致性           是                 否
  适用场景           读多写少           写多读少（计数器、统计）

CounterCell 用 @Contended 注解做缓存行填充（64 字节），
防止多个 Cell 在同一个缓存行导致伪共享。
```

## 二、synchronized 深入

### 1. synchronized 锁升级过程？

```
JDK 1.6 引入锁升级机制，从低到高：

无锁 → 偏向锁 → 轻量级锁 → 重量级锁（不可降级）

【偏向锁】
  场景：只有一个线程访问
  实现：在对象头 Mark Word 中记录线程 ID
  第一次加锁 → 记录线程 ID
  下次同一个线程进来 → 发现是自己 → 直接进入，几乎零开销
  其他线程来竞争 → 撤销偏向锁 → 升级为轻量级锁

【轻量级锁】
  场景：两个线程交替访问（没有同时竞争）
  实现：CAS 将 Mark Word 复制到线程栈帧的 Lock Record，CAS 替换 Mark Word
  加锁 → CAS 成功 → 拿到锁
  CAS 失败 → 说明有竞争 → 自旋等待
  自旋超过一定次数还拿不到 → 升级为重量级锁

【重量级锁】
  场景：多个线程同时竞争
  实现：操作系统互斥量（Mutex），涉及用户态/内核态切换
  没拿到锁的线程 → 阻塞挂起（不消耗 CPU，但唤醒慢）

  为什么重量级锁慢？
    线程阻塞和唤醒需要从用户态切换到内核态
    一次切换大约需要几微秒
    而偏向锁/轻量级锁在用户态就能完成，几十纳秒
```

### 2. synchronized 和 ReentrantLock 的区别？

```
                    synchronized           ReentrantLock
实现              JVM 内置（monitorenter）    Java API（AQS）
锁释放            自动释放（出代码块）         手动 unlock()（必须 finally）
可中断            不可中断                    lockInterruptibly() 可中断
超时等待           不支持                     tryLock(timeout) 支持
公平锁            非公平                     可选公平/非公平
条件变量           一个（wait/notify）         多个 Condition
锁绑定            绑定对象/类                 绑定 Lock 对象

一般场景用 synchronized 就够了（JDK 1.6 优化后性能差不多）
需要高级功能（可中断、超时、公平锁、多条件）用 ReentrantLock
```

## 三、线程池深入

### 1. 线程池的 7 个参数？

```
new ThreadPoolExecutor(
    int corePoolSize,        // 核心线程数（即使空闲也不回收）
    int maximumPoolSize,     // 最大线程数
    long keepAliveTime,      // 非核心线程空闲存活时间
    TimeUnit unit,           // 时间单位
    BlockingQueue<Runnable> workQueue,  // 任务队列
    ThreadFactory threadFactory,        // 线程工厂（给线程起名字）
    RejectedExecutionHandler handler    // 拒绝策略
);
```

### 2. 线程池的执行流程？

```
提交任务
  │
  ▼
当前线程数 < corePoolSize？
  ├── 是 → 创建核心线程执行任务
  │
  └── 否 → 任务队列满了吗？
              ├── 没满 → 放入队列等待
              │
              └── 满了 → 当前线程数 < maximumPoolSize？
                          ├── 是 → 创建非核心线程执行任务
                          │
                          └── 否 → 执行拒绝策略

注意：是先放队列，队列满了才创建非核心线程！不是先创建线程！
```

### 3. 四种拒绝策略？

```
① AbortPolicy（默认）：直接抛 RejectedExecutionException
② CallerRunsPolicy：    由提交任务的线程自己执行（起到限流作用）
③ DiscardPolicy：       静默丢弃，不抛异常
④ DiscardOldestPolicy： 丢弃队列中最早的任务，然后重新提交当前任务

实际项目中常自定义拒绝策略：记录日志 + 持久化到数据库 + 告警
```

### 4. 线程池参数怎么设置？

```
CPU 密集型（计算多、IO少）：
  核心线程数 = CPU 核心数 + 1
  示例：8 核 → corePoolSize = 9

IO 密集型（网络请求、数据库查询多）：
  核心线程数 = CPU 核心数 × 2（或更多）
  示例：8 核 → corePoolSize = 16

实际项目中需要压测调整，以上只是参考值
```

