# 02 - 集合框架与数据结构

## 学习目标
- 源码级掌握 JDK 核心集合类
- 理解数据结构选型对性能的影响
- 能在生产中规避集合使用的常见陷阱

## 核心知识点
- **List**：`ArrayList` 扩容、`LinkedList` 双向链表、`CopyOnWriteArrayList`
- **Map**：
  - `HashMap`：哈希扰动、树化阈值、resize 并发死链（1.7）
  - `LinkedHashMap`：LRU 实现
  - `TreeMap`：红黑树原理
  - `ConcurrentHashMap`：1.7 分段锁 → 1.8 CAS+synchronized
  - `WeakHashMap`、`IdentityHashMap`、`EnumMap`
- **Set**：基于 Map 实现，`TreeSet` 有序、`LinkedHashSet` 插入有序
- **Queue/Deque**：`ArrayDeque`、`PriorityQueue`（堆）、`BlockingQueue` 七大实现
- **Fail-Fast vs Fail-Safe**：modCount 机制

## 实战任务
- [ ] 手写简易版 `HashMap`（含扩容与树化）
- [ ] 基于 `LinkedHashMap` 实现 LRU 缓存
- [ ] 对比 `ArrayList` 和 `LinkedList` 在不同场景的性能
- [ ] 压测 `ConcurrentHashMap` 1.7 vs 1.8

## 重要源码
- `java.util.HashMap#putVal`
- `java.util.concurrent.ConcurrentHashMap#putVal`
- `java.util.TreeMap#fixAfterInsertion`

## 参考资料
- 《Java并发编程的艺术》- 并发容器章节
- 美团技术博客：Java 8系列之重新认识HashMap
- 《算法导论》红黑树章节

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
