# Java 面试题整理（含答案）

---

# 一、Java 基础

## 1. HashMap 的底层原理？

**数据结构：** 数组 + 链表 + 红黑树（JDK 1.8+）

```
table[] 数组
  ┌───┬───┬───┬───┬───┬───┬───┬───┐
  │ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │
  └───┴─┬─┴───┴───┴─┬─┴───┴───┴───┘
        │           │
       [A]─→[B]─→[C]     链表（长度<8）
        │
     如果链表长度≥8 且数组长度≥64
        ↓
      红黑树（O(logN) 查找）
```

**put 过程：**
1. 对 key 计算 hash：`(h = key.hashCode()) ^ (h >>> 16)`（高16位异或低16位，减少碰撞）
2. 计算下标：`(n - 1) & hash`（等价于 hash % n，但位运算更快）
3. 如果该位置为空，直接放入
4. 如果不为空（哈希冲突）：
   - key 相同 → 覆盖 value
   - key 不同 → 尾插到链表（JDK 1.8；JDK 1.7 是头插，多线程会死循环）
5. 链表长度 ≥ 8 且数组长度 ≥ 64 → 转红黑树
6. 如果 size > threshold（capacity × loadFactor）→ 扩容为 2 倍

**为什么数组长度是 2 的幂？**
- 使 `(n - 1) & hash` 等价于取模，且位运算更快
- 扩容时元素要么在原位置，要么在 原位置 + 旧容量，不需要重新 hash

**线程不安全：** 多线程 put 可能数据丢失、死循环（JDK 1.7 头插法）。线程安全用 ConcurrentHashMap。

---

## 2. ConcurrentHashMap 怎么保证线程安全？

**JDK 1.7：** 分段锁（Segment），每个 Segment 是一个小的 HashMap，各自加锁，不同 Segment 互不影响。

**JDK 1.8：** CAS + synchronized
- 数组节点为空时：CAS 写入（无锁）
- 数组节点不为空时：synchronized 锁住该节点（只锁一个桶，粒度更细）
- 扩容时多线程协助迁移（transfer）

```
JDK 1.7:
┌──────────┬──────────┬──────────┐
│Segment 0 │Segment 1 │Segment 2 │  ← 每个 Segment 独立加锁
│ 锁1       │ 锁2      │ 锁3      │
│ [桶...]   │ [桶...]  │ [桶...]  │
└──────────┴──────────┴──────────┘

JDK 1.8:
┌───┬───┬───┬───┬───┬───┬───┬───┐
│ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │  ← 每个桶独立加 synchronized
│锁 │   │锁 │   │   │锁 │   │   │
└───┴───┴───┴───┴───┴───┴───┴───┘
```

---

## 3. ArrayList 和 LinkedList 的区别？

| 对比 | ArrayList | LinkedList |
|------|-----------|------------|
| 底层 | 动态数组 | 双向链表 |
| 随机访问 | O(1)，直接下标定位 | O(n)，需要遍历 |
| 头部插入/删除 | O(n)，需要移动元素 | O(1) |
| 尾部插入 | 均摊 O(1) | O(1) |
| 内存占用 | 连续内存，省空间 | 每个节点额外存前后指针 |
| 适用场景 | 读多写少 | 频繁插入删除 |

**实际开发中：** 绝大多数场景用 ArrayList，因为 CPU 缓存友好（连续内存），即使尾部以外的位置插入也比 LinkedList 快（常数因子小）。

---

## 4. String、StringBuilder、StringBuffer 的区别？

| 对比 | String | StringBuilder | StringBuffer |
|------|--------|---------------|-------------|
| 可变性 | 不可变（final char[]） | 可变 | 可变 |
| 线程安全 | 安全（不可变） | 不安全 | 安全（synchronized） |
| 性能 | 拼接慢（每次创建新对象） | 最快 | 比 StringBuilder 慢 |
| 适用 | 少量字符串操作 | 单线程大量拼接 | 多线程大量拼接 |

**面试追问：String 为什么设计成不可变？**
- 字符串常量池：相同内容可以共享，节省内存
- 线程安全：不可变天然线程安全
- hash 缓存：String 的 hashCode 可以缓存，HashMap 的 key 常用 String
- 安全性：网络连接、文件路径等如果可变会有安全风险

---

## 5. == 和 equals 的区别？

- `==`：比较**引用地址**（基本类型比较值）
- `equals`：比较**内容**（需要重写，否则默认还是 ==）

```java
String a = new String("hello");
String b = new String("hello");
a == b        // false（不同对象）
a.equals(b)   // true（内容相同）

String c = "hello";
String d = "hello";
c == d        // true（字符串常量池，同一个对象）
```

**重写 equals 必须重写 hashCode：** 否则在 HashMap 中会出问题——两个 equals 相等的对象可能被放到不同桶里。

---

## 6. 接口和抽象类的区别？

| 对比 | 接口 (interface) | 抽象类 (abstract class) |
|------|-----------------|----------------------|
| 多继承 | 可以实现多个 | 只能继承一个 |
| 构造方法 | 无 | 有 |
| 成员变量 | 只能 public static final | 任意 |
| 方法 | JDK 8+ 可以有 default/static 方法 | 可以有普通方法 |
| 设计理念 | "能做什么"（能力） | "是什么"（本质） |

---

## 7. Java 中的异常体系？

```
Throwable
  ├── Error（JVM 错误，程序无法处理）
  │     ├── OutOfMemoryError
  │     ├── StackOverflowError
  │     └── ...
  └── Exception
        ├── RuntimeException（非受检异常，不强制 try-catch）
        │     ├── NullPointerException
        │     ├── IndexOutOfBoundsException
        │     ├── ClassCastException
        │     ├── IllegalArgumentException
        │     └── ...
        └── 受检异常（编译时强制处理）
              ├── IOException
              ├── SQLException
              ├── ClassNotFoundException
              └── ...
```

---

## 8. final、finally、finalize 的区别？

- **final：** 修饰类（不可继承）、方法（不可重写）、变量（不可重新赋值，引用不可变但对象内容可变）
- **finally：** try-catch-finally 中一定会执行的代码块（除非 JVM 退出）
- **finalize：** Object 的方法，GC 回收对象前调用，已废弃（JDK 9+），不推荐使用

---

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

# 三、JVM

## 1. JVM 内存区域？

```
┌─────────────────────────────────────────────────┐
│                    JVM 内存                       │
│                                                   │
│  线程私有：                                        │
│  ┌───────────┐ ┌───────────┐ ┌──────────────┐   │
│  │ 程序计数器  │ │  虚拟机栈   │ │  本地方法栈    │   │
│  │ 当前指令地址│ │ 栈帧(局部变 │ │  Native 方法  │   │
│  │           │ │ 量/操作数栈)│ │              │   │
│  └───────────┘ └───────────┘ └──────────────┘   │
│                                                   │
│  线程共享：                                        │
│  ┌─────────────────────────────────────────────┐ │
│  │ 堆（Heap）                                    │ │
│  │  ┌──────────┐  ┌──────────────────────────┐ │ │
│  │  │  新生代    │  │         老年代             │ │ │
│  │  │ Eden + S0  │  │                          │ │ │
│  │  │     + S1   │  │                          │ │ │
│  │  └──────────┘  └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ 方法区 / 元空间（Metaspace，JDK 8+）          │ │
│  │  类信息、常量池、静态变量                       │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 2. 垃圾回收算法？

| 算法 | 过程 | 优缺点 |
|------|------|--------|
| 标记-清除 | 标记垃圾对象 → 直接清除 | 简单，但产生内存碎片 |
| 标记-整理 | 标记 → 存活对象向一端移动 → 清除边界外的 | 无碎片，但移动成本高 |
| 复制算法 | 内存分两半，存活对象复制到另一半 | 无碎片、快，但浪费一半空间 |
| 分代收集 | 新生代用复制算法，老年代用标记-清除/整理 | 综合最优，实际使用的方案 |

**新生代 GC（Minor GC）过程：**

```
Eden 满了 → 触发 Minor GC
  ↓
Eden + S0 中存活对象 → 复制到 S1
  ↓
清空 Eden + S0
  ↓
S0 和 S1 交换角色
  ↓
对象年龄+1，达到阈值（默认15）→ 晋升到老年代
```

---

## 3. 常见垃圾收集器？

| 收集器 | 区域 | 算法 | 特点 |
|--------|------|------|------|
| Serial | 新生代 | 复制 | 单线程，STW，客户端模式 |
| ParNew | 新生代 | 复制 | 多线程版 Serial |
| Parallel Scavenge | 新生代 | 复制 | 吞吐量优先 |
| CMS | 老年代 | 标记-清除 | 低延迟，但有碎片 |
| G1 | 整堆 | 分区+复制+标记整理 | 可预测停顿时间，JDK 9 默认 |
| ZGC | 整堆 | 染色指针 | 超低延迟（<1ms），JDK 15+ |

---

## 4. 哪些对象可以作为 GC Root？

- 虚拟机栈中引用的对象（局部变量）
- 方法区中静态变量引用的对象
- 方法区中常量引用的对象
- 本地方法栈中 JNI 引用的对象
- synchronized 持有的对象
- 活跃线程

---

## 5. OOM 排查思路？

```
① 看异常类型：
   Java heap space        → 堆内存不够
   Metaspace              → 类太多 / 动态代理过多
   unable to create thread → 线程过多
   
② 堆内存 OOM 排查：
   jmap -dump:format=b,file=heap.hprof <pid>    导出堆快照
   用 MAT / VisualVM 分析
   → 找到占用最大的对象
   → 看引用链，定位泄漏点

③ 常见原因：
   - 大集合未清理
   - 缓存无上限
   - ThreadLocal 未 remove
   - 数据库查询未分页，一次查几百万条
```

---

# 四、Spring / Spring Boot

## 1. Spring IOC 和 AOP？

**IOC（控制反转）：** 对象的创建和依赖关系由 Spring 容器管理，而不是程序员 new。

```
传统方式：UserService service = new UserServiceImpl();  // 自己创建
IOC 方式：@Autowired UserService service;              // 容器注入
```

**AOP（面向切面编程）：** 将横切关注点（日志、事务、权限）从业务逻辑中分离。

```
请求 → [日志切面] → [权限切面] → [事务切面] → 业务方法 → 返回
                                                    
不用 AOP：每个方法里都要写日志、事务代码
用 AOP：  统一定义一次，自动应用到所有需要的方法
```

**AOP 核心概念：**
- **切面（Aspect）：** 横切关注点的模块化（如 @Aspect 类）
- **切点（Pointcut）：** 定义在哪些方法上生效（如 `@annotation(xxx)` 或 `execution(...)`）
- **通知（Advice）：** 切面的具体逻辑
  - `@Before`：方法前
  - `@After`：方法后（无论是否异常）
  - `@AfterReturning`：方法正常返回后
  - `@AfterThrowing`：方法异常后
  - `@Around`：环绕，最强大

**Spring AOP 实现原理：** 动态代理
- 目标类实现了接口 → JDK 动态代理（基于接口）
- 目标类没有接口 → CGLIB 代理（基于继承，生成子类）

---

## 2. Spring Bean 的生命周期？

```
① 实例化：new 对象（反射）
  ↓
② 属性填充：@Autowired 注入依赖
  ↓
③ Aware 接口回调：BeanNameAware、ApplicationContextAware 等
  ↓
④ BeanPostProcessor.postProcessBeforeInitialization()
  ↓
⑤ 初始化：@PostConstruct → InitializingBean.afterPropertiesSet() → init-method
  ↓
⑥ BeanPostProcessor.postProcessAfterInitialization()
  （AOP 代理就是在这里生成的）
  ↓
⑦ 使用
  ↓
⑧ 销毁：@PreDestroy → DisposableBean.destroy() → destroy-method
```

---

## 3. Spring 循环依赖怎么解决？

**三级缓存：**

```
singletonObjects        （一级）完全初始化好的 Bean
earlySingletonObjects   （二级）提前暴露的 Bean（已实例化，未填充属性）
singletonFactories      （三级）Bean 工厂（用于创建代理对象）
```

**解决过程（A 依赖 B，B 依赖 A）：**

```
① 创建 A → 实例化 A → 把 A 的工厂放入三级缓存
② 填充 A 的属性 → 发现需要 B
③ 创建 B → 实例化 B → 把 B 的工厂放入三级缓存
④ 填充 B 的属性 → 发现需要 A
⑤ 从三级缓存找到 A 的工厂 → 创建 A 的早期引用 → 放入二级缓存
⑥ B 拿到 A 的早期引用 → B 初始化完成 → 放入一级缓存
⑦ A 拿到 B → A 初始化完成 → 放入一级缓存
```

**注意：** 构造器注入的循环依赖无法解决（因为实例化都完不成），用 `@Lazy` 延迟加载可以解决。

---

## 4. Spring 事务失效的场景？

| 场景 | 原因 |
|------|------|
| 方法不是 public | Spring AOP 代理只能拦截 public 方法 |
| 自调用（this.method()） | 没走代理，直接调用了目标对象的方法 |
| 异常被 catch 了 | 事务看不到异常，不会回滚 |
| 抛出非 RuntimeException | 默认只回滚 RuntimeException 和 Error |
| 数据库引擎不支持 | MyISAM 不支持事务，要用 InnoDB |
| Bean 没被 Spring 管理 | 没加 @Service / @Component |
| 传播行为设置不当 | REQUIRES_NEW 会开新事务，NOT_SUPPORTED 不用事务 |

**自调用解决方案：**

```java
// 方案 1：注入自己
@Service
public class UserService {
    @Autowired
    private UserService self; // 注入的是代理对象

    public void methodA() {
        self.methodB(); // 通过代理调用，事务生效
    }

    @Transactional
    public void methodB() { ... }
}

// 方案 2：AopContext
((UserService) AopContext.currentProxy()).methodB();
```

---

## 5. Spring Boot 自动配置原理？

```
@SpringBootApplication
  ├── @SpringBootConfiguration    （= @Configuration）
  ├── @EnableAutoConfiguration    （核心：开启自动配置）
  │     └── @Import(AutoConfigurationImportSelector.class)
  │           → 读取 META-INF/spring.factories
  │           → 加载所有 xxxAutoConfiguration 类
  │           → @ConditionalOnXxx 条件判断：
  │               @ConditionalOnClass        类路径有某个类才生效
  │               @ConditionalOnBean         容器有某个 Bean 才生效
  │               @ConditionalOnProperty     配置属性满足条件才生效
  │               @ConditionalOnMissingBean  容器没有某个 Bean 才生效
  └── @ComponentScan              （扫描当前包及子包）
```

**白话：** 引入 starter 依赖 → 类路径下有了相关的类 → @ConditionalOnClass 成立 → 自动配置类生效 → 自动创建并配置好 Bean。比如引入 `spring-boot-starter-data-redis`，Redis 相关的 Bean 就自动配好了。

---

# 五、MyBatis

## 1. #{} 和 ${} 的区别？

| 对比 | #{} | ${} |
|------|-----|-----|
| 方式 | 预编译（PreparedStatement） | 字符串拼接 |
| SQL 注入 | **安全**，参数用 ? 占位 | **不安全**，直接拼入 SQL |
| 用途 | 传值（where id = #{id}） | 传列名、表名（order by ${column}） |

```sql
-- #{id} 编译后：
SELECT * FROM user WHERE id = ?

-- ${column} 编译后：
SELECT * FROM user ORDER BY create_time
-- 如果传入 "create_time; DROP TABLE user" → SQL 注入！
```

---

## 2. MyBatis 的一级缓存和二级缓存？

| 对比 | 一级缓存 | 二级缓存 |
|------|---------|---------|
| 范围 | SqlSession 级别 | Mapper（namespace）级别 |
| 默认 | 开启 | 关闭 |
| 失效 | 执行 update/insert/delete、不同 SqlSession | 对应 namespace 的 update 操作 |
| 存储 | HashMap（内存） | 可配置（内存/Redis/Ehcache） |

**注意：** Spring 整合 MyBatis 后，每次请求一个新 SqlSession，一级缓存基本无效。

---

## 3. MyBatis 插件（拦截器）原理？

MyBatis 允许拦截四大对象的方法：
- **Executor：** 执行器（update、query）
- **StatementHandler：** SQL 预处理（prepare、parameterize）
- **ParameterHandler：** 参数设置
- **ResultSetHandler：** 结果集处理

```java
@Intercepts({
    @Signature(type = StatementHandler.class, method = "prepare",
               args = {Connection.class, Integer.class})
})
public class MyPlugin implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        // 在 SQL 执行前做些事情（如数据权限、分页）
        StatementHandler handler = (StatementHandler) invocation.getTarget();
        BoundSql boundSql = handler.getBoundSql();
        String sql = boundSql.getSql();
        // 改写 SQL ...
        return invocation.proceed(); // 继续执行
    }
}
```

**原理：** JDK 动态代理，对四大对象层层包装。

---

# 六、MySQL

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

# 七、Redis

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

# 八、Spring Cloud 微服务

## 1. 微服务核心组件？

```
┌────────────────────────────────────────────────┐
│                  微服务架构                       │
│                                                  │
│  ┌──────────┐    ┌──────────────────────────┐  │
│  │  Nacos    │    │       Gateway            │  │
│  │ 注册中心   │    │  统一入口/路由/限流/鉴权  │  │
│  │ 配置中心   │    └──────────────────────────┘  │
│  └──────────┘               ↓                   │
│       ↑注册/发现      ┌─────┼─────┐              │
│       │         ┌─────┴┐ ┌─┴────┐ ┌┴─────┐     │
│       ├─────────│服务A  │ │服务B │ │服务C │      │
│       │         │      │→│      │ │      │      │
│       │         └──────┘ └──────┘ └──────┘      │
│       │           Feign（服务间调用）              │
│       │           Sentinel（熔断限流）            │
│       │           Sleuth+Zipkin（链路追踪）       │
└────────────────────────────────────────────────┘
```

| 组件 | 作用 |
|------|------|
| Nacos | 服务注册发现 + 配置中心 |
| Gateway | 统一网关（路由、限流、鉴权） |
| OpenFeign | 声明式 HTTP 客户端（服务间调用） |
| Sentinel | 熔断降级、流量控制 |
| Sleuth + Zipkin | 分布式链路追踪 |
| Seata | 分布式事务 |

---

## 2. Sentinel 熔断降级原理？

```
三种熔断策略：

① 慢调用比例：响应时间超过阈值的比例达到设定值 → 熔断
② 异常比例：异常请求比例超过阈值 → 熔断
③ 异常数：异常请求数超过阈值 → 熔断

熔断状态机：
  CLOSED（正常） → 达到阈值 → OPEN（熔断，直接拒绝）
                                ↓ 经过恢复时间
                            HALF_OPEN（半开，放一个请求试探）
                                ↓ 成功 → CLOSED
                                ↓ 失败 → OPEN
```

---

## 3. 分布式事务方案？

| 方案 | 原理 | 一致性 | 性能 | 适用 |
|------|------|--------|------|------|
| 2PC（两阶段提交） | 协调者统一提交/回滚 | 强一致 | 差（同步阻塞） | XA 事务 |
| TCC | Try→Confirm/Cancel | 最终一致 | 中 | 资金类 |
| SAGA | 正向操作+补偿操作 | 最终一致 | 好 | 长事务 |
| 本地消息表 | 本地事务+消息表+定时任务 | 最终一致 | 好 | 常见 |
| 消息事务 | RocketMQ 事务消息 | 最终一致 | 好 | 解耦场景 |
| Seata AT | 自动生成回滚 SQL | 最终一致 | 好 | 通用 |

---

# 九、消息队列

## 1. 为什么用消息队列？

- **解耦：** 上游不需要知道下游有多少消费者
- **异步：** 耗时操作异步处理，快速响应用户
- **削峰：** 突发流量先进队列，消费者按自己速率处理

---

## 2. 如何保证消息不丢失？

```
三个环节都可能丢消息：

① 生产者 → MQ：
   - 确认机制（RabbitMQ: confirm / RocketMQ: 同步发送+重试）
   
② MQ 自身：
   - 持久化（消息写磁盘）
   - 集群（主从/多副本）
   
③ MQ → 消费者：
   - 手动 ACK（处理完再确认，而不是收到就确认）
   - 如果处理失败，消息重新入队
```

---

## 3. 如何保证消息不重复消费（幂等）？

```
消息可能重复的原因：
  网络波动导致 ACK 丢失 → MQ 重新投递

解决（消费端幂等）：
  ① 数据库唯一约束（如订单号唯一索引）
  ② Redis Set 记录已消费的消息 ID
  ③ 状态机控制（订单状态只能单向流转）
```

---

## 4. 如何保证消息顺序？

```
RocketMQ：
  同一个订单的消息发到同一个 MessageQueue（按订单ID取模）
  一个 MessageQueue 只被一个消费者消费

RabbitMQ：
  同一个业务的消息发到同一个 Queue
  一个 Queue 只被一个消费者消费
```

---

# 十、设计模式

## 1. 单例模式

```java
// 最推荐：静态内部类（懒加载 + 线程安全）
public class Singleton {
    private Singleton() {}
    
    private static class Holder {
        private static final Singleton INSTANCE = new Singleton();
    }
    
    public static Singleton getInstance() {
        return Holder.INSTANCE;
    }
}

// 枚举方式（防反射、防序列化）
public enum Singleton {
    INSTANCE;
}
```

---

## 2. 工厂模式

```java
// 简单工厂
public class PayFactory {
    public static PayService create(String type) {
        switch (type) {
            case "alipay": return new AlipayService();
            case "wechat": return new WechatPayService();
            default: throw new IllegalArgumentException();
        }
    }
}
```

---

## 3. 策略模式

```java
// 消除 if-else
public interface PayStrategy {
    void pay(BigDecimal amount);
}

@Component("alipay")
public class AlipayStrategy implements PayStrategy { ... }

@Component("wechat")
public class WechatPayStrategy implements PayStrategy { ... }

// 使用
@Autowired
private Map<String, PayStrategy> strategyMap; // Spring 自动注入所有实现

public void pay(String type, BigDecimal amount) {
    strategyMap.get(type).pay(amount);
}
```

---

## 4. 观察者模式（Spring 事件机制）

```java
// 事件
public class OrderCreatedEvent extends ApplicationEvent {
    private Order order;
    public OrderCreatedEvent(Object source, Order order) {
        super(source);
        this.order = order;
    }
}

// 发布
applicationContext.publishEvent(new OrderCreatedEvent(this, order));

// 监听
@EventListener
public void onOrderCreated(OrderCreatedEvent event) {
    // 发短信、扣库存、记日志...
}
```

---

## 5. 模板方法模式

```java
public abstract class AbstractExportService {
    
    // 模板方法，定义骨架
    public final void export() {
        queryData();
        processData();
        writeFile();
    }
    
    protected abstract List<?> queryData();      // 子类实现
    protected abstract void processData();        // 子类实现
    
    private void writeFile() {
        // 通用逻辑
    }
}
```

---

# 十一、场景题

## 1. 如何设计一个接口的幂等？

```
方案一：Token 机制
  ① 请求前先获取一个 Token（存 Redis，一次性）
  ② 请求时带上 Token
  ③ 服务端验证 Token 存在 → 删除 Token + 处理业务
  ④ 重复请求时 Token 已不存在 → 拒绝

方案二：数据库唯一约束
  订单表 order_no 加唯一索引 → 重复插入直接报错

方案三：乐观锁
  UPDATE account SET balance = balance - 100
  WHERE id = 1 AND version = 1
  → 第一次成功（version 变成 2），第二次失败（version 不匹配）

方案四：Redis SETNX
  SETNX request:{requestId} 1 EX 300
  → 第一次成功，第二次 NX 失败
```

---

## 2. 如何设计一个分布式 ID？

| 方案 | 优点 | 缺点 |
|------|------|------|
| UUID | 简单，无需中心节点 | 无序，不适合做主键（B+树分裂） |
| 数据库自增 | 简单，有序 | 单点瓶颈 |
| Redis INCR | 高性能 | 依赖 Redis |
| 雪花算法（Snowflake） | 有序、高性能、不依赖第三方 | 时钟回拨问题 |

**雪花算法结构：**

```
0 - 41位时间戳 - 10位机器ID - 12位序列号

  1位符号 │     41位时间戳      │ 5位数据中心 │ 5位机器ID │  12位序列号
    0     │ 毫秒级时间戳(69年)   │   0-31     │  0-31    │  0-4095/毫秒
```

---

## 3. 大表分页查询优化？

```sql
-- 原始（慢）：OFFSET 越大越慢，因为要扫描并丢弃前面的行
SELECT * FROM orders ORDER BY id LIMIT 10 OFFSET 1000000;

-- 优化一：游标分页（推荐）
SELECT * FROM orders WHERE id > 1000000 ORDER BY id LIMIT 10;

-- 优化二：延迟关联
SELECT o.* FROM orders o
INNER JOIN (SELECT id FROM orders ORDER BY id LIMIT 10 OFFSET 1000000) t
ON o.id = t.id;
-- 子查询只查 id（覆盖索引），再用 id 关联取完整数据
```

---

## 4. 如何设计一个秒杀系统？

```
                    ┌─────────┐
                    │  CDN    │  静态资源
                    └────┬────┘
                         ↓
                    ┌─────────┐
                    │  Nginx  │  限流（令牌桶）
                    └────┬────┘
                         ↓
              ┌──────────────────────┐
              │      Gateway         │  黑名单、参数校验
              └──────────┬───────────┘
                         ↓
              ┌──────────────────────┐
              │   秒杀服务            │
              │  ① Redis 预减库存     │  DECR stock → <0 则失败
              │  ② 发消息到 MQ       │  异步下单
              └──────────┬───────────┘
                         ↓
              ┌──────────────────────┐
              │   订单服务（MQ消费者） │
              │  ① 校验库存           │
              │  ② 创建订单           │
              │  ③ 扣减库存（乐观锁） │
              └──────────────────────┘

核心思路：
  - 尽量把请求挡在上游（CDN → Nginx → Gateway）
  - Redis 原子操作预扣库存，挡住超卖
  - MQ 异步下单，削峰
  - 数据库乐观锁兜底
```

---

# 十二、网络基础（高频）

## 1. TCP 三次握手 / 四次挥手？

（详见 HTTP请求完整链路详解.md）

---

## 2. HTTP 和 HTTPS 的区别？

| 对比 | HTTP | HTTPS |
|------|------|-------|
| 端口 | 80 | 443 |
| 安全 | 明文传输 | TLS/SSL 加密 |
| 证书 | 不需要 | 需要 CA 证书 |
| 性能 | 快 | 稍慢（TLS 握手开销） |

---

## 3. GET 和 POST 的区别？

| 对比 | GET | POST |
|------|-----|------|
| 参数位置 | URL 中（?key=value） | 请求体中 |
| 长度限制 | 浏览器限制 URL 长度（约 2KB） | 无限制 |
| 缓存 | 可缓存 | 默认不缓存 |
| 幂等性 | 幂等（多次请求结果相同） | 非幂等 |
| 安全性 | 参数暴露在 URL | 相对安全（但不加密也能抓包） |
| 书签/历史 | 可保存 | 不可保存 |

**本质区别：** 语义不同。GET 用于获取资源，POST 用于提交数据。技术上 GET 也能带 body，POST 也能用 URL 参数，但不规范。

---

## 4. Cookie、Session、Token 的区别？

```
Cookie：
  - 存在浏览器端
  - 每次请求自动携带
  - 可设置过期时间、HttpOnly、Secure
  - 大小限制 4KB

Session：
  - 存在服务器端
  - 通过 Cookie 中的 SessionID 关联
  - 服务器重启/集群环境需要共享（Redis）

Token（JWT）：
  - 服务器生成，客户端保存
  - 无状态，服务器不需要存储
  - 包含用户信息（Base64 编码，不是加密）
  - 通过签名防篡改

Session vs Token：
  Session：有状态，服务器要存储，集群需要共享
  Token：  无状态，服务器不存储，天然支持分布式
```

---

# 十三、项目与场景面试题

## 1. OAuth2 授权码模式流程？

```
① 用户访问客户端应用
② 客户端重定向到授权服务器（/oauth/authorize）
③ 用户登录并授权
④ 授权服务器重定向回客户端，携带授权码（code）
⑤ 客户端用 code 向授权服务器换取 access_token（后端请求）
⑥ 客户端用 access_token 访问资源服务器

为什么要先返回 code 再换 token？
  → code 通过浏览器重定向传递（前端可见）
  → token 通过后端直接请求获取（前端不可见）
  → 防止 token 暴露在浏览器地址栏
```

---

## 2. 数据权限怎么实现？

```
① 自定义注解 @DataPermissions，标注在 Mapper 方法上
② AOP 切面拦截注解，将权限配置写入 ThreadLocal
③ MyBatis 拦截器在 SQL 执行前读取 ThreadLocal
④ 动态改写 SQL，追加数据权限条件（如 AND dept_id IN (...)）
⑤ 请求结束后清理 ThreadLocal

优势：
  - 业务代码零侵入
  - 支持多种权限类型（本单位、本单位及子级、个人等）
  - 通过注解灵活配置表名、限制字段
```

---

## 3. SSO 单点登录原理？

```
① 用户访问系统 A → 未登录 → 重定向到认证中心
② 认证中心：用户登录 → 生成全局 Session + Token
③ 重定向回系统 A，携带 Token
④ 系统 A 用 Token 换取用户信息 → 创建局部 Session
⑤ 用户访问系统 B → 未登录 → 重定向到认证中心
⑥ 认证中心检测到全局 Session 已存在 → 直接返回 Token
⑦ 系统 B 用 Token 换取用户信息 → 免登录
```

---

# 十四、Java 8 新特性（高频）

## 1. Lambda 表达式

```java
// 传统写法
new Thread(new Runnable() {
    @Override
    public void run() {
        System.out.println("hello");
    }
}).start();

// Lambda
new Thread(() -> System.out.println("hello")).start();

// 本质：函数式接口（只有一个抽象方法的接口）的匿名实现
// @FunctionalInterface 标注
```

**常用函数式接口：**

| 接口 | 方法 | 用途 | 示例 |
|------|------|------|------|
| `Supplier<T>` | `T get()` | 无参有返回 | `() -> new User()` |
| `Consumer<T>` | `void accept(T)` | 有参无返回 | `user -> System.out.println(user)` |
| `Function<T,R>` | `R apply(T)` | 有参有返回 | `s -> s.length()` |
| `Predicate<T>` | `boolean test(T)` | 有参返回布尔 | `s -> s.isEmpty()` |
| `BiFunction<T,U,R>` | `R apply(T,U)` | 两参有返回 | `(a,b) -> a + b` |

---

## 2. Stream API

```java
List<User> users = userList.stream()
    .filter(u -> u.getAge() > 18)           // 过滤
    .filter(u -> "广州".equals(u.getCity())) // 多条件
    .sorted(Comparator.comparing(User::getAge).reversed()) // 排序（倒序）
    .distinct()                              // 去重
    .skip(5)                                 // 跳过前5个
    .limit(10)                               // 取10个
    .collect(Collectors.toList());           // 收集为 List

// 常用终端操作
long count = list.stream().filter(...).count();                    // 计数
Optional<User> first = list.stream().filter(...).findFirst();     // 第一个
boolean anyMatch = list.stream().anyMatch(u -> u.getAge() > 18); // 任意匹配
boolean allMatch = list.stream().allMatch(u -> u.getAge() > 18); // 全部匹配

// 分组
Map<String, List<User>> byCity = list.stream()
    .collect(Collectors.groupingBy(User::getCity));

// 分组计数
Map<String, Long> countByCity = list.stream()
    .collect(Collectors.groupingBy(User::getCity, Collectors.counting()));

// map 转换
List<String> names = list.stream()
    .map(User::getName)
    .collect(Collectors.toList());

// flatMap 扁平化
List<String> allTags = articles.stream()
    .flatMap(a -> a.getTags().stream())  // 每篇文章的标签列表展开成一个流
    .distinct()
    .collect(Collectors.toList());

// reduce 聚合
int totalAge = list.stream()
    .map(User::getAge)
    .reduce(0, Integer::sum);

// toMap
Map<Long, User> userMap = list.stream()
    .collect(Collectors.toMap(User::getId, Function.identity(),
        (existing, replacement) -> existing)); // 第三个参数处理 key 冲突

// joining
String nameStr = list.stream()
    .map(User::getName)
    .collect(Collectors.joining(", ")); // "张三, 李四, 王五"
```

**Stream 的惰性求值：** 中间操作（filter、map）不会立即执行，只有终端操作（collect、count、forEach）才会触发整个流水线执行。

**parallelStream：** 并行流，底层用 ForkJoinPool，适合 CPU 密集型大数据量处理。注意线程安全问题，不要在并行流中修改共享变量。

---

## 3. Optional

```java
// 避免 NullPointerException 的利器

// 创建
Optional<User> opt = Optional.ofNullable(user);     // 可能为 null
Optional<User> opt2 = Optional.of(user);             // 确定不为 null
Optional<User> opt3 = Optional.empty();              // 空

// 使用
String name = Optional.ofNullable(user)
    .map(User::getDept)
    .map(Dept::getName)
    .orElse("未知部门");    // 为空则返回默认值

// orElseGet（惰性求值，推荐）
String name = Optional.ofNullable(user)
    .map(User::getName)
    .orElseGet(() -> getDefaultName());  // 只有为空时才调用

// orElseThrow
User u = Optional.ofNullable(user)
    .orElseThrow(() -> new BusinessException("用户不存在"));

// ifPresent
Optional.ofNullable(user).ifPresent(u -> sendEmail(u));

// filter
Optional.ofNullable(user)
    .filter(u -> u.getAge() > 18)
    .ifPresent(u -> process(u));
```

---

## 4. 接口的 default 方法和 static 方法

```java
public interface MyInterface {
    // 抽象方法（必须实现）
    void doSomething();
    
    // default 方法（有默认实现，子类可选择覆盖）
    default void doDefault() {
        System.out.println("默认实现");
    }
    
    // static 方法（只能通过接口名调用）
    static void doStatic() {
        System.out.println("静态方法");
    }
}

// 解决了接口新增方法时所有实现类必须改的问题
// 比如 List 接口在 JDK 8 新增了 sort() 方法，就是用 default 实现的
```

---

## 5. 新的日期时间 API

```java
// 旧 API 的问题：Date 可变、线程不安全、月份从 0 开始
// 新 API（java.time 包）：不可变、线程安全

LocalDate date = LocalDate.now();                    // 2026-04-12
LocalDate date2 = LocalDate.of(2026, 4, 12);        // 指定日期
LocalTime time = LocalTime.now();                    // 06:00:00
LocalDateTime dateTime = LocalDateTime.now();         // 日期+时间
ZonedDateTime zdt = ZonedDateTime.now();             // 带时区

// 计算
LocalDate tomorrow = date.plusDays(1);
LocalDate lastMonth = date.minusMonths(1);
long daysBetween = ChronoUnit.DAYS.between(date, date2);

// 格式化
DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
String str = dateTime.format(fmt);
LocalDateTime parsed = LocalDateTime.parse(str, fmt);
```

---

# 十五、Java 基础补充

## 1. Java 反射

```java
// 获取 Class 对象的三种方式
Class<?> clazz1 = Class.forName("com.example.User");
Class<?> clazz2 = User.class;
Class<?> clazz3 = user.getClass();

// 创建实例
Object obj = clazz.getDeclaredConstructor().newInstance();

// 获取并调用方法
Method method = clazz.getDeclaredMethod("setName", String.class);
method.setAccessible(true);  // 访问私有方法
method.invoke(obj, "张三");

// 获取并设置字段
Field field = clazz.getDeclaredField("name");
field.setAccessible(true);
field.set(obj, "李四");
String name = (String) field.get(obj);

// 获取注解
MyAnnotation annotation = method.getAnnotation(MyAnnotation.class);
```

**反射的应用场景：**
- Spring IOC（通过反射创建 Bean、注入依赖）
- MyBatis Mapper 代理（动态代理 + 反射调用）
- JSON 序列化/反序列化（Jackson 反射读写字段）
- 自定义注解处理

**反射的性能问题：**
- 比直接调用慢 10-50 倍
- 优化：缓存 Method/Field 对象、使用 MethodHandle（JDK 7+）

---

## 2. Java 泛型

```java
// 泛型类
public class Result<T> {
    private T data;
    public T getData() { return data; }
}

// 泛型方法
public <T> List<T> toList(T... items) {
    return Arrays.asList(items);
}

// 通配符
List<?>             // 无界通配符（只读）
List<? extends Number>  // 上界通配符（协变，只读）——Number 及其子类
List<? super Integer>   // 下界通配符（逆变，只写）——Integer 及其父类

// PECS 原则：Producer Extends, Consumer Super
// 要读取（生产数据）→ 用 extends
// 要写入（消费数据）→ 用 super
```

**类型擦除：** 泛型只在编译期检查，运行时会被擦除为 Object（或上界类型）。所以：
- 不能 `new T()`
- 不能 `instanceof List<String>`
- `List<String>` 和 `List<Integer>` 运行时是同一个类型

---

## 3. Java 序列化

```java
// Java 序列化
public class User implements Serializable {
    private static final long serialVersionUID = 1L; // 版本号，反序列化时校验
    private String name;
    private transient String password; // transient：不序列化
}

// 序列化
ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("user.dat"));
oos.writeObject(user);

// 反序列化
ObjectInputStream ois = new ObjectInputStream(new FileInputStream("user.dat"));
User user = (User) ois.readObject();
```

**serialVersionUID 的作用：**
- 反序列化时比较这个值，不一致则抛 InvalidClassException
- 如果不显式声明，JVM 会根据类结构自动生成
- 类改了字段后自动生成的 ID 会变，导致旧数据反序列化失败

**实际开发中更多用 JSON 序列化（Jackson/Gson/Fastjson），而不是 Java 原生序列化。**

---

## 4. Java 中创建线程的几种方式？

```java
// 方式 1：继承 Thread
class MyThread extends Thread {
    @Override
    public void run() { ... }
}
new MyThread().start();

// 方式 2：实现 Runnable（推荐，可以多实现）
new Thread(() -> { ... }).start();

// 方式 3：实现 Callable + FutureTask（有返回值）
FutureTask<String> task = new FutureTask<>(() -> {
    return "result";
});
new Thread(task).start();
String result = task.get(); // 阻塞等待结果

// 方式 4：线程池（实际开发推荐）
ExecutorService pool = new ThreadPoolExecutor(...);
pool.submit(() -> { ... });
pool.execute(() -> { ... });
```

---

## 5. 深拷贝和浅拷贝？

```
浅拷贝：只复制对象本身，不复制引用的对象
  原对象 → [name="张三", dept → DeptObj]
  拷贝后 → [name="张三", dept → DeptObj]  ← dept 指向同一个对象
  修改拷贝的 dept.name，原对象也会变

深拷贝：复制对象及其所有引用的对象
  原对象 → [name="张三", dept → DeptObj_A]
  拷贝后 → [name="张三", dept → DeptObj_B]  ← dept 是新对象
  修改互不影响
```

**实现深拷贝：**

```java
// 方式 1：序列化/反序列化
ByteArrayOutputStream bos = new ByteArrayOutputStream();
new ObjectOutputStream(bos).writeObject(original);
Object copy = new ObjectInputStream(
    new ByteArrayInputStream(bos.toByteArray())).readObject();

// 方式 2：JSON 转换（简单实用）
String json = objectMapper.writeValueAsString(original);
User copy = objectMapper.readValue(json, User.class);

// 方式 3：手动递归 clone（麻烦但精确）
```

---

## 6. Java 中的集合框架总览

```
Collection（单列集合）
  ├── List（有序，可重复）
  │     ├── ArrayList      动态数组，查快增删慢
  │     ├── LinkedList     双向链表，增删快查慢
  │     ├── Vector         线程安全的 ArrayList（过时）
  │     └── CopyOnWriteArrayList  写时复制，读多写少场景
  │
  ├── Set（无序，不重复）
  │     ├── HashSet         基于 HashMap
  │     ├── LinkedHashSet   保持插入顺序
  │     └── TreeSet         红黑树，有序
  │
  └── Queue（队列）
        ├── LinkedList      双端队列
        ├── PriorityQueue   优先队列（堆）
        ├── ArrayDeque      双端队列（比 LinkedList 快）
        └── BlockingQueue   阻塞队列
              ├── ArrayBlockingQueue
              ├── LinkedBlockingQueue
              └── SynchronousQueue

Map（双列集合，键值对）
  ├── HashMap              哈希表，最常用
  ├── LinkedHashMap        保持插入顺序（或访问顺序→LRU缓存）
  ├── TreeMap              红黑树，按 key 有序
  ├── Hashtable            线程安全（过时）
  ├── ConcurrentHashMap    线程安全（推荐）
  └── WeakHashMap          弱引用 key，可被 GC 回收
```

---

## 7. HashSet 为什么不重复？

```
HashSet 底层就是 HashMap：
  - 元素作为 HashMap 的 key
  - value 是一个固定的 PRESENT 对象

add(e) → map.put(e, PRESENT)
  → 计算 hashCode 找桶
  → 桶内用 equals 比较
  → key 相同则覆盖（不会重复）

所以放入 HashSet 的对象必须正确重写 hashCode() 和 equals()
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

# 十七、JVM 补充

## 1. 类加载过程

```
.class 文件 → JVM

① 加载（Loading）
   → 通过类全名找到 .class 文件
   → 读取字节流
   → 在方法区生成 Class 对象

② 链接（Linking）
   → 验证：格式、语义、字节码验证
   → 准备：为静态变量分配内存，赋默认零值
          （static int a = 10; 此时 a = 0，赋值在初始化阶段）
   → 解析：符号引用 → 直接引用

③ 初始化（Initialization）
   → 执行 <clinit>()：静态变量赋值 + static 块
   → 触发条件：new、反射、访问静态字段、子类初始化触发父类等
```

---

## 2. 双亲委派模型

```
                BootstrapClassLoader（启动类加载器）
                    加载 rt.jar（String、HashMap 等核心类）
                          ↑ 委派
                ExtensionClassLoader（扩展类加载器）
                    加载 ext/*.jar
                          ↑ 委派
                ApplicationClassLoader（应用类加载器）
                    加载 classpath 下的类
                          ↑ 委派
                自定义 ClassLoader

工作过程：
  ① 收到加载请求 → 先委派给父加载器
  ② 父加载器也向上委派
  ③ 到顶层（Bootstrap）如果能加载就加载
  ④ 不能加载 → 一层层向下，由子加载器尝试加载

意义：
  - 防止核心类被篡改（如自己写一个 java.lang.String 不会被加载）
  - 保证类的唯一性（同一个类只被加载一次）

打破双亲委派：
  - JDBC：BootstrapClassLoader 加载 DriverManager，但 Driver 实现类在应用层
    → 使用 Thread.currentThread().getContextClassLoader()
  - Tomcat：每个 Web 应用需要自己的 ClassLoader 隔离（相同类不同版本）
  - SPI 机制
```

---

## 3. JVM 常用调优参数

```bash
# 堆内存
-Xms512m            # 初始堆大小（建议和 Xmx 一样，避免动态调整）
-Xmx1024m           # 最大堆大小
-Xmn256m            # 新生代大小
-XX:SurvivorRatio=8 # Eden:S0:S1 = 8:1:1

# 元空间
-XX:MetaspaceSize=128m
-XX:MaxMetaspaceSize=256m

# 垃圾收集器
-XX:+UseG1GC                  # 使用 G1
-XX:MaxGCPauseMillis=200      # G1 目标停顿时间
-XX:+UseParallelGC            # 使用 Parallel（吞吐量优先）
-XX:+UseConcMarkSweepGC       # 使用 CMS（低延迟）

# GC 日志
-XX:+PrintGCDetails
-XX:+PrintGCDateStamps
-Xloggc:/var/log/gc.log

# OOM 时自动 dump
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/heapdump.hprof

# 线程栈大小
-Xss256k             # 默认 512k ~ 1m
```

---

## 4. 常用 JVM 排查工具

```
命令行工具：
  jps            查看 Java 进程
  jstack <pid>   查看线程堆栈（排查死锁、CPU 100%）
  jmap <pid>     查看堆内存（导出堆快照）
  jstat <pid>    查看 GC 统计信息
  jinfo <pid>    查看 JVM 参数

可视化工具：
  JVisualVM      综合监控
  MAT            堆内存分析
  Arthas         阿里开源，在线诊断神器

CPU 100% 排查步骤：
  ① top 找到占 CPU 高的 Java 进程 PID
  ② top -Hp <PID> 找到占 CPU 高的线程 TID
  ③ printf "%x" TID 转成十六进制
  ④ jstack <PID> | grep <十六进制TID> -A 30
  → 看到线程堆栈，定位到代码行
```

---

## 5. 强引用、软引用、弱引用、虚引用？

| 类型 | GC 时机 | 用途 |
|------|---------|------|
| 强引用 `Object o = new Object()` | GC Root 可达就不回收，OOM 也不回收 | 正常使用 |
| 软引用 `SoftReference<T>` | 内存不足时回收 | 缓存 |
| 弱引用 `WeakReference<T>` | 下次 GC 就回收 | ThreadLocalMap 的 key |
| 虚引用 `PhantomReference<T>` | 随时回收，get() 永远返回 null | 跟踪对象回收（NIO DirectByteBuffer） |

---

# 十八、Spring 补充

## 1. @Autowired 和 @Resource 的区别？

| 对比 | @Autowired | @Resource |
|------|-----------|-----------|
| 来源 | Spring | JDK（javax.annotation） |
| 注入方式 | **先按类型**，类型重复再按名称 | **先按名称**，找不到再按类型 |
| 必须存在 | 默认 required=true，可设 false | 找不到直接报错 |
| 支持 @Qualifier | 配合 @Qualifier 指定名称 | 直接用 name 属性 |

```java
// 有多个实现类时：
@Autowired
@Qualifier("alipayService") // 指定 Bean 名称
private PayService payService;

@Resource(name = "alipayService") // 直接指定
private PayService payService;
```

---

## 2. Spring MVC 执行流程（详细版）

```
客户端请求
  ↓
DispatcherServlet.doDispatch()
  ↓
① HandlerMapping.getHandler()
   遍历所有 HandlerMapping，找到匹配的 Handler
   返回 HandlerExecutionChain（Handler + 拦截器列表）
  ↓
② HandlerAdapter.supports()
   找到能处理这个 Handler 的 Adapter
  ↓
③ HandlerInterceptor.preHandle()
   拦截器前置处理（按注册顺序执行）
   返回 false → 中断请求
  ↓
④ HandlerAdapter.handle()
   - 参数解析（ArgumentResolver）
   - 数据绑定与校验
   - 反射调用 Controller 方法
   - 返回值处理（ReturnValueHandler）
  ↓
⑤ HandlerInterceptor.postHandle()
   拦截器后置处理（按注册逆序执行）
  ↓
⑥ ViewResolver.resolveViewName()（如果返回视图）
   或 HttpMessageConverter 写 JSON（@ResponseBody）
  ↓
⑦ HandlerInterceptor.afterCompletion()
   请求完成后处理（无论成功失败都执行）
  ↓
响应客户端
```

---

## 3. Spring 事务传播行为？

| 传播行为 | 说明 | 场景 |
|---------|------|------|
| **REQUIRED**（默认） | 有事务就加入，没有就新建 | 大多数场景 |
| REQUIRES_NEW | 无论是否有事务，都新建（挂起当前事务） | 日志记录（不随主事务回滚） |
| NESTED | 有事务就在其中开启嵌套事务（savepoint） | 部分回滚 |
| SUPPORTS | 有事务就加入，没有就不用事务 | 查询方法 |
| NOT_SUPPORTED | 无论是否有事务，都不用事务（挂起当前） | 不需要事务的操作 |
| MANDATORY | 必须在事务中，没有则报错 | 强制要求 |
| NEVER | 不能在事务中，有则报错 | 禁止事务 |

```java
@Service
public class OrderService {
    @Autowired
    private LogService logService;
    
    @Transactional
    public void createOrder(Order order) {
        orderMapper.insert(order);
        // 日志记录用 REQUIRES_NEW，即使主事务回滚，日志也能保留
        logService.saveLog("创建订单: " + order.getId());
        
        if (something_wrong) {
            throw new RuntimeException(); // 主事务回滚，但日志不回滚
        }
    }
}

@Service
public class LogService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLog(String msg) {
        logMapper.insert(msg); // 独立事务
    }
}
```

---

## 4. Spring 中的设计模式？

| 模式 | 应用 |
|------|------|
| 工厂模式 | BeanFactory / ApplicationContext |
| 单例模式 | Spring Bean 默认单例 |
| 代理模式 | AOP（JDK 动态代理 / CGLIB） |
| 模板方法 | JdbcTemplate、RestTemplate |
| 观察者模式 | ApplicationEvent / ApplicationListener |
| 适配器模式 | HandlerAdapter |
| 策略模式 | Resource 接口的多种实现 |
| 责任链模式 | Servlet Filter、Interceptor |

---

## 5. @Component、@Service、@Repository、@Controller 的区别？

**功能上没有区别**，都是把类注册为 Spring Bean。区别在于语义：

| 注解 | 语义 | 额外功能 |
|------|------|---------|
| @Component | 通用组件 | 无 |
| @Controller | 控制层 | Spring MVC 识别为 Controller |
| @Service | 业务层 | 无（纯语义标记） |
| @Repository | 持久层 | 异常自动转换为 DataAccessException |

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

# 二十一、Linux 常用命令（面试常问）

```bash
# 文件操作
ls -la                     # 列出所有文件（含隐藏）
cat / less / tail / head   # 查看文件
tail -f app.log            # 实时跟踪日志
tail -n 100 app.log        # 查看最后 100 行
grep "ERROR" app.log       # 搜索关键字
grep -n "ERROR" app.log    # 带行号
grep -C 5 "ERROR" app.log  # 上下文各 5 行
find / -name "*.log"       # 查找文件
wc -l file.txt             # 统计行数

# 进程
ps -ef | grep java         # 查看 Java 进程
ps aux --sort=-%mem         # 按内存排序
top                         # 实时监控（按 P 按 CPU 排序，按 M 按内存排序）
kill -9 PID                 # 强制杀进程
kill -15 PID                # 优雅停止
nohup java -jar app.jar &  # 后台运行

# 网络
netstat -tlnp               # 查看端口占用
ss -tlnp                    # 同上（更快）
curl http://localhost:8080   # HTTP 请求
ping / telnet / traceroute  # 网络诊断
lsof -i:8080                # 查看占用 8080 端口的进程

# 磁盘
df -h                       # 磁盘使用率
du -sh *                    # 当前目录各文件/文件夹大小
du -sh /var/log             # 指定目录大小

# 系统
free -h                     # 内存使用
uptime                      # 运行时间和负载
uname -a                    # 系统信息

# 日志排查组合技
# 查找某个时间段的错误日志
grep "2026-04-12 06:" app.log | grep "ERROR"

# 统计某个接口的调用次数
grep "/api/users" access.log | wc -l

# 统计各 HTTP 状态码出现次数
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# 查看 TCP 连接状态统计
netstat -an | awk '{print $6}' | sort | uniq -c | sort -rn
```

---

# 二十二、Git 常用操作

```bash
# 基础操作
git init                    # 初始化
git clone <url>             # 克隆
git add .                   # 暂存所有
git commit -m "msg"         # 提交
git push origin main        # 推送
git pull origin main        # 拉取

# 分支
git branch                  # 查看分支
git branch feature-xxx      # 创建分支
git checkout feature-xxx    # 切换分支
git checkout -b feature-xxx # 创建并切换
git merge feature-xxx       # 合并分支
git branch -d feature-xxx   # 删除分支

# 常用场景
git stash                   # 暂存当前修改（切分支前）
git stash pop               # 恢复暂存
git log --oneline -10       # 查看最近 10 条提交
git diff                    # 查看未暂存的修改
git reset --soft HEAD~1     # 撤销上一次提交（保留代码）
git reset --hard HEAD~1     # 撤销上一次提交（丢弃代码！）
git revert <commit-hash>    # 生成一个新提交来撤销某次提交（安全）
git cherry-pick <commit>    # 将某个提交应用到当前分支

# Git 工作流（面试常问）
主流工作流：Git Flow
  main         生产分支
  develop      开发分支
  feature/*    功能分支（从 develop 拉，合并回 develop）
  release/*    预发布分支
  hotfix/*     紧急修复分支（从 main 拉，合并回 main + develop）
```

---

# 二十三、项目与场景补充

## 1. 你在项目中遇到过最难的技术问题？

```
答题思路：STAR 法
  Situation（场景）：什么项目，什么业务背景
  Task（任务）：需要解决什么问题
  Action（行动）：你具体做了什么
  Result（结果）：效果如何

示例（数据权限）：
  S：某业务平台有多级行政区划（省/市/区/街道），不同层级用户
     只能看到自己权限范围内的数据
  T：需要实现一套通用的数据权限体系，且不能侵入业务代码
  A：① 设计 @DataPermissions 注解，支持配置表名、限制字段、权限类型
     ② 基于 AOP 拦截 Mapper 方法，将权限配置写入 ThreadLocal
     ③ 通过 MyBatis 拦截器在 SQL 执行前读取配置，动态追加 WHERE 条件
     ④ 定义 6 种权限类型枚举（本单位、本单位及子级、个人等）
  R：业务代码零侵入，只需在 Mapper 方法加注解即可
     上线后覆盖多个查询接口，未出现数据越权问题
```

---

## 2. 接口性能优化你做过哪些？

```
① 数据库层面
   - 慢 SQL 分析（EXPLAIN）
   - 加索引（联合索引、覆盖索引）
   - 避免大事务
   - 批量操作替代循环单条操作

② 缓存层面
   - 热点数据加 Redis 缓存
   - 多级缓存（本地缓存 + Redis）
   - 缓存预热

③ 代码层面
   - 减少不必要的数据库查询（N+1 问题）
   - 异步处理非核心逻辑（MQ / CompletableFuture）
   - 合理使用线程池

④ 架构层面
   - 读写分离
   - 接口限流
   - CDN 加速静态资源
```

---

## 3. 如何保证接口安全？

```
① 认证：OAuth2 / JWT Token 验证用户身份
② 授权：RBAC 权限模型，接口级别权限控制
③ 数据权限：行级数据隔离
④ 防重复提交：Token 机制 / Redis SETNX
⑤ 参数校验：@Valid + 全局异常处理
⑥ SQL 注入：MyBatis #{} 预编译
⑦ XSS：前端转义 + 后端过滤
⑧ 限流：Sentinel / Gateway 限流
⑨ 加密：HTTPS + 敏感数据加密存储
⑩ 日志审计：操作日志记录
```

---

## 4. 微服务拆分原则？

```
① 单一职责：一个服务只做一件事
② 高内聚低耦合：相关功能放一起，服务间依赖最少
③ 按业务域拆分（DDD）：
   - 用户服务（注册/登录/用户信息）
   - 订单服务（下单/支付/退款）
   - 商品服务（商品/库存/分类）
④ 数据库独立：每个服务有自己的数据库
⑤ 避免过度拆分：初期可以粗粒度，后续再细化

拆分后要解决的问题：
  - 服务通信：Feign / gRPC
  - 数据一致性：分布式事务
  - 服务治理：注册中心、配置中心、熔断限流
  - 链路追踪：Sleuth + Zipkin
  - 统一入口：Gateway
```

---

## 5. 你们项目的部署架构是怎样的？

```
（通用微服务项目为例）

用户浏览器
    ↓ HTTPS
┌─────────────────────────────────────────┐
│              Nginx 集群                   │
│  SSL 卸载、负载均衡、静态资源             │
└──────────────────┬──────────────────────┘
                   ↓ HTTP
┌─────────────────────────────────────────┐
│       Spring Cloud Gateway               │
│  路由、限流、鉴权                         │
└──────────────────┬──────────────────────┘
                   ↓
  ┌────────────────┼────────────────┐
  ↓                ↓                ↓
┌──────┐     ┌──────────┐    ┌──────────┐
│权限服务│     │ 业务服务  │    │ 门户服务  │
└──┬───┘     └────┬─────┘    └────┬─────┘
   │              │               │
   └──────────────┼───────────────┘
                  ↓
     ┌──────────────────────────┐
     │        基础设施            │
     │ Nacos  Redis  PostgreSQL  │
     │ MinIO  Zipkin             │
     └──────────────────────────┘
```

---

## 6. JWT Token 结构？

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ6aGFuZ3NhbiJ9.Signature

三部分，用 . 分隔：

① Header（头部）—— Base64 编码
{
  "alg": "RS256",    // 签名算法
  "typ": "JWT"       // 类型
}

② Payload（载荷）—— Base64 编码（不是加密！任何人都能解码）
{
  "sub": "zhangsan",      // 用户名
  "user_id": 123,         // 用户ID
  "authorities": ["admin"], // 权限
  "exp": 1712880000,      // 过期时间
  "iat": 1712793600       // 签发时间
}

③ Signature（签名）—— 防篡改
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secretKey
)

验证过程：
  服务器收到 Token → 用密钥重新计算签名 → 和 Token 中的签名比较
  → 一致说明 Token 未被篡改
  → 不一致说明 Token 被修改过，拒绝
```

---

## 7. 延时双删你们项目怎么实现的？

```
（通用回答模板）

写操作流程：
  ① 先删缓存
  ② 更新数据库
  ③ 发送延时消息到 MQ（或用 ScheduledExecutorService）
  ④ 消费者收到消息后再次删除缓存

为什么第二次删除用 MQ 而不是 sleep？
  ① sleep 会阻塞当前线程，影响接口响应时间
  ② MQ 有重试机制，如果第二次删除失败可以重试
  ③ 解耦，不影响主流程

延时时间怎么定？
  > 一次读请求的最大耗时
  通常 500ms ~ 1s

什么场景不需要延时双删？
  如果没有读写并发的场景，简单的「先更新 DB，再删缓存」就够了
  延时双删主要解决极端并发下的短暂不一致
```

---

# 二十四、Spring 源码级面试题（深入篇）

> 如果提到阅读过 Bean 生命周期、AOP 代理、事务拦截器等核心源码，面试官大概率会深挖以下问题。

---

## 一、Spring IOC 容器

### 1. Spring IOC 容器启动流程？（refresh 方法）

```
AbstractApplicationContext.refresh() 是 Spring 容器启动的核心入口，共 12 步：

① prepareRefresh()
   准备工作：设置启动时间、激活标志位、初始化属性源

② obtainFreshBeanFactory()
   创建 BeanFactory（DefaultListableBeanFactory）
   加载所有 BeanDefinition（从 XML / 注解 / @Configuration 等来源）

③ prepareBeanFactory(beanFactory)
   配置 BeanFactory：设置 ClassLoader、SpEL 解析器
   注册默认的 BeanPostProcessor（如 ApplicationContextAwareProcessor）

④ postProcessBeanFactory(beanFactory)
   子类扩展点（如 Web 环境注册 Servlet 相关 Scope）

⑤ invokeBeanFactoryPostProcessors(beanFactory)    ★ 重点
   执行所有 BeanFactoryPostProcessor
   → ConfigurationClassPostProcessor 在这里工作
   → 解析 @Configuration、@Bean、@ComponentScan、@Import、@Conditional
   → 把解析出来的类注册为 BeanDefinition

⑥ registerBeanPostProcessors(beanFactory)
   注册所有 BeanPostProcessor（此时只注册，不执行）
   → AutowiredAnnotationBeanPostProcessor
   → CommonAnnotationBeanPostProcessor
   → AbstractAutoProxyCreator（AOP）

⑦ initMessageSource()
   初始化国际化消息源

⑧ initApplicationEventMulticaster()
   初始化事件广播器

⑨ onRefresh()
   子类扩展点
   → SpringBoot 在这里启动内嵌 Tomcat / Jetty / Undertow

⑩ registerListeners()
   注册事件监听器（@EventListener / ApplicationListener）

⑪ finishBeanDefinitionInstantiation()             ★ 重点
   实例化所有非懒加载的单例 Bean
   → 触发 Bean 生命周期（实例化 → 属性填充 → 初始化）

⑫ finishRefresh()
   发布 ContextRefreshedEvent 事件
   → 标志着容器启动完成
```

**面试简答版：**
> refresh() 主要做三件事：① 加载 BeanDefinition（设计图纸）② 注册各种后置处理器 ③ 实例化所有单例 Bean。其中 ConfigurationClassPostProcessor 负责解析 @Configuration 等注解生成 BeanDefinition，Bean 的创建则在 finishBeanDefinitionInstantiation 中完成。

---

### 2. BeanDefinition 是什么？有什么用？

```
BeanDefinition 是 Bean 的"设计图纸"/"元数据"，描述了如何创建一个 Bean。

包含的信息：
  - beanClassName          类全名
  - scope                  singleton / prototype
  - lazyInit               是否懒加载
  - dependsOn              依赖哪些 Bean
  - autowireMode           自动装配模式
  - initMethodName         初始化方法
  - destroyMethodName      销毁方法
  - constructorArgumentValues  构造器参数
  - propertyValues         属性值

来源（谁生成了 BeanDefinition）：
  @Component / @Service / @Controller
    → ClassPathBeanDefinitionScanner 扫描 + 注册
  @Bean
    → ConfigurationClassPostProcessor 解析 @Configuration 类
  XML <bean>
    → XmlBeanDefinitionReader 解析

核心理解：
  先有 BeanDefinition（图纸），后有 Bean 实例（产品）
  BeanFactoryPostProcessor 修改的是图纸
  BeanPostProcessor 修改的是产品
```

---

### 3. BeanFactory 和 ApplicationContext 的区别？

```
BeanFactory（IoC 容器的根接口）：
  - 最底层的容器接口
  - 懒加载：getBean() 时才创建
  - 只提供基本的 Bean 获取和管理
  
ApplicationContext（BeanFactory 的子接口）：
  - 在 BeanFactory 基础上扩展了企业级功能
  - 启动时就实例化所有单例 Bean（预加载）
  - 支持事件发布（ApplicationEvent）
  - 支持国际化（MessageSource）
  - 支持 AOP 自动代理
  - 支持资源加载（ResourceLoader）

常用实现类：
  AnnotationConfigApplicationContext  注解驱动
  ClassPathXmlApplicationContext      XML 驱动
  GenericWebApplicationContext        Web 环境

关系：
  ApplicationContext extends ListableBeanFactory extends BeanFactory
  ApplicationContext 内部持有一个 DefaultListableBeanFactory 做实际的 Bean 管理
```

---

### 4. @Autowired 的注入原理？在哪个阶段完成？

```
@Autowired 由 AutowiredAnnotationBeanPostProcessor 处理

时机：Bean 生命周期的"属性填充"阶段（populateBean）

详细流程：
① Bean 实例化完成后（还没初始化），进入 populateBean() 方法
② 遍历所有 BeanPostProcessor
③ AutowiredAnnotationBeanPostProcessor.postProcessProperties() 被调用
④ 扫描当前 Bean 类中所有标注 @Autowired / @Value 的字段和方法
   → 封装为 InjectionMetadata（注入元数据）
⑤ 对每个注入点执行 inject()：
   → 按类型从容器中查找候选 Bean（byType）
   → 如果有多个候选：
     → 优先看 @Qualifier 指定的名称
     → 其次看 @Primary 标记的 Bean
     → 最后按字段名匹配（byName）
   → 通过反射 Field.set() 或 Method.invoke() 完成注入

源码调用链：
  AbstractAutowireCapableBeanFactory.populateBean()
  → AutowiredAnnotationBeanPostProcessor.postProcessProperties()
  → InjectionMetadata.inject()
  → AutowiredFieldElement.inject()
  → beanFactory.resolveDependency()  // 从容器中查找 Bean
  → field.set(bean, value)           // 反射注入
```

---

## 二、Bean 生命周期（必问 TOP1）

### 5. Spring Bean 的完整生命周期？

```
以 createBean() → doCreateBean() 为入口：

┌───────────────────────────────────────────────────────────┐
│                      Bean 生命周期                          │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ① 实例化（Instantiation）                                  │
│     createBeanInstance()                                   │
│     → 推断构造方法                                          │
│     → 反射调用构造器创建对象（此时是空对象，属性都是 null）    │
│                         ↓                                  │
│  ② 放入三级缓存                                             │
│     addSingletonFactory(beanName, ObjectFactory)           │
│     → 为解决循环依赖做准备                                   │
│                         ↓                                  │
│  ③ 属性填充（Population）                                   │
│     populateBean()                                         │
│     → @Autowired 注入（AutowiredAnnotationBeanPostProcessor）│
│     → @Resource 注入（CommonAnnotationBeanPostProcessor）   │
│     → @Value 注入                                          │
│                         ↓                                  │
│  ④ Aware 回调                                               │
│     invokeAwareMethods()                                   │
│     → BeanNameAware.setBeanName(name)                      │
│     → BeanClassLoaderAware.setBeanClassLoader(cl)          │
│     → BeanFactoryAware.setBeanFactory(factory)             │
│                         ↓                                  │
│  ⑤ BeanPostProcessor 前置处理                               │
│     applyBeanPostProcessorsBeforeInitialization()          │
│     → ApplicationContextAwareProcessor                     │
│       → ApplicationContextAware.setApplicationContext()    │
│     → CommonAnnotationBeanPostProcessor                    │
│       → @PostConstruct 方法执行 ★                          │
│                         ↓                                  │
│  ⑥ 初始化（Initialization）                                 │
│     invokeInitMethods()                                    │
│     → InitializingBean.afterPropertiesSet()                │
│     → 自定义 init-method                                   │
│                         ↓                                  │
│  ⑦ BeanPostProcessor 后置处理                               │
│     applyBeanPostProcessorsAfterInitialization()           │
│     → AbstractAutoProxyCreator                             │
│       → 判断是否需要 AOP → 创建代理对象 ★                   │
│       → 返回代理对象（替换原始 Bean）                        │
│                         ↓                                  │
│  ⑧ 注册销毁回调                                             │
│     registerDisposableBeanIfNecessary()                    │
│                         ↓                                  │
│  ⑨ 放入一级缓存（完整的 Bean）                               │
│     addSingleton(beanName, singletonObject)                │
│                         ↓                                  │
│  ⑩ 使用 Bean                                               │
│                         ↓                                  │
│  ⑪ 销毁                                                    │
│     → @PreDestroy                                          │
│     → DisposableBean.destroy()                             │
│     → 自定义 destroy-method                                │
│                                                            │
└───────────────────────────────────────────────────────────┘

执行顺序总结：
  构造器 → @Autowired → @PostConstruct → afterPropertiesSet() → init-method → AOP代理

销毁顺序：
  @PreDestroy → destroy() → destroy-method
```

**高频追问：**

```
Q: AOP 代理在哪个阶段创建？
A: 第 ⑦ 步 postProcessAfterInitialization，
   由 AbstractAutoProxyCreator（AnnotationAwareAspectJAutoProxyCreator 的父类）创建。

Q: @PostConstruct 和 InitializingBean 谁先执行？
A: @PostConstruct 先执行（第 ⑤ 步 BeanPostProcessor.before 阶段）
   InitializingBean.afterPropertiesSet() 后执行（第 ⑥ 步初始化阶段）

Q: @Autowired 和 Aware 回调谁先？
A: @Autowired 先（第 ③ 步属性填充），Aware 后（第 ④ 步）
   但 ApplicationContextAware 比较特殊，它在第 ⑤ 步由 ApplicationContextAwareProcessor 处理

Q: Bean 实例化后为什么要先放入三级缓存再填充属性？
A: 因为属性填充时可能触发其他 Bean 的创建（循环依赖），
   先放入三级缓存才能让其他 Bean 获取到当前 Bean 的早期引用
```

---

## 三、循环依赖与三级缓存（必问 TOP2）

### 6. Spring 怎么解决循环依赖？三级缓存分别是什么？

```java
// DefaultSingletonBeanRegistry 中的三级缓存

// 一级缓存：存放完整的 Bean（已经历完整生命周期）
Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

// 二级缓存：存放提前暴露的 Bean（实例化了但未初始化完成）
Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);

// 三级缓存：存放 ObjectFactory（Bean 的工厂 lambda）
Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);
```

```
循环依赖场景：A 依赖 B，B 依赖 A

完整流程：

① getBean(A) → 一二三级缓存都没有 → 开始创建 A
② 实例化 A（构造器创建空对象）
③ 将 A 的 ObjectFactory 放入三级缓存
   singletonFactories.put("A", () -> getEarlyBeanReference(A))
   → 这个 lambda 被调用时才决定返回原始对象还是代理对象
④ 填充 A 的属性 → 发现依赖 B → getBean(B)

⑤ getBean(B) → 缓存都没有 → 开始创建 B
⑥ 实例化 B
⑦ 将 B 的 ObjectFactory 放入三级缓存
⑧ 填充 B 的属性 → 发现依赖 A → getBean(A)

⑨ getBean(A) → 一级没有 → 二级没有 → 三级有！
   → 调用 ObjectFactory.getObject()
   → 内部调用 getEarlyBeanReference(A)
   → SmartInstantiationAwareBeanPostProcessor.getEarlyBeanReference()
   → 如果 A 需要 AOP 代理，在这里提前创建代理对象
   → 如果 A 不需要代理，直接返回原始对象
   → 将结果放入二级缓存，删除三级缓存
⑩ B 拿到 A 的早期引用 → B 继续初始化 → B 完成 → 放入一级缓存

⑪ 回到 A → A 拿到完整的 B → A 继续初始化 → A 完成 → 放入一级缓存

时间线：
  createA → 实例化A → 三级缓存放A → 填充属性发现需要B
    → createB → 实例化B → 三级缓存放B → 填充属性发现需要A
      → 从三级缓存拿A → 放入二级缓存
    → B完成 → 一级缓存放B
  → A拿到B → A完成 → 一级缓存放A
```

---

### 7. 为什么需要三级缓存而不是两级？

```
核心原因：为了延迟 AOP 代理的创建时机

假设只有两级缓存（一级 + 二级）：
  实例化 A 后，立即就要决定放入二级缓存的是"原始对象"还是"代理对象"
  但此时 A 还没走到 postProcessAfterInitialization（AOP 创建代理的正常时机）
  → 不得不提前创建代理，打破了 Bean 生命周期的正常顺序

三级缓存的好处：
  第三级存的是 ObjectFactory（工厂 lambda），不是具体对象
  只有当这个 Bean 真正被其他 Bean 引用时，才调用工厂方法
  调用时才判断：
    - 需要 AOP？→ 创建代理对象返回
    - 不需要 AOP？→ 返回原始对象
  
  这样做到了：
  ① 如果没有循环依赖，代理对象在正常时机创建（第 ⑦ 步）
  ② 如果有循环依赖，才提前创建代理（但只创建一次，保证单例）
  ③ 不管哪种情况，最终容器中都是同一个对象

如果没有 AOP：
  确实两级缓存就够了
  三级缓存的存在是为了兼容 AOP 场景
```

---

### 8. 什么情况下 Spring 解决不了循环依赖？

```
① 构造器注入的循环依赖
   A 的构造器需要 B，B 的构造器需要 A
   → 实例化 A 时就需要 B，但 A 还没实例化完，无法放入三级缓存
   → 报错：BeanCurrentlyInCreationException
   
   解决：其中一方使用 @Lazy
   @Lazy 的原理：注入的不是真实 Bean，而是一个代理对象
                 代理对象在真正调用方法时才去容器 getBean()

② prototype 作用域的循环依赖
   Spring 只对 singleton 解决循环依赖
   prototype 每次都创建新对象，无法缓存

③ @Async + 循环依赖
   @Async 会创建代理对象，但创建时机和普通 AOP 不同
   可能导致"早期引用"和"最终 Bean"不是同一个对象
   → 报错：BeanCurrentlyInCreationException
   → 解决：@Lazy 或调整依赖关系
```

---

## 四、AOP 原理

### 9. Spring AOP 的实现原理？JDK 动态代理 vs CGLIB？

```
Spring AOP 基于动态代理实现，在运行时为目标对象创建代理对象。

┌──────────────────────────────────────────────────────────┐
│                    JDK 动态代理                            │
│                                                           │
│  条件：目标类实现了接口                                     │
│  原理：java.lang.reflect.Proxy.newProxyInstance()         │
│       生成一个实现了相同接口的代理类                         │
│  调用链：                                                  │
│    client → proxy.method()                                │
│           → InvocationHandler.invoke()                    │
│           → 前置增强                                       │
│           → target.method()（反射调用原始方法）             │
│           → 后置增强                                       │
│  限制：只能代理接口中定义的方法                              │
├──────────────────────────────────────────────────────────┤
│                    CGLIB 代理                              │
│                                                           │
│  条件：目标类没有实现接口（或强制使用 CGLIB）               │
│  原理：通过 ASM 字节码框架，生成目标类的子类                │
│       子类重写目标方法，在方法前后插入增强逻辑              │
│  调用链：                                                  │
│    client → proxy.method()                                │
│           → MethodInterceptor.intercept()                 │
│           → 前置增强                                       │
│           → methodProxy.invokeSuper()（调用父类原始方法）  │
│           → 后置增强                                       │
│  限制：不能代理 final 类和 final 方法（无法被子类重写）     │
└──────────────────────────────────────────────────────────┘

Spring Boot 2.x 默认配置：
  spring.aop.proxy-target-class=true
  → 无论是否有接口，都使用 CGLIB
  → 原因：避免类型转换问题（注入时用实现类接收却拿到接口代理）
```

---

### 10. AOP 代理对象的创建过程？（源码级）

```
入口：AbstractAutoProxyCreator.postProcessAfterInitialization()

源码流程：

① postProcessAfterInitialization(bean, beanName)
   → wrapIfNecessary(bean, beanName, cacheKey)

② 查找所有候选 Advisor
   → findCandidateAdvisors()
   → 从容器中找所有 Advisor 类型的 Bean
   → 解析所有 @Aspect 类中的 @Around/@Before/@After/@AfterReturning/@AfterThrowing
   → 每个通知方法被封装为一个 Advisor（包含 Pointcut + Advice）

③ 筛选能应用于当前 Bean 的 Advisor
   → findAdvisorsThatCanApply(candidateAdvisors, beanClass)
   → 对每个 Advisor 做匹配：
     → ClassFilter.matches(targetClass)     类级别匹配
     → MethodMatcher.matches(method, targetClass) 方法级别匹配
   → AspectJ 表达式在这里解析（如 execution(* com.example.service.*.*(..))）

④ 如果有匹配的 Advisor → 创建代理
   → createProxy(beanClass, beanName, specificInterceptors, targetSource)
   → ProxyFactory proxyFactory = new ProxyFactory()
   → proxyFactory.addAdvisors(advisors)
   → 判断使用 JDK 还是 CGLIB：
     if (proxyTargetClass || 目标类没有实现接口) → CGLIB
     else → JDK 动态代理
   → proxyFactory.getProxy(classLoader)

⑤ 返回代理对象
   → 这个代理对象替代原始 Bean 存入容器
   → 后续其他 Bean @Autowired 拿到的都是代理对象
```

---

### 11. @Aspect 中各种通知的执行顺序？

```
Spring 5.2.7+ 的执行顺序（修正后）：

正常执行：
  @Around 前半段（proceed 之前）
    → @Before
      → 目标方法执行
    → @AfterReturning
  → @After（finally 语义，一定执行）
  → @Around 后半段（proceed 之后）

异常执行：
  @Around 前半段
    → @Before
      → 目标方法抛异常
    → @AfterThrowing
  → @After（finally 语义，一定执行）
  → @Around（catch 到异常）

多个 @Aspect 的顺序：
  通过 @Order(n) 控制，值越小优先级越高
  → @Order(1) 的 @Before 先执行
  → @Order(1) 的 @After 后执行
  → 像洋葱模型一样层层嵌套

源码对应：
  所有 Advice 被封装为 MethodInterceptor，组成拦截器链
  通过 ReflectiveMethodInvocation.proceed() 按责任链模式依次调用
```

---

### 12. 拦截器链的执行原理？（责任链模式）

```java
// ReflectiveMethodInvocation 核心代码（简化版）
public Object proceed() throws Throwable {
    // 拦截器链执行完毕，调用目标方法
    if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
        return invokeJoinpoint(); // 反射调用目标方法
    }
    
    // 获取下一个拦截器
    Object interceptorOrInterceptionAdvice =
        this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);
    
    // 调用拦截器
    return ((MethodInterceptor) interceptorOrInterceptionAdvice).invoke(this);
    // 注意：传入的是 this（当前 Invocation），拦截器内部会调用 invocation.proceed()
    // 从而形成递归调用链
}
```

```
执行过程（以 @Around + @Before + @After 为例）：

proceed()
  → AroundInterceptor.invoke(invocation)
    → // @Around 前半段
    → invocation.proceed()
      → MethodBeforeInterceptor.invoke(invocation)
        → // 执行 @Before
        → invocation.proceed()
          → AfterInterceptor.invoke(invocation)
            → try {
                invocation.proceed()
                  → invokeJoinpoint()  // 执行目标方法
              } finally {
                // 执行 @After
              }
        → // @Before 后续
      → // @Around 后半段（proceed 之后的代码）
```

---

## 五、事务原理

### 13. @Transactional 的底层原理？（源码级）

```
@Transactional 本质是 AOP 代理 + TransactionInterceptor

核心类关系：
  @EnableTransactionManagement
    → @Import(TransactionManagementConfigurationSelector)
    → 注册 ProxyTransactionManagementConfiguration
    → 注册 BeanFactoryTransactionAttributeSourceAdvisor（Advisor）
    → 包含 TransactionInterceptor（Advice）
    → 包含 TransactionAttributeSource（Pointcut 的一部分）

当 Bean 创建时，AbstractAutoProxyCreator 发现有 TransactionAdvisor 能匹配
→ 创建代理对象

调用流程：
  代理对象.method()
    → TransactionInterceptor.invoke(MethodInvocation)
    → TransactionAspectSupport.invokeWithinTransaction()

invokeWithinTransaction() 源码逻辑（简化）：

  // ① 获取事务属性
  TransactionAttribute txAttr = getTransactionAttributeSource()
      .getTransactionAttribute(method, targetClass);
  // 解析 @Transactional 的 propagation、isolation、rollbackFor 等

  // ② 获取事务管理器
  PlatformTransactionManager tm = determineTransactionManager(txAttr);
  // 通常是 DataSourceTransactionManager

  // ③ 根据传播行为，开启/加入/挂起事务
  TransactionInfo txInfo = createTransactionIfNecessary(tm, txAttr, joinpointId);
  // 内部调用 tm.getTransaction(txAttr)
  // → DataSourceTransactionManager.doBegin()
  // → 从 DataSource 获取 Connection
  // → connection.setAutoCommit(false)  ★ 关闭自动提交
  // → 将 Connection 绑定到 ThreadLocal（TransactionSynchronizationManager）

  Object retVal;
  try {
      // ④ 执行目标方法
      retVal = invocation.proceed();
  } catch (Throwable ex) {
      // ⑤ 异常处理
      completeTransactionAfterThrowing(txInfo, ex);
      // → 判断异常是否匹配 rollbackFor
      // → 匹配 → tm.rollback() → connection.rollback()
      // → 不匹配 → tm.commit() → connection.commit()
      throw ex;
  }
  
  // ⑥ 正常提交
  commitTransactionAfterReturning(txInfo);
  // → tm.commit() → connection.commit()
  
  return retVal;
```

---

### 14. 事务传播行为的源码实现？

```
核心方法：AbstractPlatformTransactionManager.getTransaction()

简化逻辑：

public TransactionStatus getTransaction(TransactionDefinition definition) {
    // 检查当前线程是否已有事务
    Object transaction = doGetTransaction();
    // → DataSourceTransactionManager.doGetTransaction()
    // → 从 ThreadLocal 中获取当前 Connection

    if (isExistingTransaction(transaction)) {
        // 已有事务 → 根据传播行为决定
        return handleExistingTransaction(definition, transaction);
        
        // REQUIRED     → 加入当前事务
        // REQUIRES_NEW → 挂起当前事务，新建事务
        // NESTED       → 创建 Savepoint（嵌套事务）
        // SUPPORTS     → 加入当前事务
        // NOT_SUPPORTED → 挂起当前事务，非事务运行
        // MANDATORY    → 加入当前事务
        // NEVER        → 抛异常！
    }
    
    // 没有事务
    // REQUIRED     → 新建事务
    // REQUIRES_NEW → 新建事务
    // NESTED       → 新建事务
    // SUPPORTS     → 非事务运行
    // NOT_SUPPORTED → 非事务运行
    // MANDATORY    → 抛异常！
    // NEVER        → 非事务运行
    
    if (definition.getPropagation() == REQUIRED ||
        definition.getPropagation() == REQUIRES_NEW ||
        definition.getPropagation() == NESTED) {
        // 新建事务
        doBegin(transaction, definition);
        // → connection.setAutoCommit(false)
    }
}
```

**REQUIRES_NEW 的"挂起"是怎么实现的？**

```
挂起 = 将当前事务的 Connection 从 ThreadLocal 解绑，暂存到 SuspendedResourcesHolder

  ① 当前事务 A 的 Connection_A 绑定在 ThreadLocal
  ② 遇到 REQUIRES_NEW → suspend(transaction)
     → 从 ThreadLocal 取出 Connection_A，暂存
  ③ 新建事务 B → 获取新的 Connection_B → 绑定到 ThreadLocal
  ④ 事务 B 执行完 → commit/rollback
  ⑤ resume() → 把 Connection_A 重新绑定到 ThreadLocal
  ⑥ 继续事务 A
```

---

### 15. @Transactional 失效的 7 种场景？（源码角度解释）

```
① 方法不是 public
   原因：Spring AOP 默认用 CGLIB 生成子类
        子类只能重写 public / protected 方法
        TransactionInterceptor 内部会检查方法可见性
   源码：AbstractFallbackTransactionAttributeSource.computeTransactionAttribute()
        → if (allowPublicMethodsOnly() && !Modifier.isPublic(method.getModifiers()))
             return null;  // 直接返回 null，不应用事务

② 自调用（this.method()）
   原因：this 指向原始对象，不是代理对象
        调用没有经过 TransactionInterceptor
   示例：
     @Service
     public class OrderService {
         public void createOrder() {
             this.saveOrder(); // ❌ 直接调用，事务不生效
         }
         @Transactional
         public void saveOrder() { ... }
     }
   解决方案：
     方案一：注入自身
       @Autowired @Lazy private OrderService self;
       self.saveOrder(); // ✅ 通过代理对象调用
     方案二：AopContext
       ((OrderService) AopContext.currentProxy()).saveOrder();
       需要配置 @EnableAspectJAutoProxy(exposeProxy = true)
     方案三：拆分到不同 Service

③ 异常被 catch 吞掉了
   原因：TransactionInterceptor 在 catch 块中判断是否回滚
        异常没抛出来 → 走正常 commit 逻辑
   解决：
     catch 后手动标记回滚：
     TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();

④ 抛出的是 checked 异常
   原因：默认 rollbackFor = {RuntimeException.class, Error.class}
        IOException 等 checked 异常不在回滚范围内
   源码：DefaultTransactionAttribute.rollbackOn(Throwable ex)
        → return (ex instanceof RuntimeException || ex instanceof Error)
   解决：@Transactional(rollbackFor = Exception.class)

⑤ 数据库引擎不支持事务
   原因：MyISAM 不支持事务，只有 InnoDB 支持

⑥ Bean 没被 Spring 管理
   原因：没有 @Service / @Component → 不会创建代理

⑦ 传播行为导致
   原因：SUPPORTS / NOT_SUPPORTED / NEVER 在没有外层事务时不开启事务
```

---

## 六、BeanPostProcessor 体系

### 16. BeanPostProcessor 能做什么？重要的实现类有哪些？

```
BeanPostProcessor 是 Spring 最核心的扩展机制
每个 Bean 创建时都会经过所有 BeanPostProcessor

接口定义：
  postProcessBeforeInitialization(bean, beanName)  // 初始化前
  postProcessAfterInitialization(bean, beanName)   // 初始化后

重要实现类：

┌────────────────────────────────────────┬──────────────────────────────┐
│ 实现类                                  │ 作用                          │
├────────────────────────────────────────┼──────────────────────────────┤
│ AutowiredAnnotationBeanPostProcessor   │ 处理 @Autowired / @Value 注入 │
│ CommonAnnotationBeanPostProcessor      │ 处理 @Resource / @PostConstruct│
│                                        │ / @PreDestroy                 │
│ ApplicationContextAwareProcessor       │ 处理各种 Aware 接口回调        │
│ AbstractAutoProxyCreator               │ AOP 代理创建                  │
│ (AnnotationAwareAspectJAutoProxyCreator)│                              │
│ AsyncAnnotationBeanPostProcessor       │ 处理 @Async 创建异步代理       │
│ ScheduledAnnotationBeanPostProcessor   │ 处理 @Scheduled 注册定时任务   │
└────────────────────────────────────────┴──────────────────────────────┘

一句话总结：
  Spring 几乎所有的"魔法"都是通过 BeanPostProcessor 实现的
  @Autowired、@PostConstruct、AOP、@Async、@Scheduled 等功能
  本质上都是不同的 BeanPostProcessor 在 Bean 生命周期中做了不同的事
```

---

### 17. BeanFactoryPostProcessor 和 BeanPostProcessor 的区别？

```
                    BeanFactoryPostProcessor        BeanPostProcessor
执行时机            BeanDefinition 加载完毕后         每个 Bean 实例化后
                    Bean 实例化之前                   初始化前后
操作对象            BeanDefinition（设计图）          Bean 实例（产品）
执行次数            只执行一次                        每个 Bean 都执行
典型实现            ConfigurationClassPostProcessor  AutowiredAnnotationBeanPostProcessor
                    PropertySourcesPlaceholderConfigurer  AbstractAutoProxyCreator

类比：
  BeanFactoryPostProcessor → 修改建筑图纸（可以改类名、改属性、改作用域）
  BeanPostProcessor → 对建好的房子做装修（注入属性、创建代理、注册回调）
```

---

## 七、面试回答模板

```
面试官："你读过 Spring 哪些源码？"

推荐回答（可按以下三块来组织）：

"我比较深入看过三部分源码：

【Bean 生命周期】
从 AbstractApplicationContext.refresh() 入口开始，重点看了
createBean → doCreateBean 这条线。理解了 Bean 从实例化到初始化的完整过程：
createBeanInstance 反射创建对象 → populateBean 属性填充（@Autowired 在这里由
AutowiredAnnotationBeanPostProcessor 处理）→ initializeBean 初始化（@PostConstruct
在 BeanPostProcessor.before 阶段处理，AOP 代理在 BeanPostProcessor.after 阶段
由 AbstractAutoProxyCreator 创建）。

【循环依赖】
看了 DefaultSingletonBeanRegistry 的三级缓存实现。理解了为什么需要第三级缓存
而不是两级——关键是为了延迟 AOP 代理的创建。三级缓存存的是 ObjectFactory，
只有当 Bean 真正被其他 Bean 引用时才调用，这时才判断是否需要创建代理，
既保证了循环依赖的解决，又保证了代理对象的单一性。

【事务】
看了 TransactionInterceptor 的 invokeWithinTransaction 方法。理解了事务的开启
本质上是 connection.setAutoCommit(false)，Connection 绑定在 ThreadLocal 中，
同一个线程的数据库操作共用一个 Connection 就实现了事务。也理解了为什么自调用
会导致事务失效——因为 this 指向原始对象绕过了 TransactionInterceptor。
REQUIRES_NEW 的实现是将当前 Connection 从 ThreadLocal 解绑暂存，新建另一个
Connection 绑定进去。"
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

---

# 二十八、MyBatis 深入面试题

---

## 一、MyBatis 一级缓存和二级缓存

### 1. 一级缓存（SqlSession 级别）

```
范围：同一个 SqlSession 内有效
默认：开启

同一个 SqlSession 内，相同的查询只查一次数据库，第二次从缓存取：
  @Transactional
  public void test() {
      User u1 = userMapper.selectById(1); // 查数据库，结果缓存
      User u2 = userMapper.selectById(1); // 命中一级缓存，不查数据库
      // u1 == u2 → true（同一个对象引用！）
  }

在 Spring 中，默认每次 Mapper 调用都创建新的 SqlSession，
所以一级缓存几乎没效果。只有在同一个事务（@Transactional）中才复用 SqlSession。

一级缓存失效的情况：
  ① 不同 SqlSession（没在同一个事务中）
  ② 查询条件不同
  ③ 两次查询之间执行了 INSERT/UPDATE/DELETE（会清空一级缓存）
  ④ 手动调用 sqlSession.clearCache()
```

### 2. 二级缓存（Mapper / namespace 级别）

```
范围：同一个 Mapper（namespace）下的所有 SqlSession 共享
默认：需要手动开启

开启方式：
  <!-- mybatis-config.xml 全局开关（默认 true） -->
  <setting name="cacheEnabled" value="true"/>
  <!-- Mapper.xml 中加 <cache/> 标签 -->
  <cache/>

  实体类必须实现 Serializable

数据生命周期：
  查询后先存入一级缓存
  SqlSession 关闭/提交时 → 一级缓存刷入二级缓存
  其他 SqlSession 查同样的 SQL → 命中二级缓存

查询优先级：二级缓存 → 一级缓存 → 数据库

为什么实际项目中很少用二级缓存？
  ① 粒度太粗：整个 namespace 的缓存一起清空
     → 任何一个 UPDATE 就清空所有查询缓存
  ② 多表查询脏数据：
     → UserMapper 关联查了 Order 表并缓存
     → OrderMapper 更新了 Order 表
     → UserMapper 缓存不会被清空 → 脏数据
  ③ 分布式环境失效：
     → 二级缓存是 JVM 内存级别的
     → 服务器 A 更新数据，服务器 B 缓存还是旧的
  
  实际做法：用 Redis 做缓存，自己控制粒度和失效策略
```

## 二、MyBatis 核心架构

### 1. Mapper 接口没有实现类，为什么能调用？

```
MyBatis 用 JDK 动态代理生成了实现类。

@MapperScan 扫描包下所有接口 → 注册为 MapperFactoryBean
→ Spring 创建 Bean 时调用 MapperFactoryBean.getObject()
→ sqlSession.getMapper(UserMapper.class)
→ MapperProxyFactory.newInstance(sqlSession)
→ Proxy.newProxyInstance(classLoader, {UserMapper.class}, MapperProxy)
→ 返回代理对象，注册为 Spring Bean

调用时：
  userMapper.selectById(1)
  → MapperProxy.invoke()
  → MapperMethod.execute(sqlSession, args)
  → sqlSession.selectOne("...UserMapper.selectById", 1)
```

### 2. SqlSession、Mapper、Executor 的关系？

```
Mapper（代理对象，类型安全的入口）
  │ 内部持有 SqlSession
  │ 方法调用翻译成 sqlSession.selectOne/insert/update/delete
  ▼
SqlSession（会话，统一入口的门面）
  │ 内部持有 Executor
  │ 所有 SQL 执行都委托给 Executor
  ▼
Executor（执行器，真正干活的）
  │ 三种实现：SimpleExecutor / ReuseExecutor / BatchExecutor
  │ CachingExecutor 装饰器加二级缓存
  ▼
StatementHandler → ParameterHandler → JDBC → ResultSetHandler

Mapper 是 SqlSession 的语法糖（不用写字符串）
SqlSession 是 Executor 的门面（统一入口）
```

### 3. MyBatis 四大核心接口？

```
Executor          执行器，调度整个流程
StatementHandler  处理 SQL 语句（PreparedStatement）
ParameterHandler  处理参数（#{} → ? 占位符赋值）
ResultSetHandler  处理结果集映射（ResultSet → Java 对象）

执行顺序：Executor → StatementHandler → ParameterHandler → JDBC → ResultSetHandler
这四个接口都可以通过 MyBatis 拦截器（Plugin）进行拦截增强
```

### 4. #{} 和 ${} 的区别？

```
#{} → 预编译参数（PreparedStatement 的 ?）
  SELECT * FROM user WHERE id = ?
  防止 SQL 注入 ✅
  MyBatis 会自动加引号

${} → 字符串直接拼接
  SELECT * FROM user WHERE id = 1
  有 SQL 注入风险 ❌
  使用场景：动态表名、动态列名、ORDER BY（这些不能用 ?）
```

---

# 二十九、JDK 动态代理与 Spring AOP

---

## 一、JDK 动态代理

### 1. JDK 动态代理的原理？

```
通过 Proxy.newProxyInstance() 在运行时生成一个实现了目标接口的代理类。

三个参数：
  ClassLoader loader         → 类加载器
  Class<?>[] interfaces      → 代理类要实现的接口（决定有哪些方法）
  InvocationHandler handler  → 所有方法调用转发到 handler.invoke()

运行时生成的代理类（伪代码）：
  public class $Proxy0 extends Proxy implements UserService {
      public String findUser(Long id) {
          return (String) handler.invoke(this, findUserMethod, new Object[]{id});
      }
  }

核心限制：只能代理接口
  因为代理类已经 extends Proxy，Java 单继承 → 只能通过 implements 接口代理

应用：
  ① MyBatis Mapper 接口 → MapperProxy
  ② Spring AOP（有接口时）→ JdkDynamicAopProxy
  ③ RPC 框架（Dubbo / Feign）→ 拦截方法调用发网络请求
```

### 2. JDK 动态代理 vs CGLIB？

```
                    JDK 动态代理              CGLIB
原理             实现接口                   继承目标类（生成子类）
要求             必须有接口                  不能是 final 类/方法
生成方式          Proxy.newProxyInstance     Enhancer.create
调用目标方法      method.invoke(target)      methodProxy.invokeSuper()
性能（创建）      快                         慢（生成子类字节码）
性能（调用）      反射调用                    FastClass 直接调用
Spring 选择      有接口时默认用这个           无接口时用这个
Spring Boot 2.x  -                         默认全用 CGLIB
```

## 二、Spring AOP 实现原理

### 1. AOP 代理对象什么时候创建的？

```
Bean 生命周期中，在初始化阶段的 BeanPostProcessor.postProcessAfterInitialization

调用链：
  initializeBean()
  → applyBeanPostProcessorsAfterInitialization()
  → AbstractAutoProxyCreator.postProcessAfterInitialization()  ★
    → wrapIfNecessary(bean, beanName)
      → getAdvicesAndAdvisorsForBean()   // 找匹配的切面
      → createProxy()                    // 创建代理
        → ProxyFactory.getProxy()
          → JdkDynamicAopProxy 或 CglibAopProxy

容器中最终存的是代理对象，不是原始对象
```

### 2. 为什么自调用 AOP 不生效？

```
@Service
public class OrderService {
    @Transactional
    public void createOrder() { ... }
    
    public void batchCreate() {
        this.createOrder(); // 自调用 → AOP 不生效！
    }
}

原因：this 指向原始对象，不是代理对象
     调用没有经过代理 → 不走拦截器链 → @Transactional 无效

解决方案：
  ① 注入自己：@Autowired OrderService self; self.createOrder();
  ② 从容器获取：ApplicationContext.getBean(OrderService.class).createOrder();
  ③ AopContext：((OrderService) AopContext.currentProxy()).createOrder();
```

---

# 三十、Spring Boot 自动装配与接口安全

---

## 一、Spring Boot 自动装配原理

```
@SpringBootApplication
  └── @EnableAutoConfiguration
        └── @Import(AutoConfigurationImportSelector.class)

启动时：
① AutoConfigurationImportSelector 读取 META-INF/spring.factories
   （Spring Boot 3.x 改为 META-INF/spring/...AutoConfiguration.imports）

② 文件里列了所有自动配置类：
   RedisAutoConfiguration
   DataSourceAutoConfiguration
   ...（几百个）

③ 每个配置类上有条件注解：
   @ConditionalOnClass(RedisOperations.class)    ← classpath 有这个类才生效
   @ConditionalOnMissingBean(RedisTemplate.class) ← 你没手动配才自动配

④ 条件满足 → 自动创建并注册 Bean

示例：你引入 spring-boot-starter-data-redis 依赖
  → classpath 有 RedisOperations.class
  → RedisAutoConfiguration 生效
  → 自动创建 RedisTemplate Bean
  → 你 @Autowired RedisTemplate 直接用

核心思想：约定大于配置，开箱即用
```

## 二、@ConfigurationProperties 原理

```
把配置文件中指定前缀的属性，自动映射到类的字段上。

@ConfigurationProperties(prefix = "spring.redis")
public class RedisProperties {
    private String host;      // ← spring.redis.host
    private int port;         // ← spring.redis.port
    private String password;  // ← spring.redis.password
}

和 @Value 的对比：
  @Value：逐个绑定，适合 1-2 个值
  @ConfigurationProperties：按前缀批量绑定，适合一组配置

支持松散绑定：
  max-pool-size / maxPoolSize / max_pool_size / MAX_POOL_SIZE
  都能绑定到 maxPoolSize 字段
```

## 三、防接口篡改

```
核心方案：参数签名（Sign）

客户端：
  ① 所有参数按 key 字母排序拼接
  ② 拼上双方约定的密钥（Secret Key）
  ③ SHA256 哈希生成签名 sign
  ④ sign 放到请求中一起发送

  排序拼接：amount=100&orderId=ABC123&userId=1
  加密钥：  amount=100&orderId=ABC123&userId=1&key=my_secret
  签名：    sign = SHA256("amount=100&orderId=ABC123&userId=1&key=my_secret")

服务端：
  ① 用同样的规则对参数排序拼接 + 密钥
  ② 算出签名，和客户端传来的 sign 对比
  ③ 一致 → 没被篡改；不一致 → 被篡改了

完整防护体系：
  防篡改：参数签名（Sign）          → 改了参数签名对不上
  防重放：时间戳（Timestamp）        → 过期请求拒绝（5分钟有效期）
  防重复：随机串（Nonce）            → Redis 存 5 分钟去重
  防窃听：HTTPS                     → 传输加密
  防伪造：Token 身份认证             → 确认调用者身份
```

## 四、金融金额用什么类型？

```
用 BigDecimal，不能用 float / double。

float/double 是 IEEE 754 浮点数，0.1 在二进制中无限循环 → 精度丢失
  System.out.println(0.1 + 0.2); // 0.30000000000000004

BigDecimal 注意事项：
  ① 创建用字符串：new BigDecimal("0.1")，不要 new BigDecimal(0.1)
  ② 除法必须指定精度：divide(x, 2, RoundingMode.HALF_UP)
  ③ 比较用 compareTo：不要用 equals（精度不同判不等）
  ④ 不可变对象：a.add(b) 不会改变 a，要接收返回值

数据库对应类型：DECIMAL(10, 2) / NUMBER(10, 2) / NUMERIC(10, 2)
```

---

# 三十一、HashMap 深入面试题

---

## 一、HashMap 底层结构

### 1. JDK 1.7 和 1.8 的区别？

```
JDK 1.7：数组 + 链表
  ① 哈希冲突 → 头插法插入链表
  ② 多线程扩容时头插法会导致链表成环 → 死循环 ★
  ③ 扩容：先扩容再插入

JDK 1.8：数组 + 链表 + 红黑树
  ① 哈希冲突 → 尾插法插入链表（解决了死循环问题）
  ② 链表长度 > 8 且数组长度 ≥ 64 → 转红黑树
  ③ 红黑树节点 < 6 → 退化为链表
  ④ 扩容：先插入再扩容

为什么是 8 和 6？
  链表查找时间复杂度 O(n)，红黑树 O(log n)
  当 n=8 时：链表需要 8 次比较，红黑树只需 3 次（log8=3）
  泊松分布计算：链表长度达到 8 的概率只有 0.00000006，极其罕见
  6 和 8 之间留了缓冲区，避免频繁转换
```

### 2. HashMap 的 put 流程？（JDK 1.8）

```
① 对 key 做 hash：(h = key.hashCode()) ^ (h >>> 16)
   高 16 位和低 16 位异或 → 减少哈希碰撞（扰动函数）

② 计算数组下标：index = hash & (n - 1)
   等价于 hash % n，但位运算更快
   前提：n 必须是 2 的幂次方

③ 该位置为空 → 直接放入

④ 该位置不为空 → 发生哈希冲突
   → 如果 key 相同（equals）→ 覆盖 value
   → 如果是红黑树节点 → 按红黑树方式插入
   → 如果是链表 → 尾插法插入
     → 插入后链表长度 > 8 → 判断数组长度
       → 数组长度 < 64 → 扩容（而不是转红黑树）
       → 数组长度 ≥ 64 → 链表转红黑树

⑤ 插入后元素个数 > threshold（容量 × 负载因子 0.75）→ 扩容为原来的 2 倍
```

### 3. HashMap 为什么容量必须是 2 的幂次方？

```
① 计算下标用位运算代替取模：
   index = hash & (n - 1) 等价于 hash % n（n 是 2 的幂才成立）
   位运算比取模快得多

② 扩容时元素重新分布更均匀：
   扩容后 n 变为 2n，元素的新位置只有两种可能：
   → 原位置（hash 的新增高位是 0）
   → 原位置 + 旧容量（hash 的新增高位是 1）
   只需要看 hash 的一个 bit 就能决定，不用重新计算
```

### 4. HashMap 的扩容机制？

```
触发条件：元素个数 > 容量 × 负载因子（默认 16 × 0.75 = 12）
扩容大小：原容量 × 2

JDK 1.8 扩容优化：
  不需要重新计算 hash
  只看 hash 值新增的那一位（高位）是 0 还是 1
  → 0：留在原位置
  → 1：移到 原位置 + 旧容量

示例：
  旧容量 n=16，扩容后 n=32
  key 的 hash = 0001 0101
  旧下标 = hash & (16-1) = hash & 0000 1111 = 0101 = 5
  新下标 = hash & (32-1) = hash & 0001 1111 = 1 0101 = 21 = 5 + 16
  新增高位是 1 → 移到 5 + 16 = 21

负载因子为什么是 0.75？
  是空间和时间的折中
  太大（如 1.0）→ 碰撞多，链表长，查找慢
  太小（如 0.5）→ 碰撞少，但空间浪费多
  0.75 是泊松分布下的最优解
```

### 5. HashMap 为什么线程不安全？

```
JDK 1.7：
  多线程扩容时，头插法导致链表成环 → 死循环（CPU 100%）

JDK 1.8（头插改为尾插，解决了死循环）：
  ① 多线程 put → 覆盖丢失
     两个线程同时判断某位置为空 → 都去插入 → 后一个覆盖前一个
  ② 多线程 put + resize → 数据丢失
     一个线程在扩容，另一个在插入 → 插入到旧数组上 → 扩容完丢失
  ③ size 不准确
     size++ 不是原子操作

线程安全替代方案：
  ConcurrentHashMap（推荐）
  Collections.synchronizedMap()（不推荐，性能差）
```

---

# 三十二、JVM 深入面试题

---

## 一、JVM 是什么？Java 代码怎么运行？

```
JVM = Java Virtual Machine（Java 虚拟机）

Java 代码不能直接在 CPU 上运行，需要 JVM 翻译：
  .java 源码 → javac 编译 → .class 字节码 → JVM 翻译 → 机器码 → CPU 执行

JVM 的角色：
  翻译官：把字节码翻译成当前操作系统的机器码
  管家：管理内存分配、垃圾回收、线程调度

这就是 "Write Once, Run Anywhere" 的原理：
  同一份 .class 文件 → 在不同平台的 JVM 上都能运行

JVM 的四大核心组成：
  ┌──────────────────────────────────────────────┐
  │  .class 文件                                  │
  │     ↓                                         │
  │  类加载子系统（ClassLoader）                    │
  │     ↓                                         │
  │  运行时数据区（Runtime Data Areas）— 内存       │
  │     ↓                                         │
  │  执行引擎（Execution Engine）                  │
  │     ↓                                         │
  │  本地方法接口（JNI，Java Native Interface）     │
  └──────────────────────────────────────────────┘
```

---

## 二、类加载机制

### 1. 类的生命周期？

```
一个类从加载到卸载，经历 7 个阶段：

  加载 → 验证 → 准备 → 解析 → 初始化 → 使用 → 卸载
         └───── 连接 ─────┘

【加载 Loading】
  把 .class 文件的二进制数据读入内存
  在方法区创建该类的 Class 对象
  来源：磁盘文件、jar 包、网络、动态代理运行时生成

【验证 Verification】
  检查 .class 格式是否正确、是否安全
  如：魔数是否是 0xCAFEBABE（每个 .class 开头都是这 4 字节）

【准备 Preparation】
  为类的静态变量分配内存 → 设为零值（不是初始值！）
  static int count = 10; → 准备阶段 count = 0 → 初始化阶段才赋值 10
  static final int MAX = 100; → 准备阶段就直接赋值 100（常量特殊处理）

【解析 Resolution】
  把符号引用替换为直接引用（类名字符串 → 内存实际地址）

【初始化 Initialization】
  执行类构造器 <clinit> = 静态变量赋值 + 静态代码块
  触发时机：new、访问静态变量（非 final 常量）、调用静态方法、反射、子类初始化
```

### 2. 类加载器和双亲委派？

```
三层类加载器：
  ┌─────────────────────────────────┐
  │  Bootstrap ClassLoader（启动类） │  加载 JDK 核心类（rt.jar）
  │  C++ 实现，Java 中看到是 null    │  如 java.lang.*
  └──────────────┬──────────────────┘
                 ↓
  ┌──────────────────────────────────┐
  │  Extension/Platform ClassLoader  │  加载 jre/lib/ext 目录
  └──────────────┬───────────────────┘
                 ↓
  ┌──────────────────────────────────┐
  │  Application ClassLoader（应用类）│  加载 classpath 下的类（你写的代码）
  └──────────────────────────────────┘

双亲委派模型（Parent Delegation Model）：
  加载类时先让父加载器尝试 → 父加载器找不到再自己加载
  
  AppClassLoader 收到请求
    → 先问 ExtClassLoader
      → 先问 Bootstrap
        → 找不到 → 返回
      → 找不到 → 返回
    → 自己加载

  为什么这样设计？
    ① 安全性：防止你写 java.lang.String 替换 JDK 的（Bootstrap 先加载 JDK 的）
    ② 唯一性：同一个类只会被加载一次

打破双亲委派的场景：
  ① SPI（Service Provider Interface，服务提供者接口）：
     JDBC 接口在 JDK（Bootstrap）但实现在第三方 jar（App）
     → 用 Thread.currentThread().getContextClassLoader()
  ② Tomcat：每个 Web 应用需要类隔离 → 各有自己的 ClassLoader
  ③ 热部署：不重启更新类 → 用新 ClassLoader 重新加载
```

---

## 三、运行时数据区（JVM 内存结构）

### 1. 整体结构？

```
┌─────────────────────────────────────────────────┐
│                   JVM 运行时数据区                │
├──────────── 线程共享 ────────────────────────────┤
│                                                  │
│  ┌──────────────┐    ┌─────────────────────┐    │
│  │     堆 Heap   │    │  方法区 Method Area  │    │
│  │              │    │  (元空间 Metaspace)  │    │
│  │  对象实例     │    │  类信息、常量池       │    │
│  │  数组         │    │  静态变量、方法信息    │    │
│  └──────────────┘    └─────────────────────┘    │
│                                                  │
├──────────── 线程私有 ────────────────────────────┤
│                                                  │
│  ┌──────────┐ ┌───────────┐ ┌──────────────┐   │
│  │ 虚拟机栈  │ │ 本地方法栈 │ │ 程序计数器 PC │   │
│  │ VM Stack │ │Native Stack│ │  Register    │   │
│  └──────────┘ └───────────┘ └──────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 2. 堆（Heap）？

```
最大的一块内存，几乎所有对象实例和数组都在这里分配
线程共享 → 需要考虑线程安全
GC（Garbage Collection，垃圾回收）的主要工作区域

分代模型：
  ┌────────────────────────────────────────┐
  │  新生代 Young（1/3）  │  老年代 Old（2/3） │
  │  ┌─────┬─────┬─────┐ │                   │
  │  │Eden │ S0  │ S1  │ │                   │
  │  │ 8   │  1  │  1  │ │                   │
  │  └─────┴─────┴─────┘ │                   │
  └────────────────────────────────────────┘

为什么分代？
  IBM 研究：98% 的对象都是"朝生夕死" → 只有 2% 长期存活
  分代后新生代频繁 GC（快，因为大部分是垃圾），老年代少 GC

为什么 Eden:S0:S1 = 8:1:1？
  新生代用复制算法：存活对象从一块复制到另一块
  98% 会死 → 存活的极少 → 10% 空间就够放 → 只浪费 10% 而不是 50%

对象什么时候直接进老年代？
  ① 大对象（-XX:PretenureSizeThreshold）→ 避免在新生代来回复制
  ② 年龄达到阈值（默认 15，-XX:MaxTenuringThreshold）
  ③ 动态年龄判断：Survivor 中同龄对象总大小 > Survivor 的 50%
     → 大于等于该年龄的对象直接晋升
  ④ Minor GC 后存活对象放不下 Survivor → 全部进老年代（担保机制）

参数：
  -Xms：堆初始大小（建议和 -Xmx 一样，避免动态扩容）
  -Xmx：堆最大大小
  -Xmn：新生代大小
  生产常见：-Xms4g -Xmx4g -Xmn1536m
```

### 3. 方法区 / 元空间（Metaspace）？

```
存放：类的元信息、运行时常量池、静态变量、JIT（Just-In-Time，即时编译）编译后的代码

JDK 版本演变：
  JDK 6：方法区 = 永久代（PermGen），在堆内
         字符串常量池、静态变量 → 都在永久代
  JDK 7：字符串常量池、静态变量 → 移到堆
         类信息还在永久代
  JDK 8：永久代彻底删除 → 类信息移到元空间（本地内存）
         字符串常量池、静态变量 → 仍在堆

  为什么废弃永久代？
    ① 永久代大小固定，类多了容易 OOM（OutOfMemoryError: PermGen space）
    ② GC 条件苛刻，垃圾难回收
    ③ 元空间用本地内存 → 理论上只受物理内存限制

参数：
  -XX:MetaspaceSize=256m        初始大小
  -XX:MaxMetaspaceSize=512m     最大大小（建议设上限，防内存泄漏）
```

### 4. 虚拟机栈（VM Stack）？

```
每个线程一个栈，每调用一个方法 → 压入一个栈帧（Stack Frame）

栈帧结构：
  ① 局部变量表：基本类型直接存值，引用类型存地址
  ② 操作数栈：计算用的临时空间
  ③ 动态链接：方法调用时符号引用 → 实际地址
  ④ 方法返回地址

两种异常：
  StackOverflowError：栈深度超限（递归没出口）
  OutOfMemoryError：线程太多，栈空间不够分配

参数：-Xss 每个线程栈大小，默认 512K~1M
```

### 5. 本地方法栈 + 程序计数器？

```
本地方法栈：和虚拟机栈类似，服务于 native 方法（C/C++ 实现）
  如 System.arraycopy()、Thread.start() 底层都是 native

程序计数器（PC Register）：
  记录当前线程执行到哪条字节码指令
  线程切换后能恢复到正确位置
  唯一不会 OOM 的区域
```

### 6. 堆和栈的区别？

```
             堆                    栈
存什么      对象实例                局部变量、方法调用
线程        共享                   私有
大小        大（GB 级）             小（默认 1M/线程）
GC          需要 GC 回收            方法结束自动弹出
异常        OutOfMemoryError       StackOverflowError
速度        慢（需要 GC 管理）       快（直接压栈弹栈）
```

### 7. 对象一定在堆上分配吗？

```
不一定！JIT 的逃逸分析（Escape Analysis）可以优化：

  JVM 分析对象是否"逃逸"到方法外部：
    没逃逸 = 对象只在方法内使用，没有被外部引用
    → 可以做两个优化：
      a. 栈上分配：对象分配在栈帧中 → 方法结束自动释放 → 不需要 GC
      b. 标量替换：把对象拆散成基本类型变量 → 直接放寄存器/栈

  例：
    public void test() {
        Point p = new Point(1, 2);  // p 没逃出 test()
        System.out.println(p.x + p.y);
    }
    → JVM 可能不创建 Point 对象 → 直接把 x=1, y=2 放栈上

【勘误】关于 TLAB（Thread Local Allocation Buffer，线程本地分配缓冲区）：
  ×（错误理解）：TLAB 是"不在堆上分配"的优化
  ✓（正确理解）：TLAB 仍然在堆上（Eden 区），只是给每个线程划了一小块私有区域
    → 分配对象时不用加锁（因为是线程私有的地盘）→ 提升分配速度
    → 但对象最终还是在堆上 → 仍然需要 GC 回收
    → TLAB 解决的是"堆上分配的效率问题"，不是"不在堆上分配"
```

## 四、垃圾回收

### 1. 怎么判断对象可以被回收？

```
【引用计数法】（Java 没用这个）
  每个对象有一个引用计数器，有引用 +1，引用失效 -1，为 0 就回收
  致命缺陷 → 循环引用：
    A objA = new A(); B objB = new B();
    objA.b = objB; objB.a = objA;
    objA = null; objB = null;
    → A 和 B 互相引用 → 计数都是 1 → 永远回收不了

【可达性分析】（Java 用的）★
  从一组 GC Roots 出发，沿引用链往下找
  能到达的对象 → 存活
  不能到达的对象 → 垃圾

  GC Roots 包括（简记："栈里的、静态的、常量的、锁住的"）：
    ① 虚拟机栈中引用的对象（方法的局部变量）
    ② 方法区中静态变量引用的对象
    ③ 方法区中常量引用的对象
    ④ 本地方法栈中 JNI（Java Native Interface）引用的对象
    ⑤ synchronized 锁持有的对象

  为什么堆里的对象不能当 GC Roots？
    GC 的目的就是回收堆里的垃圾
    如果堆里对象能当根 → 互相引用的对象都"可达" → 回退到引用计数的老问题
    → GC Roots 必须是"堆外面指向堆里面"的引用
    → 裁判不能当选手

  注意：堆中对象之间的引用影响可达性链路
    GC Root → A → B → C，则 B 和 C 可达 → 不回收
    但 B 和 C 自己不能充当"起点"
```

### 2. 对象被判定为垃圾后立刻回收吗？

```
不会！还有一次"缓刑"机会：finalize() 方法

  ① 第一次标记：不可达 → 进入"即将回收"队列
  ② 检查是否重写了 finalize()
     没重写 → 直接回收
     重写了 → 放入 F-Queue，由低优先级线程执行 finalize()
  ③ 如果在 finalize() 中把自己重新连到 GC Roots → 复活
  ④ finalize() 只会被调用一次 → 第二次就直接回收

  实际开发：永远不要依赖 finalize()
    执行时间不确定，可能根本不执行
    JDK 9 已标记为 @Deprecated
```

### 3. 四种引用类型？

```
Java 的引用有四个级别（强度递减）：

  强引用（Strong）：Object obj = new Object();
    只要强引用在 → 永远不回收，OOM 也不回收
    obj = null → 断开强引用 → 可回收

  软引用（Soft）：SoftReference<T>
    内存够 → 不回收；内存不够（即将 OOM）→ 回收
    适合做缓存：内存够就留着，不够就让 GC 清

  弱引用（Weak）：WeakReference<T>
    不管内存够不够 → 下次 GC 就回收
    ThreadLocal 内部的 Entry 就是弱引用

  虚引用（Phantom）：PhantomReference<T>
    随时可能被回收，get() 永远返回 null
    唯一作用：对象被回收时收到通知（放入 ReferenceQueue）
    NIO 的 DirectByteBuffer 用它来释放堆外内存

强度排序：强 > 软 > 弱 > 虚
```

### 4. 垃圾回收算法？

```
① 标记-清除（Mark-Sweep）
   标记存活对象 → 清除未标记的
   优点：简单
   缺点：产生内存碎片 → 大对象找不到连续空间 → 提前触发 GC

② 标记-复制（Mark-Copy）
   内存分两块：From 区和 To 区
   GC 时把 From 中存活对象复制到 To → 清空 From → 角色互换
   优点：没有碎片，分配快（指针碰撞）
   缺点：浪费一半空间
   改进：新生代 Eden:S0:S1 = 8:1:1 → 只浪费 10%
   新生代用这个 ✅

③ 标记-整理（Mark-Compact）
   标记存活对象 → 存活对象向一端移动 → 清除边界外的
   优点：没有碎片
   缺点：移动对象开销大（要更新引用地址）
   老年代用这个 ✅

三种算法对比：
                标记-清除       标记-复制       标记-整理
  碎片          有 ❌           无 ✅           无 ✅
  空间利用率    高              低（浪费一半）    高
  速度          中              快               慢
  适合          -              新生代            老年代

④ 分代收集（Generational）
   不同代用不同算法：
     新生代（98% 对象会死）→ 标记-复制（快，浪费少）
     老年代（存活率高）    → 标记-清除或标记-整理
```

### 5. Minor GC、Major GC、Full GC？

```
Minor GC（Young GC）：
  只回收新生代，频繁但快（毫秒级）
  触发：Eden 区满了

Major GC：
  只回收老年代（概念上，实际很多收集器不单独回收老年代）

Full GC：
  回收整个堆 + 方法区，慢（可达秒级），STW 时间长
  触发条件：
    ① 老年代空间不足
    ② 元空间空间不足
    ③ System.gc()（建议性，不保证执行）
    ④ Minor GC 后存活对象放不进老年代（担保失败）
    ⑤ CMS 出现 Concurrent Mode Failure

STW = Stop The World：GC 时暂停所有应用线程
  所有收集器都有 STW，只是时间长短不同
```

---

## 五、垃圾收集器

### 1. 收集器全家谱？

```
按时间线演进：
  Serial → Parallel → CMS → G1 → ZGC
  (JDK1.3)  (JDK1.4)  (JDK5)  (JDK9)  (JDK15)

JDK 版本默认收集器：
  JDK 8 默认：Parallel Scavenge + Parallel Old
  JDK 9+ 默认：G1

搭配关系：
  新生代              老年代              能搭配
  Serial              Serial Old          Serial ↔ Serial Old
  ParNew              CMS                 ParNew ↔ CMS
  Parallel Scavenge   Parallel Old        Parallel ↔ Parallel Old
  G1 / ZGC            （整堆，不分）
```

### 2. Serial / Serial Old？

```
最古老最简单的收集器
  Serial（新生代）：标记-复制，单线程
  Serial Old（老年代）：标记-整理，单线程
  GC 全程 STW，只有一个 GC 线程工作

  优点：简单，没有线程切换开销，单核效率最高
  缺点：STW 时间长
  适用：客户端模式、嵌入式、小堆；CMS 的兜底方案
  参数：-XX:+UseSerialGC
```

### 3. Parallel Scavenge / Parallel Old？

```
吞吐量优先收集器 ★ JDK 8 默认
  Parallel Scavenge（新生代）：标记-复制，多线程并行
  Parallel Old（老年代）：标记-整理，多线程并行

  吞吐量 = 应用运行时间 / (应用运行时间 + GC 时间)
  例：100 秒里 GC 花 1 秒 → 吞吐量 99%

  STW + 多 GC 线程并行 → 比 Serial 快但应用仍然暂停
  适用：后台计算、批处理（不在乎偶尔卡一下）

  参数：
    -XX:+UseParallelGC                → 启用（JDK 8 默认）
    -XX:ParallelGCThreads=N           → GC 线程数（默认 = CPU 核数）
    -XX:MaxGCPauseMillis=200          → 目标停顿时间
    -XX:GCTimeRatio=99                → 目标吞吐量 99%
    -XX:+UseAdaptiveSizePolicy        → 自适应调节（自动调新生代大小）
```

### 4. CMS — 第一个并发收集器？

```
CMS = Concurrent Mark Sweep（并发标记清除）
作用范围：只管老年代（必须搭配 ParNew 管新生代）
算法：标记-清除（不是标记-整理！所以有碎片）
目标：最短停顿时间

"并发"的含义：GC 线程和应用线程同时运行
  区别于"并行"：多个 GC 线程同时工作但应用暂停

四个阶段：
  ① 初始标记（Initial Mark）      — STW ⚡短
     只标记 GC Roots 直接引用的对象（一层）
     速度快

  ② 并发标记（Concurrent Mark）   — 不 STW ✅ 最耗时
     从初始标记的对象往下遍历，标记所有可达对象
     和应用线程并发 → 用户无感
     用增量更新（Incremental Update）处理并发期间的引用变化

  ③ 重新标记（Remark）            — STW ⚡中
     修正并发标记期间因应用线程运行产生的标记变化
     比初始标记慢，但远快于并发标记

  ④ 并发清除（Concurrent Sweep）  — 不 STW ✅
     清理未标记的垃圾对象
     和应用线程并发

  时间轴：
    应用线程  ─┤暂┤──────────────────┤暂┤─────────────
    GC 线程     [初标]  [并发标记]      [重标]  [并发清除]

三大缺点 ★ 面试必问：
  ❶ CPU 敏感
     并发阶段占 CPU → 应用线程能用的 CPU 少了
     GC 线程数 = (CPU 核数 + 3) / 4
     4 核 → 1 个 GC 线程，还行；2 核 → 1 个 GC 线程，应用只剩 1 核

  ❷ 浮动垃圾（Floating Garbage）
     并发清除时应用还在产生垃圾 → 本次来不及清 → 等下次
     → 老年代不能满了才 GC → 默认 92% 触发
     → 预留空间不够 → Concurrent Mode Failure
       → 退化为 Serial Old（单线程标记-整理）→ 长时间 STW ❌

  ❸ 内存碎片（标记-清除算法的锅）
     碎片太多 → 大对象找不到连续空间 → 触发 Full GC
     -XX:+UseCMSCompactAtFullCollection → Full GC 时压缩（默认开）

  CMS 只管老年代，新生代怎么办？
    必须搭配 ParNew（多线程标记-复制）
    -XX:+UseConcMarkSweepGC → 自动设新生代为 ParNew

  历史：JDK 9 标记废弃，JDK 14 彻底移除
```

### 5. G1 — 当代主流 ★★★

```
G1 = Garbage First
JDK 9+ 默认收集器
三个核心目标：
  ① 可预测的停顿时间 → 用户设目标（如 200ms），G1 尽量达到
  ② 大堆（6GB 以上）不崩溃
  ③ 兼顾吞吐量和低延迟

【Region 分区 — G1 的基本单位】

  G1 把堆切成约 2048 个大小相等的 Region（默认目标）
  Region 大小：1MB~32MB（必须是 2 的幂，自动 = 堆大小/2048）
  手动设置：-XX:G1HeapRegionSize=8m

  每个 Region 可动态扮演 5 种角色：
    ┌────┬────┬────┬────┬────┬────┬────┬────┐
    │Eden│ S  │Old │ H  │Eden│Old │Free│ S  │
    └────┴────┴────┴────┴────┴────┴────┴────┘
    Eden = 新生代 Eden
    S = Survivor
    Old = 老年代
    H = Humongous（大对象，超过 Region 50%）
    Free = 空闲

  角色可动态变化 → 不需要固定新生代/老年代比例
  大对象（> Region 50%）→ 直接分配到 H Region → 避免频繁复制

【为什么叫 Garbage First？】
  G1 跟踪每个 Region 的垃圾数量和回收成本
  优先回收垃圾最多、收益最高的 Region
  → 在停顿预算内换最大空间释放

【G1 的三种 GC 类型】

  ① Young GC（新生代回收）
     触发：Eden 满了
     范围：所有 Eden + Survivor Region
     算法：标记-复制
     过程：存活对象复制到新 Survivor → 清空原 Region

  ② Mixed GC（混合回收）★ G1 核心特色
     触发：老年代占堆比例超过阈值（默认 45%）
     范围：所有 Young Region + 部分 Old Region（垃圾最多的）
     "混合" = 同时回收新生代和老年代

     不是一次回收所有老年代，而是分多次（默认 8 次）
     每次只选收益最高的部分 Old Region

     Mixed GC 的四步：
       a. 初始标记（STW）— 标记 GC Roots 直接引用，搭 Young GC 一起做
       b. 并发标记（不 STW）— 遍历标记所有存活对象
          用 SATB（Snapshot At The Beginning，原始快照）算法
       c. 最终标记（STW）— 处理并发期间的引用变化
       d. 筛选回收（STW）— 选择 Region 并复制存活对象到新 Region

     ★ 筛选回收阶段是 STW 的（和 CMS 的并发清除不同）
       → 优点：没有浮动垃圾、没有碎片（复制算法）
       → 缺点：每次 Mixed GC 都有 STW（通过分多次控制时长）

  ③ Full GC（兜底）
     触发：Mixed GC 跟不上分配速度（Evacuation Failure）
     算法：标记-整理
     JDK 10+ 改为多线程并行
     调优目标：尽量避免

【G1 关键技术 — 深入解析】

  ═══════════════════════════════════════════════════════════
  ① Remembered Set（RSet，记忆集）
  ═══════════════════════════════════════════════════════════

  【为什么需要 RSet？— 跨代引用问题】

    Young GC 只回收新生代，但老年代对象可能引用新生代对象：
      Old Region 中的 OldObj → 引用了 → Young Region 中的 YoungObj

    关键理解：Young GC 的根集合 ≠ 只有 GC Roots
      GC Roots 解决"堆外 → 堆内"的引用（栈变量、静态变量等）
      但 Young GC 不回收老年代 → 老年代对象在本次 GC 中"一定存活"
      → 它引用的新生代对象也必须存活
      → Young GC 的根集合 = GC Roots + 老年代对新生代的引用（跨代引用）

    如果没有 RSet → 每次 Young GC 都要扫描整个老年代找跨代引用
      老年代可能几个 GB → 等于做了 Full GC → Young GC 就不"young"了

    有了 RSet → 每个 Region 记录"谁引用了我" → GC 时查表即可

  【RSet 的分层数据结构】

    RSet 不是简单列表，而是三级精度结构（按引用数量自动升级）：

    稀疏模式（Sparse）：
      直接记录 <来源 Region, Card 索引>
      引用少时用 → 内存占用小

    细粒度模式（Fine）：
      每个来源 Region 一个 BitMap（位图）
      每一位代表一个 Card（512B），为 1 表示该 Card 里有引用指向我

    粗粒度模式（Coarse）：
      只记录"哪些 Region 引用了我"，不记录具体 Card
      GC 时要扫描整个来源 Region → 慢，但节省 RSet 内存

    演进路径：引用少 → Sparse → 超阈值 → Fine → 超阈值 → Coarse

    RSet 内存开销：正常 1%~5% 堆，极端（图结构）可达 10%+

  ═══════════════════════════════════════════════════════════
  ② Card Table（卡表）— RSet 的底层基础设施
  ═══════════════════════════════════════════════════════════

    把整个堆划分为固定 512B 的"卡片"（Card）
    Card Table = 一个字节数组，每字节对应一个 Card
    堆 4GB → Card 数 = 4GB / 512B = 800 万 → Card Table ≈ 8MB

    Card 状态：
      Clean（干净）= 0：该 Card 最近没有引用变化
      Dirty（脏）  = 1：该 Card 里的引用最近被修改了

    Card Table 和 RSet 的关系：
      Card Table → 记录"哪些 Card 脏了"（全局一份，粗筛）
      RSet → 记录"谁引用了我"（每个 Region 一份，精确）
      Card Table 是快速标记变化的第一层 → RSet 是精确记录引用的第二层

  ═══════════════════════════════════════════════════════════
  ③ G1 的两个写屏障、两个队列 ★ 重要区分
  ═══════════════════════════════════════════════════════════

    G1 在每次引用赋值（objA.field = objB）时触发两个写屏障：
    假设 field 原来指向 objC

    ┌─────────────────────────────────────────────────────┐
    │ Pre-Write Barrier（赋值前屏障）→ SATB Queue         │
    │   记录旧值 objC → 防止并发标记漏标                   │
    │   仅在并发标记阶段激活                               │
    │                                                     │
    │ 执行赋值：field = objB                               │
    │                                                     │
    │ Post-Write Barrier（赋值后屏障）→ Dirty Card Queue   │
    │   把 objA 所在 Card 标记为脏 → 用于维护 RSet         │
    │   始终激活（不管是否在并发标记阶段）                   │
    └─────────────────────────────────────────────────────┘

    两个队列对比：
                  SATB Queue              Dirty Card Queue
    触发时机     赋值前（pre-write）       赋值后（post-write）
    记录什么     旧值（被覆盖的引用）      哪个 Card 被修改了
    解决什么     并发标记漏标问题          跨 Region 引用追踪
    谁消费       并发标记线程              Refinement（精炼）线程
    何时激活     仅并发标记期间            始终激活

    Dirty Card Queue 处理流程：
      写屏障把脏卡入队 → Refinement 线程异步消费：
        找到脏卡里的引用关系 → 更新被引用 Region 的 RSet → Card 重置 Clean
      线程数：-XX:G1ConcRefinementThreads（并发精炼线程数）
      如果队列堆积 → 应用线程也被迫帮忙处理（G1 的自适应机制）

    这就是 G1 吞吐量比 Parallel 低 5-10% 的原因：
      每次引用赋值 = 两个写屏障 + 队列 + 后台线程
      CMS 只有 post-write 一个屏障 → G1 的屏障更重

  ═══════════════════════════════════════════════════════════
  ④ SATB（Snapshot At The Beginning，原始快照）
  ═══════════════════════════════════════════════════════════

  【三色标记法 — 并发标记的基础】

    标记过程中每个对象有三种颜色：
      黑色：自己和所有子引用都标记完了 → 确定存活
      灰色：自己标记了，子引用还没标记完 → 正在处理
      白色：还没被标记 → 标记结束后白色 = 垃圾

  【并发标记的漏标问题】

    GC 线程在标记 → 应用线程在修改引用 → 可能漏标

    漏标条件（必须同时满足）：
      ① 某个黑色对象新增了对白色对象的引用
      ② 灰色对象到该白色对象的所有引用路径被断开

    例：
      初始：A(黑) → B(灰) → C(白)
      应用线程并发做了：
        1. A.field = C    （黑色 A 直接引用白色 C）
        2. B.field = null  （灰色 B 断开对 C 的引用）
      结果：C 还是白色 → 被误判为垃圾 → 回收了活对象 ❌

  【SATB 怎么解决？】

    策略 = 破坏条件②：关注"引用被删除"
    当灰色对象断开对白色对象的引用时 → Pre-Write Barrier 记录旧值

    B.field = null 时：
      屏障在赋值前拦截 → 把旧值 C 放入 SATB Queue
      → 最终标记（Final Mark）阶段重新检查 C → 不会漏标

    代价：可能多标
      如果 C 确实已无其他引用 → SATB 仍保留它 → 浮动垃圾
      → 下次 GC 再回收
      → 宁可多标（浮动垃圾）不可漏标（误回收活对象）

  【SATB vs CMS 的增量更新（Incremental Update）】

                      SATB（G1 用）           增量更新（CMS 用）
    关注点           引用删除（旧值）          引用新增（新值）
    破坏条件          条件②                   条件①
    屏障位置          pre-write（赋值前）       post-write（赋值后）
    浮动垃圾          多一些                   少
    重新标记耗时      短 ✅                    长 ❌

    G1 选 SATB 的原因：
      重新标记（Final Remark）阶段 STW 更短 → 停顿更可控
      浮动垃圾对 G1 影响小 → Mixed GC 本来就分批回收

  ═══════════════════════════════════════════════════════════
  ⑤ Collection Set（CSet，回收集）
  ═══════════════════════════════════════════════════════════

    CSet = 本次 GC 决定要回收的 Region 集合

    Young GC 的 CSet：所有 Eden Region + 所有 Survivor Region（固定）
    Mixed GC 的 CSet：所有 Young Region + 部分 Old Region（按收益选）

    Mixed GC 选 Old Region 的逻辑：
      对每个 Old Region 计算：回收能释放的空间 / 预估耗时 = 收益
      按收益降序 → 累加耗时不超过停顿预算 → 停止选择

    控制参数：
      -XX:G1MixedGCLiveThresholdPercent=85
        （混合GC存活率阈值）存活率 > 85% 的 Region 不选
      -XX:G1OldCSetRegionThresholdPercent=10
        （老年代CSet占比上限）每次最多选 10% 的 Old Region
      -XX:G1MixedGCCountTarget=8
        （混合GC目标次数）一个周期内做 8 次 Mixed GC → 分摊压力

    为什么不一次回收所有老年代？
      老年代可能几百个 Region → 一次全回收 STW 太长
      G1 = 化整为零：每次只选最"值得"的 → 保证 STW 在预算内

  ═══════════════════════════════════════════════════════════
  ⑥ 停顿预测模型
  ═══════════════════════════════════════════════════════════

    -XX:MaxGCPauseMillis（最大GC停顿毫秒数）不是硬限制
    而是 G1 尽力遵守的"软目标"

    实现 = 基于历史数据的衰减均值（Decaying Average）：

    G1 维护的数据：
      每个 Region 的存活对象数量
      每个 Region 的上次回收耗时
      RSet 扫描耗时
      复制存活对象的速率（MB/ms）

    衰减均值 = 近期数据权重更高：
      avg_new = α × latest + (1-α) × avg_old （α 一般 0.3~0.7）

    GC 决策过程：
      ① 对每个 Old Region 预估回收耗时
      ② 按"收益/耗时"降序排列
      ③ 贪心选择：累加 ≤ MaxGCPauseMillis → 停 → 构成 CSet

    为什么是"软目标"？
      ① 预测不准：实际存活对象可能比预估多
      ② 固定开销：GC 启动、根扫描、RSet 处理等无法避免
      ③ Young Region 必须全部回收 → Young 太多时光回收 Young 就超时

    经验值：
      Web 服务：100-300ms
      批处理：500ms-1s
      实时交易：< 50ms（考虑用 ZGC）

    调优注意：
      设太小 → 每次只敢选很少 Region → 回收跟不上分配 → Full GC
      设太大 → STW 长 → 用户感知卡顿

【G1 vs CMS 对比】
                  G1                    CMS
  算法           复制 + 标记-整理        标记-清除
  碎片           无 ✅                   有 ❌
  作用范围       整堆（Region）           只老年代
  可预测停顿     ✅ 有目标               ❌ 无
  浮动垃圾       少                      多
  兜底失败       Full GC（可多线程）     → Serial Old
  状态           JDK 9+ 默认             JDK 14 移除

【G1 常用参数】
  -XX:+UseG1GC                           启用（JDK 9+ 默认）
  -XX:MaxGCPauseMillis=200               停顿时间目标（默认 200ms）
  -XX:G1HeapRegionSize=8m                Region 大小
  -XX:InitiatingHeapOccupancyPercent=45  触发并发标记的老年代占比
  -XX:G1NewSizePercent=5                 新生代最小占比
  -XX:G1MaxNewSizePercent=60             新生代最大占比
  -XX:G1MixedGCCountTarget=8             一个周期内 Mixed GC 次数
  -XX:ConcGCThreads=N                    并发标记线程数
  -XX:ParallelGCThreads=N                STW 阶段 GC 线程数
```

### 6. ZGC — 超低延迟？

```
ZGC = Z Garbage Collector
JDK 11 实验性引入，JDK 15 正式可用
目标：STW < 1ms，不随堆大小增长

核心技术：
  ① 着色指针（Colored Pointers）：在 64 位指针高位存 GC 状态
  ② 读屏障（Load Barrier）：应用线程读对象时自动修正引用
  ③ 并发整理：标记、转移、重定位全部并发

特点：
  ✅ 超低延迟（< 1ms）
  ✅ 支持 TB 级大堆
  ❌ 吞吐量略低于 G1（约 15%）
  ❌ 占用内存多

参数：-XX:+UseZGC
适用：金融交易、实时响应、超大堆

面试简答：
  "JDK 8 默认 Parallel，追求吞吐量；
   JDK 9+ 默认 G1，兼顾吞吐量和停顿时间，适合大堆；
   JDK 15+ 可用 ZGC，停顿 < 1ms。"
```

---

## 六、G1 调优生产案例

### 案例 1：频繁 Young GC 导致接口抖动

```
场景：电商接口平均 50ms，每隔几秒突然飙到 200ms+
  堆 8GB，JDK 11，G1 默认配置

排查：GC 日志发现 Young GC 每秒 2-3 次，每次 STW 80-120ms
  原因：MaxGCPauseMillis=200 → G1 把新生代压很小 → GC 频率暴增

调优：
  方案 1：-XX:MaxGCPauseMillis=300（放宽停顿目标）
  方案 2：-XX:G1NewSizePercent=20（新生代最小 20%）

结果：Young GC 从 2-3次/秒 → 1次/3秒，抖动消失

经验：MaxGCPauseMillis 设太低 → 新生代被压小 → GC 频率反而暴增
```

### 案例 2：Mixed GC 跟不上 → Full GC

```
场景：日志采集服务，高峰期每隔 10-20 分钟 Full GC，STW 3-5 秒
  堆 16GB

排查：老年代涨太快，并发标记还没做完老年代就满了 → Evacuation Failure

调优：
  ① -XX:InitiatingHeapOccupancyPercent=30（提前触发并发标记，默认 45）
  ② -XX:ConcGCThreads=4（加速并发标记）
  ③ -XX:G1MixedGCCountTarget=6（每轮回收更多 Region）

结果：Full GC 完全消失

经验：高分配速率场景 → 必须提前触发并发标记
  InitiatingHeapOccupancyPercent 是 G1 最关键的调优参数之一
```

### 案例 3：大对象 Humongous 导致频繁 GC

```
场景：报表导出服务，导出大 Excel 时 GC 频率突增
  堆 8GB，Region = 4MB → Humongous 阈值 = 2MB

排查：GC 日志频繁 "G1 Humongous Allocation"
  报表 byte[] 数组 > 2MB → 全部成 Humongous → 只在 Full GC 时回收

调优：
  -XX:G1HeapRegionSize=16m → Humongous 阈值变 8MB → 大部分数组不再是 Humongous
  + 业务层改为流式写入（减少大数组）

结果：Humongous 几乎为零，Full GC 消失

经验：看到 "Humongous Allocation" → 调大 Region Size 或从代码减少大数组
```

### 案例 4：对象过早晋升 → 老年代增长过快

```
场景：高并发服务，老年代增长很快，Mixed GC 压力大
  大量短命 DTO 对象在年龄 2-3 就晋升了

排查：-XX:+PrintTenuringDistribution 查看年龄分布
  原因：Survivor 太小 → 动态年龄判断触发过早

调优：
  -XX:G1NewSizePercent=30（加大新生代 → Survivor 变大）
  -XX:TargetSurvivorRatio=70（默认 50 → 70，更晚触发动态晋升）

结果：老年代增长速度降低 60%

经验：老年代涨太快 → 先看对象年龄分布 → Survivor 太小是常见原因
```

### 案例 5：内存泄漏 → Full GC 后老年代不降

```
场景：运行一周后响应越来越慢，Full GC 频率上升，最终 OOM

排查：
  GC 日志：每次 Full GC 后老年代释放越来越少 → 有活对象持续增长
  堆 dump 分析：HashMap 持续增长（重试 Map 没有清除逻辑）

修复：加过期清理逻辑 + 限制 Map 大小

经验：
  Full GC 后老年代不降 → 90% 是内存泄漏
  调 GC 参数没用 → 必须 dump 堆分析
  常见泄漏源：
    ① 静态集合不断 add 不 remove
    ② 连接/流没 close
    ③ ThreadLocal 没 remove（线程池场景）
    ④ 监听器注册后没注销
```

---

## 七、JVM 调优参数与线上排查

### 1. 常用参数速查？

```
堆内存：
  -Xms4g          初始堆大小（建议和 Xmx 一样）
  -Xmx4g          最大堆大小
  -Xmn1536m       新生代大小

栈内存：
  -Xss256k        每个线程栈大小（默认 512K~1M）

元空间：
  -XX:MetaspaceSize=256m       初始大小
  -XX:MaxMetaspaceSize=512m    最大大小

GC 收集器：
  -XX:+UseG1GC                           G1（JDK 9+ 默认）
  -XX:+UseParallelGC                     Parallel（JDK 8 默认）
  -XX:+UseZGC                            ZGC（JDK 15+）

G1 调优：
  -XX:MaxGCPauseMillis=200               停顿目标（默认 200ms）
  -XX:InitiatingHeapOccupancyPercent=45  触发并发标记阈值
  -XX:G1HeapRegionSize=8m                Region 大小
  -XX:G1NewSizePercent=5                 新生代最小比例
  -XX:G1MaxNewSizePercent=60             新生代最大比例
  -XX:ConcGCThreads=N                    并发 GC 线程数
  -XX:ParallelGCThreads=N                STW 阶段线程数

GC 日志（JDK 9+）：
  -Xlog:gc*:file=gc.log:time,level,tags

GC 日志（JDK 8）：
  -XX:+PrintGCDetails -XX:+PrintGCDateStamps -Xloggc:gc.log

OOM 排查：
  -XX:+HeapDumpOnOutOfMemoryError
  -XX:HeapDumpPath=/tmp/heapdump.hprof
```

### 2. 线上问题排查工具？

```
命令行工具：
  jps            查看 Java 进程 PID
  jstack <pid>   查看线程堆栈（排查死锁、CPU 100%）
  jmap <pid>     查看堆内存（导出堆快照）
  jstat <pid>    查看 GC 统计信息（GC 次数、耗时）
  jinfo <pid>    查看/修改 JVM 参数

Arthas（阿里开源，生产最常用）：
  dashboard         CPU、内存、线程概览
  thread -b         找阻塞线程
  thread -n 3       找最忙的 3 个线程
  trace <class> <method>  方法调用链路耗时
  watch <class> <method>  观察方法出入参
  heapdump          导出堆快照
  jad <class>       反编译线上代码
  sc/sm             搜索类/方法
```

### 3. CPU 100% 排查步骤？

```
① top 找到占 CPU 高的 Java 进程 PID
② top -Hp <PID> 找到占 CPU 高的线程 TID
③ printf '%x' <TID> 转成十六进制
④ jstack <PID> | grep <hex_TID> -A 30
   → 看到线程堆栈，定位到代码行

常见原因：
  死循环 / 正则回溯 / 频繁 Full GC / 大量线程竞争锁

或者用 Arthas（更方便）：
  thread -n 3   → 直接看最忙的 3 个线程堆栈
```

### 4. OOM 排查步骤？

```
① 看异常类型定方向：
   java.lang.OutOfMemoryError: Java heap space → 堆不够
   java.lang.OutOfMemoryError: Metaspace → 类太多/动态代理过多
   java.lang.OutOfMemoryError: unable to create new native thread → 线程太多

② 堆 OOM 排查：
   加 -XX:+HeapDumpOnOutOfMemoryError → OOM 时自动 dump
   或 jmap -dump:format=b,file=heap.hprof <pid> → 手动 dump

③ 分析 dump：
   用 MAT（Memory Analyzer Tool）或 VisualVM
   → 找到 Dominator Tree 中占用最大的对象
   → 看引用链（Shortest Paths to GC Roots）
   → 定位代码中谁在持有这些对象

④ 常见原因：
   大集合无限增长（Map/List 只 add 不 remove）
   数据库查询未分页（一次查几百万条全加载到内存）
   ThreadLocal 未 remove（线程池复用线程 → 值一直累积）
   连接/流未 close
```

### 5. G1 调优核心思路？

```
原则：先看 GC 日志定位问题类型 → 针对性调参数 → 最后考虑代码优化

目标                         调整方向
───────────────────────────────────────────────────
降低 GC 频率               MaxGCPauseMillis 调大 / G1NewSizePercent 调大
避免 Full GC              InitiatingHeapOccupancyPercent 调低 / ConcGCThreads 调大
减少 Humongous            G1HeapRegionSize 调大
减少过早晋升              G1NewSizePercent 调大 / TargetSurvivorRatio 调大

典型生产配置（8GB 堆的 Web 服务）：
  -Xms8g -Xmx8g
  -XX:+UseG1GC
  -XX:MaxGCPauseMillis=200
  -XX:InitiatingHeapOccupancyPercent=40
  -XX:+HeapDumpOnOutOfMemoryError
  -XX:HeapDumpPath=/tmp/heapdump.hprof
  -Xlog:gc*:file=/var/log/gc.log:time,level,tags
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

# 三十四、消息队列与微服务面试题

---

## 一、RabbitMQ

### 1. 如何保证消息不丢失？

```
消息从生产到消费有三个环节可能丢失：

【生产者 → Broker】可能丢失
  解决：Publisher Confirm（发布确认）
    生产者发消息后等待 Broker 确认
    Broker 持久化成功 → 返回 ACK
    失败 → 返回 NACK → 生产者重发
    
    rabbitTemplate.setConfirmCallback((data, ack, cause) -> {
        if (!ack) {
            // 消息发送失败，重发或记录日志
        }
    });

【Broker 本身】可能丢失（宕机）
  解决：持久化
    ① 交换机持久化：durable = true
    ② 队列持久化：durable = true
    ③ 消息持久化：deliveryMode = 2
    三个都要设置，缺一不可

【Broker → 消费者】可能丢失
  解决：手动 ACK
    默认自动 ACK → 消息一推送就删除，消费者还没处理完就挂了 → 丢失
    改为手动 ACK → 消费者处理完业务后手动确认
    没确认的消息 → Broker 重新投递
    
    spring.rabbitmq.listener.simple.acknowledge-mode=manual
    channel.basicAck(tag, false);   // 手动确认
```

### 2. 如何保证消息幂等性（不重复消费）？

```
消息重复场景：
  消费者处理完了但 ACK 失败 → Broker 重新投递 → 重复消费

解决方案：
  ① 全局唯一 ID + Redis 去重
     每条消息带一个唯一 ID（如 UUID / 业务 ID）
     消费前先查 Redis → 已存在则跳过 → 不存在则处理并写入 Redis
     
  ② 数据库唯一约束
     INSERT 时用唯一键约束，重复插入会报错 → catch 异常跳过

  ③ 乐观锁
     UPDATE ... SET status=1 WHERE id=xxx AND status=0
     第一次执行影响行数=1，第二次影响行数=0（因为 status 已经是 1）
```

### 3. 什么是死信队列？

```
消息变成死信的三种情况：
  ① 消息被 reject / nack 且 requeue=false（消费者拒绝且不重新入队）
  ② 消息 TTL 过期
  ③ 队列达到最大长度

死信消息会被发送到绑定的死信交换机（DLX）→ 死信队列

用途：
  延迟队列：消息设置 TTL → 到期变成死信 → 进入死信队列 → 消费者处理
  示例：下单后 30 分钟未支付自动取消
    ① 下单时发消息到普通队列，TTL=30分钟
    ② 30 分钟后消息过期 → 进入死信队列
    ③ 消费者消费死信 → 查订单状态 → 未支付则取消
```

## 二、Spring Cloud 组件

### 1. Nacos 注册中心和配置中心原理？

```
【注册中心】
  服务启动时向 Nacos 注册（IP + 端口 + 服务名）
  Nacos 维护服务实例列表
  消费者从 Nacos 拉取服务列表 → 本地缓存 → 负载均衡调用

  健康检查：
    临时实例：客户端主动发心跳（默认 5 秒），15 秒没心跳标记不健康，30 秒删除
    永久实例：Nacos 主动探测

  和 Eureka 的区别：
    Nacos 支持 CP + AP 切换（Raft 协议 / Distro 协议）
    Eureka 只支持 AP（最终一致性）
    Nacos 临时实例 = AP，永久实例 = CP

【配置中心】
  配置存储在 Nacos Server（MySQL）
  客户端启动时拉取配置
  配置变更 → Nacos 推送通知 → 客户端拉取最新配置 → @RefreshScope 刷新 Bean
  长轮询机制：客户端发请求 → 服务端 hold 住（29.5秒）→ 有变更立即返回
```

### 2. Gateway 网关的作用和原理？

```
作用：统一入口、路由转发、鉴权、限流、日志

核心概念：
  Route：路由规则（id + uri + predicates + filters）
  Predicate：断言，判断请求是否匹配（Path、Method、Header等）
  Filter：过滤器，请求前后增强（鉴权、限流、日志等）

执行流程：
  请求进来
  → DispatcherHandler
  → RoutePredicateHandlerMapping（匹配路由）
  → FilteringWebHandler（执行过滤器链）
    → GlobalFilter（全局过滤器：鉴权、日志）
    → GatewayFilter（路由级过滤器）
    → NettyRoutingFilter（转发请求到下游服务）
  → 下游服务响应
  → 响应过滤器处理
  → 返回客户端

自定义全局过滤器（鉴权示例）：
  @Component
  public class AuthFilter implements GlobalFilter, Ordered {
      public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
          String token = exchange.getRequest().getHeaders().getFirst("Authorization");
          if (token == null) {
              exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
              return exchange.getResponse().setComplete();
          }
          // 验证 token ...
          return chain.filter(exchange);
      }
      public int getOrder() { return 0; } // 越小越先执行
  }
```

### 3. Sentinel 限流降级原理？

```
【限流】
  QPS 限流：每秒允许的请求数
  线程数限流：允许同时处理的线程数

  限流算法：
    滑动窗口：默认，统计精度高
    令牌桶：匀速排队，适合突发流量
    漏桶：固定速率处理

【降级（熔断）】
  三种策略：
    慢调用比例：RT 超过阈值的请求比例超标 → 熔断
    异常比例：异常请求比例超标 → 熔断
    异常数：异常请求数超标 → 熔断

  熔断状态机：
    Closed（正常）→ 触发条件 → Open（熔断，直接降级）
    → 经过恢复时间 → Half-Open（半开，放一个请求试试）
    → 成功 → Closed / 失败 → Open

  和 Hystrix 的区别：
    Sentinel：基于滑动窗口，实时统计，规则可动态配置
    Hystrix：基于线程池隔离，已停止维护
```

### 4. 分布式事务 Seata 的 AT 和 TCC 模式？

```
【AT 模式】（自动补偿，最常用）
  原理：拦截 SQL，自动生成回滚日志

  一阶段（本地事务）：
    ① 拦截业务 SQL
    ② 查询修改前的数据 → 保存为 before image
    ③ 执行业务 SQL
    ④ 查询修改后的数据 → 保存为 after image
    ⑤ 生成 undo_log 并和业务 SQL 在同一个本地事务中提交

  二阶段-提交：
    删除 undo_log（异步，快速）

  二阶段-回滚：
    用 before image 生成反向 SQL 执行回滚
    回滚前用 after image 校验数据有没有被其他事务改过

  优点：对业务无侵入，像本地事务一样写代码
  缺点：性能一般（要记录快照），全局锁可能有性能瓶颈

【TCC 模式】（手动补偿）
  Try：    预留资源（如冻结库存、冻结余额）
  Confirm：确认操作（扣减冻结的资源）
  Cancel： 取消操作（释放冻结的资源）

  优点：性能好，没有全局锁
  缺点：业务侵入大，需要自己写 Try/Confirm/Cancel 三个方法

  需要注意的问题：
    空回滚：Try 没执行就收到 Cancel → Cancel 要判断 Try 是否执行过
    业务悬挂：Cancel 先于 Try 到达 → Try 不能再执行（否则资源永远锁住）
    幂等性：Confirm/Cancel 可能重试 → 必须保证幂等
```

---

# 三十五、网络与操作系统面试题

---

## 一、HTTP 与 HTTPS

### 1. HTTP 和 HTTPS 的区别？

```
HTTP：明文传输，端口 80
HTTPS：HTTP + SSL/TLS 加密，端口 443

HTTPS 建立连接过程（TLS 握手简化版）：
  ① 客户端发送：支持的加密算法列表 + 随机数 A
  ② 服务端返回：选定的加密算法 + 随机数 B + 证书（包含公钥）
  ③ 客户端验证证书 → 生成随机数 C → 用公钥加密发给服务端
  ④ 双方用 A + B + C 计算出对称加密的密钥（Session Key）
  ⑤ 后续通信用 Session Key 对称加密

为什么不全程用非对称加密？
  非对称加密慢（RSA 比 AES 慢 1000 倍）
  → 用非对称加密交换密钥（握手阶段）
  → 用对称加密传输数据（通信阶段）

Nginx SSL 卸载（SSL Termination）：
  客户端 ——HTTPS——→ Nginx ——HTTP——→ 后端服务
  Nginx 负责加解密，后端服务不用处理，减轻 CPU 负担
```

### 2. TCP 三次握手和四次挥手？

```
【三次握手（建立连接）】
  客户端          服务端
    │                │
    │── SYN ────────→│  ① 客户端发 SYN，进入 SYN_SENT
    │                │
    │←── SYN+ACK ───│  ② 服务端回 SYN+ACK，进入 SYN_RCVD
    │                │
    │── ACK ────────→│  ③ 客户端发 ACK，双方进入 ESTABLISHED
    │                │

  为什么是三次不是两次？
    防止已过期的连接请求到达服务端
    如果两次：旧的 SYN 到达 → 服务端认为建立了连接 → 浪费资源

【四次挥手（断开连接）】
  客户端          服务端
    │                │
    │── FIN ────────→│  ① 客户端发 FIN，进入 FIN_WAIT_1
    │                │
    │←── ACK ────────│  ② 服务端回 ACK，进入 CLOSE_WAIT
    │                │     客户端进入 FIN_WAIT_2
    │                │     服务端可能还有数据要发...
    │←── FIN ────────│  ③ 服务端发 FIN，进入 LAST_ACK
    │                │
    │── ACK ────────→│  ④ 客户端发 ACK，进入 TIME_WAIT（等 2MSL）
    │                │     服务端收到后关闭

  为什么是四次不是三次？
    因为服务端收到 FIN 时可能还有数据没发完
    → 先回 ACK（知道了）→ 发完剩余数据 → 再发 FIN（我也关了）
    → 所以 ACK 和 FIN 不能合并为一条

  TIME_WAIT 为什么等 2MSL？
    确保最后一个 ACK 能到达服务端
    如果服务端没收到 → 会重发 FIN → 客户端重传 ACK
```

## 二、Token（JWT vs Opaque Token）

```
【JWT（自包含令牌）】
  Token 本身包含用户信息（Base64 编码，不是加密）
  服务端不需要存储，直接解码 + 验签就能获取用户信息
  
  结构：Header.Payload.Signature
  
  优点：无状态，不依赖存储
  缺点：无法主动失效（发出去就收不回来），Token 体积大

【Opaque Token（不透明令牌）】
  Token 只是一个随机字符串（如 UUID），不包含任何信息
  用户信息以 Token 为 key 存在 Redis 中
  校验时拿 Token 去 Redis 查
  
  优点：可以随时失效（删 Redis key），安全（Token 不暴露信息）
  缺点：每次请求要查 Redis

  Spring Security OAuth2 默认使用这种方式
  
选择：
  需要即时注销/踢人 → Opaque Token + Redis
  纯无状态、性能优先 → JWT
  多租户/SSO 场景 → Opaque Token + Redis（更灵活）
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
