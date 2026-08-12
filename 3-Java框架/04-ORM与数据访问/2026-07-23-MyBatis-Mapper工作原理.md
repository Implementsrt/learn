# MyBatis Mapper 工作原理

## 问题索引

- Q1：MyBatis Mapper 接口没有实现类，为什么可以执行 SQL？

## Q1：MyBatis Mapper 接口没有实现类，为什么可以执行 SQL？

### 核心结论

MyBatis 不会为每个 Mapper 手写或编译一个普通实现类，而是在运行时通过 **JDK 动态代理**生成 Mapper 代理对象。

调用 Mapper 方法时，代理对象根据：

~~~text
Mapper 接口全限定名 + 方法名
~~~

定位已经注册的 `MappedStatement`，再通过 `SqlSession -> Executor -> StatementHandler -> JDBC` 执行 SQL，并把结果转换为方法声明的返回类型。

### 总体流程

~~~plantuml
@startuml
skinparam monochrome true
skinparam shadowing false

actor Service
component "Mapper 动态代理\nMapperProxy" as Proxy
component "MapperMethod" as Method
component "SqlSession" as Session
component "Executor" as Executor
component "StatementHandler" as Handler
database "MySQL" as DB

Service -> Proxy : mapper.selectById(id)
Proxy -> Method : 解析方法和参数
Method -> Session : selectOne(statementId, params)
Session -> Executor
Executor -> Handler : 创建并执行 Statement
Handler -> DB : JDBC SQL
DB --> Handler : ResultSet
Handler --> Service : 对象/集合/影响行数
@enduml
~~~

理解 Mapper 可以分成两个阶段：

1. **启动注册阶段**：扫描接口、解析 XML/注解、注册 Mapper 和 `MappedStatement`。
2. **方法调用阶段**：创建动态代理，根据方法找到 SQL，完成参数绑定、执行和结果映射。

### 启动阶段：Mapper 如何被发现和注册

在 Spring Boot 中，Mapper 通常通过 `@MapperScan` 或接口上的 `@Mapper` 被扫描。

Spring 与 MyBatis 各自负责一部分工作：

| 组件 | 主要职责 |
| --- | --- |
| `ClassPathMapperScanner` | 扫描 Mapper 接口 |
| `MapperFactoryBean` | 把 Mapper 接口包装成 Spring BeanDefinition，负责创建代理对象 |
| `Configuration` | 保存 MyBatis 全局配置、Mapper、SQL 映射等元数据 |
| `MapperRegistry` | 保存 Mapper 接口对应的 `MapperProxyFactory` |
| `XMLMapperBuilder` / `MapperAnnotationBuilder` | 解析 XML 或注解 SQL |
| `MappedStatement` | 描述一条已解析 SQL，包括类型、参数、结果映射和缓存配置 |

核心注册关系可以理解为：

~~~text
UserMapper.class
  -> MapperRegistry.knownMappers
  -> MapperProxyFactory<UserMapper>

com.example.UserMapper.selectById
  -> Configuration.mappedStatements
  -> MappedStatement
~~~

XML 中的 `namespace` 必须与 Mapper 接口全限定名一致，`id` 通常与方法名一致：

~~~java
public interface UserMapper {
    User selectById(@Param("id") Long id);
}
~~~

~~~xml
<mapper namespace="com.example.mapper.UserMapper">
    <select id="selectById" resultType="com.example.domain.User">
        SELECT id, username, status
        FROM sys_user
        WHERE id = #{id}
    </select>
</mapper>
~~~

对应的 statement ID 是：

~~~text
com.example.mapper.UserMapper.selectById
~~~

这也解释了为什么 Mapper 方法不适合重载：MyBatis 默认使用“接口全限定名 + 方法名”定位语句，方法参数列表不参与 statement ID。

### 创建阶段：Mapper Bean 到底是什么

业务类注入的 `UserMapper` 不是接口实现类，而是代理对象。

大致创建链路：

~~~text
MapperFactoryBean#getObject
  -> SqlSession#getMapper(UserMapper.class)
  -> MapperRegistry#getMapper
  -> MapperProxyFactory#newInstance
  -> Proxy.newProxyInstance
  -> MapperProxy
~~~

因此下面的注入能够正常工作：

~~~java
@Service
public class UserService {
    private final UserMapper userMapper;

    public UserService(UserMapper userMapper) {
        // 注入的是实现 UserMapper 接口的 JDK 动态代理对象。
        this.userMapper = userMapper;
    }
}
~~~

Mapper 代理通常可以作为 Spring 单例使用。线程安全的关键不是代理对象没有状态，而是 MyBatis-Spring 注入的通常是线程安全的 `SqlSessionTemplate`，它会为当前调用获取与事务绑定的真实 `SqlSession`，而不是让多个线程共享同一个 `DefaultSqlSession`。

### 调用阶段：MapperProxy 如何处理方法

调用 `userMapper.selectById(1L)` 时，JDK 动态代理把调用交给 `MapperProxy#invoke`。

它会先区分方法类型：

- `Object` 方法，例如 `toString`、`equals`。
- Mapper 接口的 default 方法。
- 普通 Mapper SQL 方法。

普通 SQL 方法会创建并缓存 `MapperMethod`。`MapperMethod` 主要包含：

- `SqlCommand`：根据 statement ID 确定 SQL 类型，例如 `SELECT/INSERT/UPDATE/DELETE`。
- `MethodSignature`：分析参数、`@Param`、返回类型、集合、游标和 `RowBounds`。

概念性调用链：

~~~text
MapperProxy#invoke
  -> MapperMethod#execute
  -> SqlSession#selectOne/selectList/insert/update/delete
  -> Executor#query/update
  -> StatementHandler
  -> JDBC PreparedStatement
~~~

### 参数是怎么转换的

Mapper 方法可能有一个或多个参数：

~~~java
User selectByNameAndStatus(
    @Param("name") String name,
    @Param("status") Integer status
);
~~~

`ParamNameResolver` 会把参数转换成 SQL 可访问的参数对象。显式使用 `@Param` 后，可以在 XML 中稳定引用：

~~~xml
WHERE username = #{name}
  AND status = #{status}
~~~

没有 `@Param` 时，能否直接使用 Java 参数名与编译器是否保留参数名、MyBatis 配置及版本有关。公共 Mapper 方法建议显式标注 `@Param`，避免重构参数名或构建配置变化导致绑定失败。

集合参数通常通过 `<foreach>` 展开：

~~~xml
<select id="selectByIds" resultType="com.example.domain.User">
    SELECT id, username, status
    FROM sys_user
    WHERE id IN
    <foreach collection="ids" item="id" open="(" separator="," close=")">
        #{id}
    </foreach>
</select>
~~~

### SQL 是怎么一步步执行的

`SqlSession` 找到 `MappedStatement` 后，把执行委托给 `Executor`。

#### Executor

常见执行器：

| Executor | 特点 |
| --- | --- |
| `SimpleExecutor` | 每次执行创建新的 Statement |
| `ReuseExecutor` | 在会话内复用相同 SQL 的 Statement |
| `BatchExecutor` | 累积多次更新，统一执行 JDBC Batch |
| `CachingExecutor` | 装饰其他 Executor，处理二级缓存 |

一级缓存属于 `SqlSession/Executor` 生命周期。同一个 SqlSession 内执行相同查询可能命中本地缓存；执行更新、提交、回滚或显式清理时会影响缓存。

#### StatementHandler

`StatementHandler` 负责：

- 创建 `Statement/PreparedStatement/CallableStatement`。
- 通过 `ParameterHandler` 设置 JDBC 参数。
- 执行 SQL。
- 通过 `ResultSetHandler` 把结果集映射成 Java 对象。

MyBatis 插件能够拦截 `Executor`、`StatementHandler`、`ParameterHandler`、`ResultSetHandler` 的指定方法，因此分页、数据权限和 SQL 审计插件通常围绕这些扩展点实现。

### Spring 事务如何参与 Mapper 调用

在 MyBatis-Spring 中，Mapper 代理调用的是 `SqlSessionTemplate`。

~~~text
Spring @Transactional
  -> TransactionSynchronizationManager 绑定数据库连接/SqlSession
  -> MapperProxy 调用 SqlSessionTemplate
  -> SqlSessionTemplate 获取当前事务 SqlSession
  -> 多个 Mapper 共用同一事务连接
  -> 提交或回滚由 Spring 事务管理器控制
~~~

不要把 Spring 管理的 Mapper 调用和手动 `openSession()` 混用。手动创建的 SqlSession 如果没有显式加入 Spring 事务，可能使用另一条连接，导致部分操作不在同一事务中。

### 返回值如何适配

`MapperMethod` 会根据方法返回类型选择执行方式：

| 返回类型 | 常见处理 |
| --- | --- |
| 单个对象 | `selectOne`，多于一行抛异常 |
| `List/Collection` | `selectList` 后转换集合 |
| `Map` | 根据 `@MapKey` 组织结果 |
| `Optional` | 将单行结果包装为 Optional |
| `Cursor` | 流式迭代结果 |
| `int/long/boolean` | 将增删改影响行数转换成声明类型 |
| `void + ResultHandler` | 由回调逐条处理结果 |

`selectOne` 不是只取第一行。如果 SQL 返回多行，会抛出 `TooManyResultsException`，应通过唯一约束或查询条件保证结果唯一。

### 常见问题与踩坑点

1. XML `namespace` 与 Mapper 全限定名不一致，导致找不到 statement。
2. XML `id` 与方法名不一致，抛出 `Invalid bound statement`。
3. Mapper 方法重载，多个方法竞争同一个 statement ID。
4. 多参数没有 `@Param`，XML 使用了错误参数名。
5. 返回单对象的 SQL 实际返回多行，触发 `TooManyResultsException`。
6. 忘记 `@MapperScan/@Mapper`，接口没有注册成 Spring Bean。
7. XML 没有放进正确 resources 路径，或者 `mapper-locations` 配置错误。
8. 在 Spring 事务中手动创建 SqlSession，操作脱离当前事务。
9. 把 `DefaultSqlSession` 当成线程安全对象跨线程共享。
10. 误以为 Mapper 代理直接执行 SQL，忽略 Executor、插件、缓存和 StatementHandler 链路。

### 面试话术

> MyBatis Mapper 接口没有实现类也能执行，是因为启动时 MyBatis 会通过 MapperRegistry 注册接口，并解析 XML 或注解生成以“接口全限定名 + 方法名”为 key 的 MappedStatement。Spring 注入 Mapper 时，MapperFactoryBean 通过 SqlSession.getMapper 创建 JDK 动态代理 MapperProxy。调用接口方法后，MapperProxy 使用 MapperMethod 解析 SQL 类型、参数和返回值，再调用 SqlSession。SqlSession 把请求交给 Executor，Executor 经过缓存和插件链后使用 StatementHandler 创建 PreparedStatement，ParameterHandler 绑定参数，ResultSetHandler 映射结果。MyBatis-Spring 中实际使用 SqlSessionTemplate 获取与 Spring 事务绑定的 SqlSession，因此 Mapper 代理可以作为单例使用，但 DefaultSqlSession 本身不是线程安全的。

### 高频追问

- Q：Mapper 为什么不能随意重载方法？
  A：MappedStatement 默认按“接口全限定名 + 方法名”定位，不包含参数签名，重载方法无法分别绑定不同 statement。

- Q：Mapper 代理是线程安全的吗？
  A：代理本身基本无业务状态，Spring 环境中通常委托线程安全的 SqlSessionTemplate；真正的 DefaultSqlSession 不是线程安全的，不能跨线程共享。

- Q：`#{}` 和 `${}` 有什么区别？
  A：`#{}` 使用 PreparedStatement 参数绑定，可避免普通值的 SQL 注入；`${}` 是字符串直接替换，只适用于经过白名单校验的表名、列名等动态结构。

- Q：一级缓存为什么可能产生旧数据？
  A：它在 SqlSession 范围缓存查询结果。如果同一事务外部绕过当前 SqlSession 修改了数据，当前会话再次查询可能仍命中旧缓存。

- Q：MyBatis 插件为什么能修改 SQL？
  A：插件通过动态代理拦截 Executor、StatementHandler 等扩展点，在 SQL 准备或执行前读取并修改 BoundSql、参数或执行行为。

### 复习清单

- [ ] 能画出 MapperProxy 到 JDBC 的调用链
- [ ] 能说明 MapperRegistry、MapperFactoryBean 和 MappedStatement 的职责
- [ ] 能解释 statement ID 为什么是接口全限定名加方法名
- [ ] 能说明 MapperMethod 如何解析参数、SQL 类型和返回值
- [ ] 能区分 SqlSessionTemplate 与 DefaultSqlSession 的线程安全性
- [ ] 能说出四类 Executor 和四类插件拦截对象
- [ ] 能排查 Mapper 未扫描、参数绑定失败和 Invalid bound statement

### 参考资料

- [MyBatis 3 Getting Started](https://mybatis.org/mybatis-3/getting-started.html)
- [MyBatis 3 Java API](https://mybatis.org/mybatis-3/java-api.html)
- [MyBatis-Spring Reference](https://mybatis.org/spring/)
