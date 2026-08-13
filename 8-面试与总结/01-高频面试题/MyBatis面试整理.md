# 五、MyBatis

## 项目场景提炼索引

- Q1：MyBatis 如何解决一对多查询的主表分页截断？
- Q2：如何用 AOP 和 MyBatis 拦截器实现低侵入数据权限？

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


# 二十九、项目场景：MyBatis 分页与权限插件

## Q1：MyBatis 如何解决一对多查询的主表分页截断？

### 结论（30 秒版）

一对多查询不能直接对 JOIN 展开的结果执行 `LIMIT`，因为数据库分页的是子表行，而业务需要分页的是主表对象。正确做法是先按主表主键和稳定排序条件分页取主表，再回表关联子表；`count` 也按主表去重统计。实现上可由 MyBatis 拦截器识别显式标记的查询，交给自定义 Dialect 改写 page SQL 和 count SQL，普通单表查询继续走默认逻辑。

### 截断问题

```sql
-- JOIN 后每个主对象会展开成多行，LIMIT 截断的是这些行。
SELECT p.id, p.name, c.id AS child_id
FROM parent p
LEFT JOIN child c ON c.parent_id = p.id
ORDER BY p.id
LIMIT 10;
```

如果一个主对象有多条子记录，返回的主对象数量可能少于 10，最后一个主对象的子集合也可能不完整。

### 推荐 SQL 形态

```sql
-- 内层只确定本页主对象，外层再展开子集合。
SELECT p.id, p.name, c.id AS child_id, c.name AS child_name
FROM (
    SELECT p.id, p.name
    FROM parent p
    WHERE p.tenant_id = #{tenantId}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT #{offset}, #{pageSize}
) p
LEFT JOIN child c ON c.parent_id = p.id
ORDER BY p.created_at DESC, p.id DESC, c.id ASC;
```

### 插件改造链路

~~~plantuml
@startuml
title 一对多主表分页的 MyBatis 插件链路
participant "Service" as Service
participant "PageInterceptor" as Page
participant "自定义 Dialect" as Dialect
database "BoundSql" as BoundSql
database "Database" as DB
participant "ResultMap" as Result

Service -> Page : Executor.query
Page -> Dialect : 读取分页标记和参数
Dialect -> BoundSql : 生成 count/page SQL
BoundSql -> DB : 先分页主表再关联子表
DB --> Result : 展开结果集
Result -> Result : 按主键组装 collection
@enduml
~~~

实现时要重点保证：

- 主表过滤条件进入内层查询，否则分页前数据集会被错误放大。
- 主表排序必须稳定，通常使用业务排序字段加主键作为 tie-breaker，避免新增数据导致翻页漂移。
- `count` 使用 `COUNT(DISTINCT 主表主键)` 或独立的主表 count SQL，不能直接用 JOIN 后的 `COUNT(*)`。
- 复杂 SQL（`UNION`、嵌套查询、聚合）应明确不支持或交给可靠 SQL Parser，不能依赖脆弱的正则替换。
- 改写 SQL 时保留 `BoundSql` 的参数映射和附加参数，不能只替换字符串。
- 自定义上下文必须在 `finally` 清理，避免线程池复用时串用上一次请求的分页标记。

### 常见追问

- Q：为什么不在每个 Mapper 手写子查询？
  A：手写容易出现 page SQL 和 count SQL 不一致；集中在标记查询的 Dialect 中，可以复用规则，同时把影响范围限制在明确场景。
- Q：子表条件放在哪里？
  A：先区分它是决定主表是否入选，还是只过滤子集合展示；前者进入内层，后者通常保留在外层，不能把所有条件机械搬动。
- Q：`COUNT(DISTINCT)` 很慢怎么办？
  A：保证主表主键和过滤字段有合适索引，必要时使用独立 count、汇总表或产品允许的近似统计，不能为了总数牺牲主查询稳定性。

## Q2：如何用 AOP 和 MyBatis 拦截器实现低侵入数据权限？

### 结论（30 秒版）

注解只声明权限维度，AOP 在业务入口从可信的认证和组织关系中计算数据范围并写入上下文，MyBatis 拦截器在 SQL 执行前读取上下文，向 `BoundSql` 增加白名单字段和绑定参数。关键是参数绑定、别名处理、分页插件顺序、复杂 SQL 的安全边界以及 `ThreadLocal` 的清理；“统一拼接字符串”不能算完整的数据权限方案。

### 职责拆分

| 层次 | 职责 | 不应该做什么 |
| --- | --- | --- |
| 权限注解 | 声明组织、租户、区域等维度 | 接收任意表名、列名或 SQL 片段 |
| AOP | 解析认证信息并计算可信范围 | 直接信任前端传来的权限范围 |
| 上下文 | 在当前调用链临时保存范围 | 永久缓存用户权限或跨线程隐式传播 |
| MyBatis Interceptor | 改写 SQL 并补充绑定参数 | 直接拼接未校验的值 |
| 数据库 | 通过最终 SQL 执行约束 | 只依赖前端隐藏字段做安全控制 |

### 调用链

```text
认证上下文
  -> AOP 解析注解
  -> 计算可信组织范围
  -> ThreadLocal / 显式上下文
  -> MyBatis Interceptor
  -> 校验 SQL 别名与白名单
  -> BoundSql 增加条件和参数
  -> 执行查询
  -> finally 清理上下文
```

上下文清理示意：

```java
public Object around(ProceedingJoinPoint point, DataScope scope) throws Throwable {
    try {
        // 权限范围来自认证信息和服务端组织关系，不直接使用请求参数。
        dataScopeContext.set(resolveScope(scope));
        return point.proceed();
    } finally {
        // 线程池会复用线程，必须清理，避免不同请求之间串权限。
        dataScopeContext.remove();
    }
}
```

### 安全与插件顺序

- 表名、列名、操作符和 JOIN 别名使用服务端白名单；权限值通过预编译参数传递。
- 先把权限条件作用到原始查询，再生成分页 SQL，确保 count 和实际查询使用相同的权限边界。
- 对 `JOIN`、子查询、`UNION`、聚合、更新和删除分别定义支持范围；解析失败时默认阻断或走安全降级，不能静默放开权限。
- 权限范围过大时，考虑权限关系表、临时表或按用户/角色缓存范围，避免生成超长 `IN` 条件。

### 常见追问

- Q：为什么不在 Controller 中拼权限条件？
  A：Controller 只能覆盖部分入口，Service、定时任务和内部调用也可能访问数据；统一在数据访问边界拦截更不容易漏加。
- Q：`MetaObject` 的作用是什么？
  A：它可以反射访问 MyBatis 内部对象和属性，帮助定位或替换 `BoundSql`；它不是 SQL 解析器，也不能替代白名单和参数绑定。
- Q：权限插件和分页插件谁先执行？
  A：应先确定权限过滤范围，再分页；具体顺序以插件注册和实际执行链验证，必须同时检查 count SQL 与 page SQL。

