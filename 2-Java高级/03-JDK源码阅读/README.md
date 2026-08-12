# 03 - JDK源码阅读

## 学习目标
- 养成阅读源码的习惯与方法论
- 深度理解至少 20 个核心类
- 能从源码中汲取设计思想

## 阅读方法论
1. **带着问题读**：先有使用场景，再看实现
2. **画图**：类图、时序图、状态图
3. **调试跟读**：IDEA debug 关键路径
4. **写笔记**：用自己的话复述核心逻辑
5. **对比版本**：1.7 vs 1.8 vs 11 的演进

## 必读清单
### 集合（优先级⭐⭐⭐）
- [ ] `HashMap`、`LinkedHashMap`、`TreeMap`
- [ ] `ArrayList`、`LinkedList`
- [ ] `ConcurrentHashMap`、`CopyOnWriteArrayList`

### 并发（优先级⭐⭐⭐）
- [ ] `AbstractQueuedSynchronizer`
- [ ] `ReentrantLock`、`ReentrantReadWriteLock`
- [ ] `ThreadPoolExecutor`、`ScheduledThreadPoolExecutor`
- [ ] `CountDownLatch`、`Semaphore`、`CyclicBarrier`
- [ ] `CompletableFuture`

### 核心类
- [ ] `String`、`StringBuilder`、`StringBuffer`
- [ ] `Object`（`equals`/`hashCode`/`wait`/`notify`）
- [ ] `ThreadLocal`、`InheritableThreadLocal`
- [ ] `Thread`、`ThreadGroup`

### IO/NIO
- [ ] `FileInputStream`/`BufferedReader`
- [ ] `Channel`、`Buffer`、`Selector`

## 输出要求
每读完一个类，产出：
- 类图 + 核心方法时序图
- 5-10 个面试高频问题 + 答案
- 生产中的"坑"与最佳实践

## 参考资料
- 《JDK源码剖析》系列博客
- GitHub: `doocs/source-code-hunter`
- OpenJDK 源码

## 学习笔记
<!-- 每读一个类创建一篇笔记：YYYY-MM-DD-类名.md -->
