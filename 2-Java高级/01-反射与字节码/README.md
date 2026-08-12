# 01 - 反射与字节码

## 学习目标
- 理解 JVM 字节码指令集与执行流程
- 掌握主流字节码操作库（ASM/Javassist/ByteBuddy）
- 能基于字节码技术实现框架级功能

## 核心知识点
- **反射API**：`Class`/`Method`/`Field`/`Constructor`
- **反射性能**：为什么慢、如何优化（缓存、`setAccessible`、`MethodHandle`）
- **动态代理**：
  - JDK 动态代理（`InvocationHandler`）
  - CGLIB（`MethodInterceptor`、FastClass）
- **字节码结构**：魔数、常量池、方法表、属性表
- **字节码库**：
  - **ASM**：访问者模式、最底层
  - **Javassist**：API友好、源码级
  - **ByteBuddy**：流畅API、现代首选
- **Instrumentation**：Java Agent、premain/agentmain、字节码热替换

## 实战任务
- [ ] 手写一个简易 IoC 容器（反射实现）
- [ ] 手写 JDK 动态代理（理解 `$Proxy0` 生成）
- [ ] 用 ByteBuddy 实现 **方法耗时统计** Agent
- [ ] 开发一个简易 APM 探针（借鉴 SkyWalking）

## 重要工具
- **javap -c -v**：查看字节码
- **ASM Bytecode Viewer**：IDEA插件
- **Arthas jad/mc**：反编译/重新编译

## 参考资料
- 《深入理解Java虚拟机》字节码章节
- ASM 官方 User Guide
- SkyWalking / Arthas 源码

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
