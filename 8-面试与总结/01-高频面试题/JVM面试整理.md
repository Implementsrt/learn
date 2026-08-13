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

