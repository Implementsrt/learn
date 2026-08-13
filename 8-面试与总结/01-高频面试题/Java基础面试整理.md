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

