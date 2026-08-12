# 04 - 并发编程

## 学习目标
- 吃透 JMM 与 AQS 两大核心
- 源码级掌握 JUC 全家桶
- 能设计出高性能、线程安全的并发组件

## 核心知识点
- **JMM**：happens-before、volatile内存语义、内存屏障、伪共享
- **锁**：
  - `synchronized` 锁升级（偏向→轻量→重量）
  - `ReentrantLock`、`ReadWriteLock`、`StampedLock`
  - CAS、ABA问题、`AtomicStampedReference`
- **AQS**：独占/共享模式、Condition队列、模板方法
- **线程池**：
  - 7大参数、4种拒绝策略、4种工作队列
  - `ThreadPoolExecutor` 状态流转
  - `ScheduledThreadPoolExecutor`、`ForkJoinPool`
- **并发工具**：`CountDownLatch`、`CyclicBarrier`、`Semaphore`、`Phaser`
- **并发容器**：`ConcurrentHashMap`、`CopyOnWriteArrayList`、`BlockingQueue`
- **Disruptor**：无锁环形队列、伪共享优化

## 实战任务
- [ ] 手写简易线程池（含核心参数）
- [ ] 手写 AQS 实现一个自定义锁
- [ ] 对比 `synchronized` 各级别锁的性能
- [ ] 用 Disruptor 实现高性能事件处理

## 重要源码
- `java.util.concurrent.locks.AbstractQueuedSynchronizer`
- `java.util.concurrent.ThreadPoolExecutor`
- `java.util.concurrent.ConcurrentHashMap`

## 参考资料
- 《Java并发编程实战》（JCIP）
- 《Java并发编程的艺术》
- Doug Lea 论文：The java.util.concurrent Synchronizer Framework

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
