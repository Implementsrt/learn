# 05 - JVM原理与调优

## 学习目标
- 吃透 JVM 运行时数据区与执行引擎
- 熟练排查内存泄漏、CPU飙高、GC频繁等线上问题
- 能针对不同业务场景给出调优方案

## 核心知识点
- **内存结构**：堆、栈、元空间、直接内存、PC寄存器
- **对象生命周期**：分配（TLAB）、逃逸分析、标量替换、晋升
- **GC算法**：标记-清除、复制、标记-整理、分代
- **垃圾收集器**：
  - Serial / ParNew / Parallel Scavenge
  - CMS（并发标记清除）
  - G1（Region、Mixed GC）
  - ZGC / Shenandoah（低延迟）
- **类加载机制**：加载→验证→准备→解析→初始化
- **双亲委派**：实现与打破（Tomcat/OSGi/SPI/JDBC）
- **字节码**：指令集、常量池、操作数栈、局部变量表

## 实战任务
- [ ] 用 JOL + `jmap` 分析对象内存布局
- [ ] 模拟各类 OOM（堆/栈/元空间/直接内存）并排查
- [ ] G1 vs CMS vs ZGC 生产级压测对比
- [ ] 完整的 **线上OOM复盘报告**

## 重要工具
- **命令行**：`jps`、`jstat`、`jmap`、`jstack`、`jinfo`、`jcmd`
- **GUI**：JVisualVM、JProfiler、MAT（MemoryAnalyzer）
- **生产级**：Arthas、async-profiler、JFR
- **GC日志分析**：GCViewer、GCEasy

## 关键JVM参数
```
-Xms -Xmx -Xmn -XX:MetaspaceSize
-XX:+UseG1GC -XX:MaxGCPauseMillis
-XX:+HeapDumpOnOutOfMemoryError
-XX:+PrintGCDetails -Xloggc:gc.log
```

## 参考资料
- 《深入理解Java虚拟机》第3版（周志明）
- 《JVM G1源码分析和调优》
- Oracle HotSpot 官方文档

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
