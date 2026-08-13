# HTTP 请求完整链路详解：从浏览器到服务器再到返回

## 一、浏览器准备

```
用户在地址栏输入 https://www.example.com/api/users 回车
  ↓
① 浏览器解析 URL
   - 协议：https
   - 域名：www.example.com
   - 端口：443（HTTPS 默认）
   - 路径：/api/users
  ↓
② 检查浏览器缓存
   - 强缓存（Cache-Control / Expires）→ 命中则直接用缓存，不发请求
   - 协商缓存（ETag / Last-Modified）→ 需要问服务器
```

---

## 二、DNS 解析（域名 → IP）

### 2.1 DNS 查询的完整过程

```
浏览器输入 www.example.com
  ↓
浏览器 DNS 缓存（Chrome: chrome://net-internals/#dns）
  ↓ 没命中
操作系统 DNS 缓存（Windows: ipconfig /displaydns）
  ↓ 没命中
hosts 文件
  Windows: C:\Windows\System32\drivers\etc\hosts
  Linux:   /etc/hosts
  ↓ 没命中
本地 DNS 服务器（也叫 Local DNS / LDNS）
  - 由 ISP（电信/联通/移动）提供
  - 或手动配置（如 8.8.8.8 Google DNS、114.114.114.114）
  ↓ 没命中
开始递归/迭代查询
```

### 2.2 递归 vs 迭代

```
客户端 → 本地 DNS：递归查询（"你帮我查到底，给我最终结果"）
本地 DNS → 各级域名服务器：迭代查询（"我自己一级一级问"）

本地 DNS
   |
   | ① 问根域名服务器（全球 13 组，a.root-servers.net ~ m.root-servers.net）
   |    "www.example.com 的 IP 是？"
   |    → "我不知道，但 .com 的服务器是 192.5.6.30，你去问它"
   |
   | ② 问 .com 顶级域名服务器（TLD）
   |    "www.example.com 的 IP 是？"
   |    → "我不知道，但 example.com 的权威 DNS 是 ns1.example.com"
   |
   | ③ 问 example.com 权威域名服务器
   |    "www.example.com 的 IP 是？"
   |    → "A 记录：93.184.216.34，TTL=3600"
   |
   | ④ 本地 DNS 缓存这个结果（TTL 时间内有效）
   |    返回给客户端
```

### 2.3 DNS 记录类型

```
A 记录：     域名 → IPv4 地址      www.example.com → 93.184.216.34
AAAA 记录：  域名 → IPv6 地址      www.example.com → 2606:2800:220:1:...
CNAME 记录： 域名 → 另一个域名     www.example.com → example.com（别名）
MX 记录：    邮件服务器             example.com → mail.example.com
NS 记录：    权威 DNS 服务器       example.com → ns1.example.com
TXT 记录：   文本信息（SPF、验证等）
```

### 2.4 DNS 负载均衡

```
同一个域名可以返回多个 IP（轮询）：
www.example.com → 93.184.216.34
www.example.com → 93.184.216.35
www.example.com → 93.184.216.36

或者根据请求来源返回不同 IP（智能 DNS / GeoDNS）：
广东用户 → 返回广州机房 IP
北京用户 → 返回北京机房 IP
```

---

## 三、TCP 三次握手

### 3.1 完整握手过程

```
客户端状态          数据包                     服务器状态
─────────────────────────────────────────────────────
CLOSED                                        LISTEN
   |                                             |
   | ─── SYN (seq=x)                         ──►|
SYN_SENT                                        |
   |                                             |
   |◄── SYN+ACK (seq=y, ack=x+1) ──────────── |
   |                                        SYN_RCVD
   |                                             |
   | ─── ACK (seq=x+1, ack=y+1) ─────────────►|
ESTABLISHED                               ESTABLISHED
```

### 3.2 TCP 头部结构

```
┌──────────────────────────────────────────────────────────┐
│                    TCP 头部（20 字节）                      │
├──────────────────┬───────────────────────────────────────┤
│ 源端口 (16 bit)   │ 目标端口 (16 bit)                      │
│ 如：51234         │ 如：443                               │
├──────────────────┴───────────────────────────────────────┤
│ 序列号 seq (32 bit)                                       │
│ 用来标识这个包里数据的第一个字节的编号                        │
├──────────────────────────────────────────────────────────┤
│ 确认号 ack (32 bit)                                       │
│ 告诉对方"我期望你下一个发 ack 号开始的数据"                  │
├──────────────────────────────────────────────────────────┤
│ 标志位：SYN / ACK / FIN / RST / PSH / URG                │
│ SYN=1：请求建立连接                                        │
│ ACK=1：确认号有效                                          │
│ FIN=1：请求断开连接                                        │
│ RST=1：强制重置连接                                        │
├──────────────────────────────────────────────────────────┤
│ 窗口大小 (16 bit)：流量控制，告诉对方我还能接收多少数据       │
└──────────────────────────────────────────────────────────┘
```

### 3.3 为什么是三次？

```
两次不够的原因：

① 客户端发 SYN → 服务器收到，服务器知道"客户端能发"
② 服务器发 SYN+ACK → 如果客户端没收到呢？

此时服务器已经分配资源等待连接，但客户端可能根本没收到回复
→ 服务器资源白白浪费

三次的意义：
① SYN      → 服务器确认：客户端能发
② SYN+ACK  → 客户端确认：服务器能收、能发
③ ACK      → 服务器确认：客户端能收
= 双方都确认了对方的收发能力
```

### 3.4 SYN Flood 攻击

```
攻击者伪造大量 SYN 请求，不回 ACK：
  攻击者 ── SYN ──► 服务器（分配资源等待 ACK）
  攻击者 ── SYN ──► 服务器（继续分配资源）
  攻击者 ── SYN ──► 服务器（资源耗尽！）

  服务器半连接队列被塞满 → 正常用户连不上

防御：SYN Cookie、限制半连接数、防火墙过滤
```

---

## 四、TLS 握手（HTTPS 加密通道）

### 4.1 TLS 1.2 完整握手

```
客户端                                           服务器
   |                                                |
   | ① ClientHello                                  |
   |   - TLS 版本：TLS 1.2                          |
   |   - 支持的加密套件列表                           |
   |   - 客户端随机数（Client Random, 32 字节）       |
   |   ──────────────────────────────────────────►  |
   |                                                |
   | ② ServerHello                                  |
   |   - 选定 TLS 版本：TLS 1.2                     |
   |   - 选定加密套件                                |
   |   - 服务器随机数（Server Random, 32 字节）       |
   |  ◄──────────────────────────────────────────── |
   |                                                |
   | ③ Certificate（服务器证书）                      |
   |   - 包含服务器公钥                               |
   |   - 证书链（服务器证书 → 中间 CA → 根 CA）       |
   |  ◄──────────────────────────────────────────── |
   |                                                |
   | ④ ServerKeyExchange（ECDHE 参数）               |
   |   - 椭圆曲线参数 + 服务器临时公钥                 |
   |  ◄──────────────────────────────────────────── |
   |                                                |
   | ⑤ ServerHelloDone                              |
   |  ◄──────────────────────────────────────────── |
   |                                                |
   | ⑥ 客户端验证证书                                 |
   |   - 证书签名是否有效？                           |
   |   - 证书链是否完整？根 CA 是否在信任列表里？       |
   |   - 域名是否匹配？                              |
   |   - 是否过期？                                   |
   |   - 是否被吊销？（CRL / OCSP）                   |
   |                                                |
   | ⑦ ClientKeyExchange                            |
   |   - 客户端临时公钥（ECDHE）                      |
   |   ──────────────────────────────────────────►  |
   |                                                |
   | 双方用 ECDHE 算出预主密钥（Pre-Master Secret）    |
   | 再用 Client Random + Server Random + PMS        |
   |   → 生成主密钥（Master Secret）                   |
   |   → 派生出对称加密密钥                            |
   |                                                |
   | ⑧ ChangeCipherSpec + Finished                  |
   |   "我切换到加密模式了"                            |
   |   ──────────────────────────────────────────►  |
   |                                                |
   | ⑨ ChangeCipherSpec + Finished                  |
   |  ◄──────────────────────────────────────────── |
   |                                                |
   后续所有数据都用对称密钥加密 ✅
```

### 4.2 为什么用非对称 + 对称混合？

```
非对称加密（RSA/ECDHE）：安全但慢（约慢 1000 倍）
  - 用来交换密钥（握手阶段）

对称加密（AES）：快但需要共享密钥
  - 用来加密实际数据（传输阶段）

混合使用 = 安全 + 高性能
```

---

## 五、HTTP 请求/响应

### 5.1 HTTP 请求报文结构

```
POST /api/users HTTP/1.1          ← 请求行：方法 + 路径 + 版本
Host: www.example.com             ← 必须的头，指定目标主机
Content-Type: application/json    ← 请求体格式
Content-Length: 42                ← 请求体长度
Authorization: Bearer eyJhbG...   ← 认证 Token
Cookie: JSESSIONID=abc123         ← Cookie
Accept: application/json          ← 期望的响应格式
Accept-Encoding: gzip, deflate    ← 支持的压缩格式
Connection: keep-alive            ← 保持连接
User-Agent: Mozilla/5.0 ...       ← 浏览器标识
                                  ← 空行（头部结束标志）
{"name":"张三","age":30}           ← 请求体
```

### 5.2 HTTP 响应报文结构

```
HTTP/1.1 200 OK                   ← 状态行：版本 + 状态码 + 原因短语
Content-Type: application/json
Content-Length: 128
Set-Cookie: JSESSIONID=abc123; Path=/; HttpOnly
Cache-Control: no-cache
Date: Wed, 09 Apr 2026 16:00:00 GMT
                                  ← 空行
{"code":0,"data":{...}}           ← 响应体
```

### 5.3 常见状态码

```
2xx 成功：
  200 OK              请求成功
  201 Created         资源已创建（POST 成功）
  204 No Content      成功但无返回体（DELETE）

3xx 重定向：
  301 Moved Permanently  永久重定向（SEO 会更新）
  302 Found              临时重定向（SSO 登录跳转就是这个）
  304 Not Modified       协商缓存命中，用本地缓存

4xx 客户端错误：
  400 Bad Request        请求参数错误
  401 Unauthorized       未认证（没带 Token 或 Token 过期）
  403 Forbidden          已认证但无权限
  404 Not Found          资源不存在
  405 Method Not Allowed 方法不允许（GET 访问只支持 POST 的接口）

5xx 服务端错误：
  500 Internal Server Error  服务器内部错误
  502 Bad Gateway            网关收到上游无效响应（Nginx → 后端挂了）
  503 Service Unavailable    服务不可用（过载/维护）
  504 Gateway Timeout        网关超时（Nginx 等后端等太久）
```

---

## 六、网络传输（数据封装与路由）

### 6.1 数据封装过程（发送端）

```
应用层数据：HTTP 报文

                     ┌──────────────────────┐
                     │     HTTP 报文         │
                     └──────────────────────┘
                               ↓ 加上 TCP 头
              ┌────────┬──────────────────────┐
              │ TCP 头  │     HTTP 报文         │
              │ 20字节  │                      │
              └────────┴──────────────────────┘
                               ↓ 加上 IP 头
       ┌────────┬────────┬──────────────────────┐
       │ IP 头   │ TCP 头  │     HTTP 报文        │
       │ 20字节  │ 20字节  │                      │
       └────────┴────────┴──────────────────────┘
                               ↓ 加上以太网帧头和帧尾
┌──────────┬────────┬────────┬──────────────┬──────┐
│ 帧头      │ IP 头   │ TCP 头 │  HTTP 报文   │ FCS  │
│ 14字节    │ 20字节  │ 20字节 │              │ 4字节 │
│ 目标MAC   │        │        │              │ 校验  │
│ 源MAC     │        │        │              │      │
│ 类型      │        │        │              │      │
└──────────┴────────┴────────┴──────────────┴──────┘
                               ↓
              物理层：转成电信号/光信号发出
```

### 6.2 MTU 与分片

```
以太网 MTU = 1500 字节（数据链路层一帧最大载荷）
IP 头 = 20 字节
TCP 头 = 20 字节
→ TCP 每段最大数据 = 1500 - 20 - 20 = 1460 字节（MSS）

如果 HTTP 报文有 5000 字节：
  → TCP 拆成 4 段：1460 + 1460 + 1460 + 620
  → 接收端 TCP 按序号重组
```

### 6.3 ARP（IP → MAC 地址）

```
IP 层知道目标 IP，但数据链路层需要 MAC 地址

浏览器电脑要发包给网关（192.168.1.1）：
  ① 查 ARP 缓存 → 没有
  ② 广播 ARP 请求：
     "谁的 IP 是 192.168.1.1？请告诉我你的 MAC 地址"
  ③ 网关回复：
     "我是 192.168.1.1，我的 MAC 是 AA:BB:CC:DD:EE:FF"
  ④ 缓存这个映射

注意：每经过一个路由器，MAC 地址都会变（换成下一跳的 MAC）
     但 IP 地址全程不变（除非 NAT）
```

### 6.4 NAT（网络地址转换）

```
家庭/公司内网用私有 IP（如 192.168.1.100）
互联网上需要公网 IP

路由器做 NAT：
  出去时：192.168.1.100:51234 → 公网IP:12345（替换源地址）
  回来时：公网IP:12345 → 192.168.1.100:51234（还原）

这就是为什么多台电脑能共用一个公网 IP
```

### 6.5 路由跳转

```
浏览器所在电脑
  ↓ 以太网帧
本地路由器（家庭/公司）
  ↓
ISP 接入网络（电信/联通/移动）
  ↓ 经过多个路由器跳转（traceroute 可以看到）
骨干网
  ↓
目标服务器所在 IDC 机房的路由器
  ↓
机房交换机
  ↓
服务器网卡

每一跳：
  ① 路由器查路由表，决定下一跳地址
  ② 重新封装数据链路层帧（MAC 地址每跳都变，IP 地址不变）
  ③ 转发
```

---

## 七、服务器端处理深入（重点）

### 7.0 服务器端全景图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              服务器端                                    │
│                                                                         │
│  ┌─────────┐    ┌──────────┐    ┌────────────────────────────────────┐  │
│  │  Nginx   │───►│ Gateway  │───►│          微服务（如 zsyht-upms）    │  │
│  │ SSL 卸载  │    │ 路由+LB  │    │                                    │  │
│  │ 反向代理  │    │          │    │  ┌──────────────────────────────┐  │  │
│  └─────────┘    └──────────┘    │  │        Tomcat 容器            │  │  │
│                                  │  │  ┌────────────────────────┐  │  │  │
│                                  │  │  │   Servlet Filter 链     │  │  │  │
│                                  │  │  │  ┌──────────────────┐  │  │  │  │
│                                  │  │  │  │ Spring Security   │  │  │  │  │
│                                  │  │  │  │ 过滤器链          │  │  │  │  │
│                                  │  │  │  └──────────────────┘  │  │  │  │
│                                  │  │  └────────────────────────┘  │  │  │
│                                  │  │  ┌────────────────────────┐  │  │  │
│                                  │  │  │  DispatcherServlet      │  │  │  │
│                                  │  │  │  ┌──────────────────┐  │  │  │  │
│                                  │  │  │  │ HandlerMapping    │  │  │  │  │
│                                  │  │  │  │ HandlerAdapter    │  │  │  │  │
│                                  │  │  │  │ Interceptor       │  │  │  │  │
│                                  │  │  │  └──────────────────┘  │  │  │  │
│                                  │  │  └────────────────────────┘  │  │  │
│                                  │  │  ┌────────────────────────┐  │  │  │
│                                  │  │  │  Controller            │  │  │  │
│                                  │  │  │  Service (AOP/事务)     │  │  │  │
│                                  │  │  │  Mapper (MyBatis)      │  │  │  │
│                                  │  │  └────────────────────────┘  │  │  │
│                                  │  └──────────────────────────────┘  │  │
│                                  │          ↓ JDBC                    │  │
│                                  │  ┌──────────────────────────────┐  │  │
│                                  │  │     PostgreSQL / MySQL       │  │  │
│                                  │  └──────────────────────────────┘  │  │
│                                  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.1 Nginx 处理

```
接收 HTTPS 请求
  ↓
SSL 卸载（解密）
  ↓
匹配 server 块（根据 Host 头和端口）
  server {
      listen 443 ssl;
      server_name www.example.com;
  }
  ↓
匹配 location 块（根据 URL 路径）
  location /api/ {
      proxy_pass http://backend;
  }
  ↓
反向代理：转发请求到后端服务（Gateway）
  ↓
接收后端响应 → SSL 加密 → 返回给客户端
```

### 7.2 Gateway 处理

```
Spring Cloud Gateway 接收请求
  ↓
路由匹配：/admin/** → zsyht-upms 服务
  ↓
从 Nacos 获取服务实例列表
  ↓
负载均衡选择一个实例
  ↓
转发请求到具体微服务
```

### 7.3 Tomcat 接收请求

```
┌──────────────────────────────────────────────────────────────┐
│                        Tomcat 架构                            │
│                                                               │
│  Server                                                       │
│  └── Service                                                  │
│        ├── Connector（连接器，负责网络通信）                     │
│        │     ┌──────────────────────────────────────────┐     │
│        │     │ Acceptor 线程                             │     │
│        │     │   → accept() 接受新 TCP 连接              │     │
│        │     │                  ↓                        │     │
│        │     │ Poller 线程                               │     │
│        │     │   → NIO 检测哪些连接有数据可读             │     │
│        │     │                  ↓                        │     │
│        │     │ Worker 线程池（默认 200 个线程）            │     │
│        │     │   → 解析 HTTP 报文                        │     │
│        │     │   → 创建 Request / Response 对象          │     │
│        │     │   → 进入 Servlet 容器                     │     │
│        │     └──────────────────────────────────────────┘     │
│        │                                                       │
│        └── Engine → Host → Context → Wrapper → Servlet        │
│                              ↑                                 │
│                          一个 war 包 = 一个 Context             │
└──────────────────────────────────────────────────────────────┘
```

### 7.4 Servlet Filter 链

```
Worker 线程进入 Servlet 容器后，先经过 Filter 链：

┌─────────────────────────────────────────────────────────────┐
│                     Servlet FilterChain                       │
│                                                               │
│  请求 ──►  Filter 1: CharacterEncodingFilter                  │
│              → 设置编码为 UTF-8                                │
│                          ↓                                    │
│            Filter 2: DelegatingFilterProxy                    │
│              → 桥接到 Spring Security FilterChainProxy         │
│              → 内部包含十几个安全过滤器（见 7.5）               │
│                          ↓                                    │
│            Filter 3: 其他业务 Filter                           │
│                          ↓                                    │
│            DispatcherServlet（见 7.6）                         │
│                                                               │
│  响应 ◄── （Filter 链反向执行，每个 Filter 的后置逻辑）        │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 Spring Security 过滤器链

```
┌──────────────────────────────────────────────────────────────┐
│               Spring Security FilterChainProxy                │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. SecurityContextPersistenceFilter                   │    │
│  │    → 从 HttpSession 恢复 SecurityContext               │    │
│  │    → 放入 SecurityContextHolder（ThreadLocal）         │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 2. HeaderWriterFilter                                 │    │
│  │    → 写安全响应头 X-Frame-Options, X-Content-Type 等  │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 3. CorsFilter                                         │    │
│  │    → 处理跨域（检查 Origin，设置 Access-Control-*）    │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 4. LogoutFilter                                       │    │
│  │    → 匹配 /logout，执行登出                           │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 5. OAuth2AuthenticationProcessingFilter    ★ 核心 ★   │    │
│  │                                                       │    │
│  │    从请求头提取 Token:                                 │    │
│  │      Authorization: Bearer eyJhbGci...                │    │
│  │                    ↓                                   │    │
│  │    调用 ResourceServerTokenServices                    │    │
│  │      .loadAuthentication(token)                       │    │
│  │                    ↓                                   │    │
│  │    从 Redis 读取 token 对应的认证信息                   │    │
│  │                    ↓                                   │    │
│  │    构建 OAuth2Authentication 对象                      │    │
│  │                    ↓                                   │    │
│  │    SecurityContextHolder                              │    │
│  │      .getContext()                                     │    │
│  │      .setAuthentication(auth)                         │    │
│  │    ← 当前线程绑定了用户认证信息                         │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 6. AnonymousAuthenticationFilter                      │    │
│  │    → 如果到这里还没认证 → 创建匿名 Authentication      │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 7. ExceptionTranslationFilter                         │    │
│  │    → try-catch 包裹后续过滤器                          │    │
│  │    → AuthenticationException → 401                    │    │
│  │    → AccessDeniedException → 403                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 8. FilterSecurityInterceptor                          │    │
│  │    → 最终权限校验                                      │    │
│  │    → 根据 URL 匹配安全规则                             │    │
│  │    → AccessDecisionManager 投票决定放行/拒绝           │    │
│  └──────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│               所有 Filter 通过，进入 DispatcherServlet         │
└──────────────────────────────────────────────────────────────┘
```

### 7.6 DispatcherServlet（Spring MVC 核心）

```
┌──────────────────────────────────────────────────────────────────────┐
│                      DispatcherServlet.doDispatch()                    │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 步骤 1：HandlerMapping — 找到谁来处理这个请求                    │  │
│  │                                                                │  │
│  │ 遍历所有 HandlerMapping，按优先级：                              │  │
│  │                                                                │  │
│  │ ① RequestMappingHandlerMapping（最常用）                        │  │
│  │                                                                │  │
│  │    Spring 容器启动时：                                          │  │
│  │    → 扫描所有 @Controller / @RestController 类                  │  │
│  │    → 解析每个方法的 @RequestMapping / @GetMapping 等注解         │  │
│  │    → 建立映射关系表：                                           │  │
│  │                                                                │  │
│  │    ┌────────────────────┬──────────────────────────────────┐   │  │
│  │    │ URL 模式            │ Controller 方法                  │   │  │
│  │    ├────────────────────┼──────────────────────────────────┤   │  │
│  │    │ GET /api/users      │ UserController.getUsers()       │   │  │
│  │    │ POST /api/users     │ UserController.createUser()     │   │  │
│  │    │ GET /api/users/{id} │ UserController.getUser()        │   │  │
│  │    │ PUT /api/users/{id} │ UserController.updateUser()     │   │  │
│  │    │ DELETE /api/users/* │ UserController.deleteUser()     │   │  │
│  │    └────────────────────┴──────────────────────────────────┘   │  │
│  │                                                                │  │
│  │    请求进来时：                                                 │  │
│  │    GET /api/users?current=1&size=10                            │  │
│  │    → 匹配到 UserController.getUsers()                          │  │
│  │                                                                │  │
│  │    匹配规则（按优先级）：                                       │  │
│  │    - 精确路径 > 通配符 > 正则                                   │  │
│  │    - HTTP 方法匹配（GET/POST/PUT/DELETE）                      │  │
│  │    - Content-Type 匹配（consumes）                             │  │
│  │    - Accept 匹配（produces）                                   │  │
│  │                                                                │  │
│  │ ② SimpleUrlHandlerMapping（静态资源）                           │  │
│  │ ③ BeanNameUrlHandlerMapping（老式用法）                         │  │
│  │                                                                │  │
│  │ 返回：HandlerExecutionChain = Handler + 拦截器列表              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 步骤 2：找到 HandlerAdapter                                     │  │
│  │                                                                │  │
│  │ RequestMappingHandlerAdapter（处理 @RequestMapping 方法）       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 步骤 3：拦截器 preHandle                                        │  │
│  │                                                                │  │
│  │ Interceptor 1 ──► Interceptor 2 ──► Interceptor 3              │  │
│  │   preHandle()       preHandle()       preHandle()              │  │
│  │   返回 true          返回 true         返回 true               │  │
│  │                                                                │  │
│  │ 任意一个返回 false → 中断，不进入 Controller                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                               ↓                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 步骤 4：参数解析 + 调用 Controller 方法                          │  │
│  │                                                                │  │
│  │ 目标方法签名：                                                  │  │
│  │   public R getUser(                                            │  │
│  │       @PathVariable Long id,                                   │  │
│  │       @RequestParam String name,                               │  │
│  │       @RequestBody UserDTO dto,                                │  │
│  │       @RequestHeader String token,                             │  │
│  │       HttpServletRequest request,                              │  │
│  │       Page page                                                │  │
│  │   )                                                            │  │
│  │                                                                │  │
│  │ 参数解析器（ArgumentResolver）逐个解析：                         │  │
│  │                                                                │  │
│  │ ┌────────────────────┬────────────────────────────────────┐   │  │
│  │ │ 注解/类型           │ 解析方式                            │   │  │
│  │ ├────────────────────┼────────────────────────────────────┤   │  │
│  │ │ @PathVariable       │ 从 URL 路径 /users/{id} 提取       │   │  │
│  │ │ @RequestParam       │ 从 ?name=xxx 查询参数提取           │   │  │
│  │ │ @RequestBody        │ 读取请求体 → Jackson 反序列化 JSON  │   │  │
│  │ │ @RequestHeader      │ 从请求头提取                        │   │  │
│  │ │ HttpServletRequest  │ 直接注入原始 Request 对象            │   │  │
│  │ │ Page                │ 自动从 current/size 参数解析         │   │  │
│  │ └────────────────────┴────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │ @RequestBody 的 JSON 反序列化详细过程：                          │  │
│  │                                                                │  │
│  │   请求体 {"name":"张三","age":30}                               │  │
│  │          ↓                                                     │  │
│  │   MappingJackson2HttpMessageConverter                          │  │
│  │          ↓                                                     │  │
│  │   ObjectMapper.readValue(json, UserDTO.class)                  │  │
│  │          ↓                                                     │  │
│  │   UserDTO { name="张三", age=30 }                              │  │
│  │                                                                │  │
│  │ 参数校验（如果有 @Valid / @Validated）：                         │  │
│  │   → JSR-303 校验：@NotNull, @Size, @Pattern                   │  │
│  │   → 校验失败 → MethodArgumentNotValidException → 400          │  │
│  │                                                                │  │
│  │ 最终通过反射调用 Controller 方法：                               │  │
│  │   Method.invoke(controllerBean, resolvedArgs)                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.7 Service → Mapper → 数据库

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Service → Mapper → DB                           │
│                                                                       │
│  Controller 调用 Service：                                            │
│    userService.getUserPage(page, dto)                                 │
│               ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Spring AOP 代理层                                               │  │
│  │                                                                │  │
│  │ ① @Transactional（如果有）                                      │  │
│  │    → TransactionInterceptor 拦截                                │  │
│  │    → 从 HikariCP 连接池获取 Connection                          │  │
│  │    → connection.setAutoCommit(false) 开启事务                   │  │
│  │                                                                │  │
│  │ ② 自定义 AOP（如 @DataPermissions）                             │  │
│  │    → DataScopeAspect @Around 拦截                               │  │
│  │    → 读取注解配置，写入 ThreadLocal                              │  │
│  │                                                                │  │
│  │ ③ 执行 Service 业务逻辑                                         │  │
│  │    → 调用 Mapper 方法                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│               ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ MyBatis 执行 SQL                                                │  │
│  │                                                                │  │
│  │ ① SqlSession.selectList()                                      │  │
│  │            ↓                                                    │  │
│  │ ② Executor（执行器）                                            │  │
│  │    → 一级缓存查询（SqlSession 级别）                             │  │
│  │    → 没命中，继续                                                │  │
│  │            ↓                                                    │  │
│  │ ③ StatementHandler.prepare()                                   │  │
│  │    ┌────────────────────────────────────────────────────────┐  │  │
│  │    │ ★ MyBatis 拦截器在这里介入 ★                            │  │  │
│  │    │                                                        │  │  │
│  │    │ MybatisPlusDataScope 拦截器                             │  │  │
│  │    │   → 读取 ThreadLocal 中的权限配置                       │  │  │
│  │    │   → 改写 SQL：                                         │  │  │
│  │    │                                                        │  │  │
│  │    │   原始 SQL:                                             │  │  │
│  │    │     SELECT * FROM sys_user                              │  │  │
│  │    │     WHERE status = 1 LIMIT 10                          │  │  │
│  │    │                       ↓                                │  │  │
│  │    │   改写后:                                               │  │  │
│  │    │     SELECT * FROM sys_user                              │  │  │
│  │    │     WHERE status = 1                                   │  │  │
│  │    │     AND dept_id IN (1, 2, 3)    ← 追加的数据权限条件    │  │  │
│  │    │     LIMIT 10                                           │  │  │
│  │    └────────────────────────────────────────────────────────┘  │  │
│  │            ↓                                                    │  │
│  │ ④ ParameterHandler.setParameters()                             │  │
│  │    → PreparedStatement 设置参数（防 SQL 注入）                   │  │
│  │    → ps.setInt(1, 1)         // status = ?                     │  │
│  │    → ps.setLong(2, 1L)      // dept_id IN (?, ?, ?)           │  │
│  │            ↓                                                    │  │
│  │ ⑤ JDBC 执行                                                    │  │
│  │    → PreparedStatement.execute()                               │  │
│  │    → 通过 HikariCP 连接池发送到数据库                            │  │
│  │            ↓                                                    │  │
│  │ ⑥ ResultSetHandler.handleResultSets()                          │  │
│  │    → 读取 ResultSet                                            │  │
│  │    → 按映射规则转换为 Java 对象                                  │  │
│  │    → 返回 List<User> / Page<User>                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│               ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 数据库内部处理                                                  │  │
│  │                                                                │  │
│  │ PostgreSQL 收到 SQL:                                           │  │
│  │   SELECT * FROM sys_user WHERE status=1 AND dept_id IN (1,2,3) │  │
│  │                                                                │  │
│  │ ① 解析器（Parser）       SQL 文本 → 解析树                     │  │
│  │ ② 分析器（Analyzer）     语义分析，表/列是否存在                 │  │
│  │ ③ 重写器（Rewriter）     视图展开、规则重写                     │  │
│  │ ④ 优化器（Planner）                                           │  │
│  │    → 生成多种执行计划                                          │  │
│  │    → 估算代价（Cost），选最优的                                  │  │
│  │    → 决定：索引扫描 or 全表扫描？                               │  │
│  │    → 如果 dept_id 有索引 → Index Scan                         │  │
│  │    → 如果没有索引 → Seq Scan                                   │  │
│  │ ⑤ 执行器（Executor）                                          │  │
│  │    → 从磁盘 / Buffer Pool 读取数据页                           │  │
│  │    → 过滤符合条件的行                                          │  │
│  │    → 返回结果集                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.8 响应返回过程

```
┌──────────────────────────────────────────────────────────────────────┐
│                          响应返回                                     │
│                                                                       │
│  Controller 返回 R.ok(data)                                          │
│               ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 返回值处理（ReturnValueHandler）                                │  │
│  │                                                                │  │
│  │ @RestController 的方法默认带 @ResponseBody                      │  │
│  │   → RequestResponseBodyMethodProcessor                         │  │
│  │                                                                │  │
│  │ 选择 HttpMessageConverter：                                     │  │
│  │   Accept: application/json                                     │  │
│  │   → MappingJackson2HttpMessageConverter                        │  │
│  │                                                                │  │
│  │ Jackson 序列化过程：                                            │  │
│  │   R<Page<User>> 对象                                           │  │
│  │        ↓                                                       │  │
│  │   ObjectMapper.writeValueAsString()                            │  │
│  │        ↓                                                       │  │
│  │   {"code":0,"msg":"success","data":{"records":[...],"total":100}} │
│  │        ↓                                                       │  │
│  │   写入 HttpServletResponse 的 OutputStream                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│               ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 拦截器反向执行                                                  │  │
│  │                                                                │  │
│  │ Interceptor 3 ──► Interceptor 2 ──► Interceptor 1              │  │
│  │  postHandle()      postHandle()      postHandle()              │  │
│  │  afterCompletion() afterCompletion() afterCompletion()         │  │
│  │                                                                │  │
│  │ 常见用途：清理资源、记录耗时日志                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│               ↓                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Spring Security 过滤器链（反向）                                │  │
│  │                                                                │  │
│  │ SecurityContextPersistenceFilter：                             │  │
│  │   → 将 SecurityContext 存回 HttpSession                        │  │
│  │   → 清理 SecurityContextHolder（ThreadLocal.remove()）         │  │
│  │   → 防止线程复用导致认证信息泄漏到其他请求                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│               ↓                                                       │
│  Tomcat Worker 线程将 Response 写入 Socket → 网络传输 → 浏览器       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 八、TCP 四次挥手

### 8.1 完整过程

```
客户端状态          数据包                     服务器状态
─────────────────────────────────────────────────────────
ESTABLISHED                               ESTABLISHED
   |                                             |
   | ─── FIN (seq=u) ─────────────────────►     |
FIN_WAIT_1    "我数据发完了"                      |
   |                                             |
   |     ◄── ACK (ack=u+1) ──────────────────  |
FIN_WAIT_2    "收到，但我可能还有数据要发"    CLOSE_WAIT
   |                                             |
   |     （服务器继续发送剩余数据...）              |
   |                                             |
   |     ◄── FIN (seq=v) ──────────────────── |
   |          "我也发完了"                    LAST_ACK
   |                                             |
   | ─── ACK (ack=v+1) ─────────────────────►  |
TIME_WAIT      "收到"                        CLOSED
   |
   | （等待 2MSL，通常 60 秒）
   |  确保最后的 ACK 到达
   |
CLOSED
```

### 8.2 为什么是四次不是三次？

```
TCP 是全双工通信，每个方向要单独关闭：

客户端 FIN → "我不发了"    但还能收
服务器 ACK → "知道了"      服务器可能还有数据没发完
  ... 服务器继续发数据 ...
服务器 FIN → "我也不发了"
客户端 ACK → "知道了"      双向都关闭

如果合并成三次（服务器 ACK 和 FIN 一起发）：
  → 只有在服务器恰好没有数据要发时才行
  → 不具备通用性
```

### 8.3 TIME_WAIT 的意义

```
为什么客户端要等 2MSL（Maximum Segment Lifetime）？

① 确保最后的 ACK 到达
   如果 ACK 丢了，服务器会重发 FIN
   客户端在 TIME_WAIT 状态能收到并重新 ACK

② 让老连接的残留数据包在网络中消亡
   避免新连接收到上一个连接的旧数据

生产问题：高并发短连接服务器可能出现大量 TIME_WAIT
  → 端口耗尽，新连接建不了
  → 解决：tcp_tw_reuse、连接池、HTTP keep-alive
```

---

## 九、浏览器渲染（如果是页面请求）

```
浏览器接收到 HTML 响应后：

① HTML 解析 → DOM 树
② CSS 解析 → CSSOM 树
③ DOM + CSSOM → 生成渲染树（Render Tree）
④ 布局（Layout）：计算每个节点的位置和大小
⑤ 绘制（Paint）：像素级绘制
⑥ 合成（Composite）：GPU 合成最终画面

（如果是 AJAX/API 请求，直接 JavaScript 解析 JSON 即可）
```

---

## 十、OSI 七层对照

```
┌──────────────┬────────────────────────────────┐
│ 应用层        │ HTTP/HTTPS 报文                 │
│ 表示层        │ TLS 加密/解密、JSON 序列化       │
│ 会话层        │ TLS 会话管理                    │
│ 传输层        │ TCP 三次握手/四次挥手、端口号     │
│ 网络层        │ IP 寻址、路由选择                │
│ 数据链路层    │ MAC 地址、以太网帧、ARP           │
│ 物理层        │ 电信号/光信号/无线电波            │
└──────────────┴────────────────────────────────┘

发送时：从上到下，每层加头 → 封装
接收时：从下到上，每层去头 → 解封装
```

---

## 十一、完整总览图

```
浏览器输入 URL 回车
  │
  ├─ 1. 浏览器缓存检查
  ├─ 2. DNS 解析（浏览器缓存→OS缓存→hosts→LDNS→递归查询）
  ├─ 3. TCP 三次握手（SYN → SYN+ACK → ACK）
  ├─ 4. TLS 握手（ClientHello → 证书验证 → 密钥交换 → 对称密钥）
  ├─ 5. 构建 HTTP 请求报文
  ├─ 6. 网络传输（封装→TCP分段→IP包→以太网帧→物理信号→路由→目标）
  ├─ 7. 服务器处理
  │     ├─ Nginx（SSL卸载 → 反向代理）
  │     ├─ Gateway（路由 → 负载均衡 → Nacos 服务发现）
  │     ├─ Tomcat（Acceptor → Poller → Worker线程 → 解析HTTP）
  │     ├─ Servlet Filter 链（编码 → Spring Security 认证授权）
  │     ├─ DispatcherServlet
  │     │     ├─ HandlerMapping（URL+方法 → Controller方法）
  │     │     ├─ Interceptor preHandle（拦截器前置）
  │     │     ├─ HandlerAdapter
  │     │     │     ├─ ArgumentResolver（参数解析：@PathVariable/@RequestParam/@RequestBody）
  │     │     │     ├─ 参数校验（@Valid → JSR-303）
  │     │     │     └─ Method.invoke()（反射调用 Controller 方法）
  │     │     └─ ReturnValueHandler（@ResponseBody → Jackson → JSON）
  │     ├─ Controller → Service
  │     │     ├─ AOP（@Transactional 事务、@DataPermissions 数据权限）
  │     │     └─ 调用 Mapper
  │     ├─ MyBatis
  │     │     ├─ SqlSession → Executor → 一级缓存
  │     │     ├─ StatementHandler.prepare() → 拦截器改写 SQL
  │     │     ├─ ParameterHandler（PreparedStatement 设参数）
  │     │     ├─ JDBC → HikariCP 连接池 → 数据库
  │     │     └─ ResultSetHandler（ResultSet → Java 对象）
  │     └─ 数据库（解析→分析→优化→执行→返回结果集）
  │
  ├─ 8. 响应返回
  │     ├─ JSON → Response → Interceptor 后置 → Security 清理
  │     ├─ Tomcat 写入 Socket → TCP分段 → IP → 以太网帧
  │     ├─ 网络传输（原路返回）
  │     ├─ Nginx（SSL加密）
  │     └─ 浏览器接收 → TLS解密 → 解析JSON / 渲染HTML
  │
  └─ 9. 空闲后 TCP 四次挥手关闭连接（FIN → ACK → FIN → ACK）
```
