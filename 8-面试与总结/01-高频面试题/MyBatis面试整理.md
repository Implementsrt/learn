# 五、MyBatis

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

