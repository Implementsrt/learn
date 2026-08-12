# 01 - JVM性能调优

## 学习目标
- 具备线上JVM问题的完整排查能力
- 熟练使用主流调优工具
- 能为不同业务场景给出JVM参数模板

## 核心知识点
### 常见问题分类
- **CPU飙高**：死循环、频繁GC、锁竞争
- **内存泄漏**：对象无法回收
- **OOM**：堆/栈/元空间/直接内存
- **GC频繁/长停顿**
- **应用假死**：线程死锁、IO阻塞

### 排查命令"三板斧"
```bash
# 1. 看进程状态
top -Hp <pid>         # 线程级CPU
jstat -gcutil <pid> 1s # GC情况

# 2. 抓现场
jstack <pid>           # 线程栈
jmap -dump:live,format=b,file=heap.hprof <pid>

# 3. 分析
MAT / JProfiler        # 分析dump
GCViewer / GCEasy      # 分析GC日志
```

### Arthas 神器
- `dashboard`：实时大盘
- `thread -n 3`：Top线程
- `trace`/`watch`：方法调用
- `jad`/`mc`/`redefine`：热更新
- `heapdump`、`profiler`

### 常用调优参数
```
# 堆
-Xms4g -Xmx4g -Xmn1g
-XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=256m

# G1（推荐）
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:InitiatingHeapOccupancyPercent=45

# GC日志
-Xlog:gc*:file=gc.log:time,tags:filecount=10,filesize=100m

# OOM自救
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/data/dump/
-XX:OnOutOfMemoryError="kill -9 %p"
```

## 经典案例模板
每个案例按 **现象 → 排查 → 根因 → 解决 → 复盘** 五段式

### 案例库建设
- [ ] CPU 100% 案例 × 3
- [ ] OOM 案例 × 3
- [ ] GC 频繁案例 × 2
- [ ] 线程池耗尽案例 × 2
- [ ] 内存泄漏案例 × 2

## 实战任务
- [ ] 写一个内存泄漏Demo并用MAT分析
- [ ] 用 async-profiler 做一次火焰图分析
- [ ] G1 vs ZGC 在大堆场景下的压测对比
- [ ] 为团队整理一份 **JVM调优手册**

## 参考资料
- 《深入理解Java虚拟机》
- 《Java性能权威指南》
- Arthas 官方文档
- 美团技术博客：从实际案例聊聊JVM调优

## 学习笔记
<!-- 每个案例一篇：YYYY-MM-DD-案例名.md -->
