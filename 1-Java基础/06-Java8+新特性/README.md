# 06 - Java8+新特性

## 学习目标
- 熟练运用函数式编程思想
- 跟进 Java 新版本特性并应用到生产
- 理解新特性背后的设计理念

## 核心知识点
### Java 8
- **Lambda表达式**：语法、变量捕获、方法引用
- **函数式接口**：`Function`/`Predicate`/`Consumer`/`Supplier`
- **Stream API**：中间操作、终止操作、并行流、Collector
- **Optional**：避免NPE的正确姿势
- **新日期API**：`LocalDate`/`LocalDateTime`/`Duration`/`Period`
- **CompletableFuture**：异步编程、组合、异常处理

### Java 9-17 关键特性
- **JPMS** 模块化系统（Java 9）
- **`var` 局部变量类型推断**（Java 10）
- **HTTP Client**（Java 11）
- **Switch 表达式**（Java 14）
- **Records**（Java 16）
- **Sealed Classes**（Java 17）
- **Pattern Matching**（Java 17+）

### Java 21 LTS
- **虚拟线程**（Project Loom）
- **结构化并发**
- **Record Patterns**

## 实战任务
- [ ] 用 Stream 重构一段传统循环代码
- [ ] 用 `CompletableFuture` 实现并行业务编排
- [ ] 体验虚拟线程 vs 平台线程性能差异
- [ ] 项目升级 JDK 版本的兼容性评估

## 参考资料
- 《Java 8实战》
- 《Modern Java in Action》
- OpenJDK JEP 官方列表

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
