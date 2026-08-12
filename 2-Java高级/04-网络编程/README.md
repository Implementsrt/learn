# 04 - 网络编程

## 学习目标
- 扎实的 TCP/IP 与 HTTP 协议功底
- 能分析与排查生产网络问题
- 理解主流 RPC 框架的通信原理

## 核心知识点
### 协议基础
- **TCP/IP**：三次握手、四次挥手、滑动窗口、拥塞控制
- **TCP状态机**：TIME_WAIT/CLOSE_WAIT 的成因
- **HTTP/1.1 vs HTTP/2 vs HTTP/3(QUIC)**
- **HTTPS**：TLS握手、证书链、SNI
- **WebSocket**：握手、帧结构
- **DNS**：解析流程、本地缓存

### 网络编程
- **Socket编程**：阻塞/非阻塞
- **多路复用**：select/poll/epoll/kqueue
- **Reactor模式**：Doug Lea 经典论文
- **Netty 核心架构**

### RPC 原理
- 服务发现、负载均衡、序列化
- 协议设计（长度字段、魔数、版本）
- 同步/异步/单向调用
- 主流框架：Dubbo、gRPC、Thrift、Motan

## 实战任务
- [ ] `tcpdump` + `Wireshark` 抓包分析 HTTP/TCP
- [ ] 排查一次 `CLOSE_WAIT` 堆积问题
- [ ] 手写一个完整的 **RPC框架**（协议+序列化+注册中心）
- [ ] 对比 HTTP/1.1 和 HTTP/2 性能

## 常用工具
- `tcpdump`、`Wireshark`
- `netstat`/`ss`、`lsof`
- `curl`、`ab`、`wrk`
- `nslookup`、`dig`、`traceroute`

## 参考资料
- 《TCP/IP详解卷1》
- 《图解HTTP》《HTTP权威指南》
- 《Netty实战》
- Dubbo / gRPC 源码

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
