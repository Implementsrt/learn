# 03 - IO与NIO

## 学习目标
- 理解 BIO/NIO/AIO 三种模型的本质差异
- 掌握 Reactor 模式与 Netty 核心设计
- 能基于 NIO/Netty 设计高性能网络应用

## 核心知识点
- **IO模型**：阻塞/非阻塞、同步/异步、select/poll/epoll
- **NIO三大组件**：`Channel`、`Buffer`、`Selector`
- **零拷贝**：`mmap`、`sendfile`、`FileChannel.transferTo`
- **Reactor模式**：单Reactor单线程 / 单Reactor多线程 / 主从Reactor
- **Netty架构**：
  - `EventLoop`/`EventLoopGroup`
  - `ChannelPipeline`、`ChannelHandler`
  - `ByteBuf`（池化、引用计数）
  - 粘包/拆包解决方案
  - 编解码器（`LengthFieldBasedFrameDecoder`）

## 实战任务
- [ ] 用纯 NIO 实现一个简易 Echo 服务器
- [ ] 基于 Netty 实现 **简易RPC框架**（含协议、编解码、心跳）
- [ ] 对比 BIO/NIO/Netty 在高并发下的性能
- [ ] 研究 Netty 内存池（PooledByteBufAllocator）

## 重要源码
- `sun.nio.ch.EPollSelectorImpl`
- `io.netty.channel.nio.NioEventLoop`
- `io.netty.buffer.PooledByteBufAllocator`

## 参考资料
- 《Netty实战》《Netty源码剖析》
- 《UNIX网络编程卷1》- IO模型
- Netty 官方文档 User Guide

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
