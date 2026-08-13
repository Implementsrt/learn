# 四、Spring / Spring Boot

## Q1：Spring IOC 和 AOP？

> 知识点：[Spring AOP 代理链](../../3-Java框架/01-Spring核心/2026-06-24-Spring-AOP代理链.md#q1-spring-aop-是多层代理还是一层代理处理所有增强)

**IOC（控制反转）：** 对象的创建和依赖关系由 Spring 容器管理，而不是程序员 new。

```
传统方式：UserService service = new UserServiceImpl();  // 自己创建
IOC 方式：@Autowired UserService service;              // 容器注入
```

**AOP（面向切面编程）：** 将横切关注点（日志、事务、权限）从业务逻辑中分离。

```
请求 → [日志切面] → [权限切面] → [事务切面] → 业务方法 → 返回
                                                    
不用 AOP：每个方法里都要写日志、事务代码
用 AOP：  统一定义一次，自动应用到所有需要的方法
```

**AOP 核心概念：**
- **切面（Aspect）：** 横切关注点的模块化（如 @Aspect 类）
- **切点（Pointcut）：** 定义在哪些方法上生效（如 `@annotation(xxx)` 或 `execution(...)`）
- **通知（Advice）：** 切面的具体逻辑
  - `@Before`：方法前
  - `@After`：方法后（无论是否异常）
  - `@AfterReturning`：方法正常返回后
  - `@AfterThrowing`：方法异常后
  - `@Around`：环绕，最强大

**Spring AOP 实现原理：** 动态代理
- 目标类实现了接口 → JDK 动态代理（基于接口）
- 目标类没有接口 → CGLIB 代理（基于继承，生成子类）

---

## Q2：Spring Bean 的生命周期？

> 知识点：[Spring Bean 生命周期](../../3-Java框架/01-Spring核心/2026-06-24-Spring-Bean生命周期.md#q1-bean-的生命周期以及各个阶段的关键点)

```
① 实例化：new 对象（反射）
  ↓
② 属性填充：@Autowired 注入依赖
  ↓
③ Aware 接口回调：BeanNameAware、ApplicationContextAware 等
  ↓
④ BeanPostProcessor.postProcessBeforeInitialization()
  ↓
⑤ 初始化：@PostConstruct → InitializingBean.afterPropertiesSet() → init-method
  ↓
⑥ BeanPostProcessor.postProcessAfterInitialization()
  （AOP 代理就是在这里生成的）
  ↓
⑦ 使用
  ↓
⑧ 销毁：@PreDestroy → DisposableBean.destroy() → destroy-method
```

---

## Q3：Spring 循环依赖怎么解决？

> 知识点：[Spring 三级缓存与循环依赖](../../3-Java框架/01-Spring核心/2026-06-24-Spring三级缓存与循环依赖.md#q1-spring-如何通过三级缓存解决循环依赖-以及为什么需要三级缓存)

**三级缓存：**

```
singletonObjects        （一级）完全初始化好的 Bean
earlySingletonObjects   （二级）提前暴露的 Bean（已实例化，未填充属性）
singletonFactories      （三级）Bean 工厂（用于创建代理对象）
```

**解决过程（A 依赖 B，B 依赖 A）：**

```
① 创建 A → 实例化 A → 把 A 的工厂放入三级缓存
② 填充 A 的属性 → 发现需要 B
③ 创建 B → 实例化 B → 把 B 的工厂放入三级缓存
④ 填充 B 的属性 → 发现需要 A
⑤ 从三级缓存找到 A 的工厂 → 创建 A 的早期引用 → 放入二级缓存
⑥ B 拿到 A 的早期引用 → B 初始化完成 → 放入一级缓存
⑦ A 拿到 B → A 初始化完成 → 放入一级缓存
```

**注意：** 构造器注入的循环依赖无法解决（因为实例化都完不成），用 `@Lazy` 延迟加载可以解决。

---

## Q4：Spring 事务失效的场景？

> 知识点：[Spring 事务原理与失效场景](../../3-Java框架/01-Spring核心/2026-08-14-Spring事务原理与失效场景.md#q2-spring-事务为什么会失效-传播行为如何选择)

| 场景 | 原因 |
|------|------|
| 方法不是 public | Spring AOP 代理只能拦截 public 方法 |
| 自调用（this.method()） | 没走代理，直接调用了目标对象的方法 |
| 异常被 catch 了 | 事务看不到异常，不会回滚 |
| 抛出非 RuntimeException | 默认只回滚 RuntimeException 和 Error |
| 数据库引擎不支持 | MyISAM 不支持事务，要用 InnoDB |
| Bean 没被 Spring 管理 | 没加 @Service / @Component |
| 传播行为设置不当 | REQUIRES_NEW 会开新事务，NOT_SUPPORTED 不用事务 |

**自调用解决方案：**

```java
// 方案 1：注入自己
@Service
public class UserService {
    @Autowired
    private UserService self; // 注入的是代理对象

    public void methodA() {
        self.methodB(); // 通过代理调用，事务生效
    }

    @Transactional
    public void methodB() { ... }
}

// 方案 2：AopContext
((UserService) AopContext.currentProxy()).methodB();
```

---

## Q5：Spring Boot 自动配置原理？

> 知识点：[Spring Boot 核心组件与自动配置](../../3-Java框架/02-SpringBoot/2026-07-22-SpringBoot核心组件与原理.md#q1-spring-boot-有哪些核心组件-启动和自动配置的原理是什么)

```
@SpringBootApplication
  ├── @SpringBootConfiguration    （= @Configuration）
  ├── @EnableAutoConfiguration    （核心：开启自动配置）
  │     └── @Import(AutoConfigurationImportSelector.class)
  │           → 读取 META-INF/spring.factories
  │           → 加载所有 xxxAutoConfiguration 类
  │           → @ConditionalOnXxx 条件判断：
  │               @ConditionalOnClass        类路径有某个类才生效
  │               @ConditionalOnBean         容器有某个 Bean 才生效
  │               @ConditionalOnProperty     配置属性满足条件才生效
  │               @ConditionalOnMissingBean  容器没有某个 Bean 才生效
  └── @ComponentScan              （扫描当前包及子包）
```

**白话：** 引入 starter 依赖 → 类路径下有了相关的类 → @ConditionalOnClass 成立 → 自动配置类生效 → 自动创建并配置好 Bean。比如引入 `spring-boot-starter-data-redis`，Redis 相关的 Bean 就自动配好了。


---

# 十八、Spring 补充

## Q6：@Autowired 和 @Resource 的区别？

| 对比 | @Autowired | @Resource |
|------|-----------|-----------|
| 来源 | Spring | JDK（javax.annotation） |
| 注入方式 | **先按类型**，类型重复再按名称 | **先按名称**，找不到再按类型 |
| 必须存在 | 默认 required=true，可设 false | 找不到直接报错 |
| 支持 @Qualifier | 配合 @Qualifier 指定名称 | 直接用 name 属性 |

```java
// 有多个实现类时：
@Autowired
@Qualifier("alipayService") // 指定 Bean 名称
private PayService payService;

@Resource(name = "alipayService") // 直接指定
private PayService payService;
```

---

## Q7：Spring MVC 执行流程（详细版）

```
客户端请求
  ↓
DispatcherServlet.doDispatch()
  ↓
① HandlerMapping.getHandler()
   遍历所有 HandlerMapping，找到匹配的 Handler
   返回 HandlerExecutionChain（Handler + 拦截器列表）
  ↓
② HandlerAdapter.supports()
   找到能处理这个 Handler 的 Adapter
  ↓
③ HandlerInterceptor.preHandle()
   拦截器前置处理（按注册顺序执行）
   返回 false → 中断请求
  ↓
④ HandlerAdapter.handle()
   - 参数解析（ArgumentResolver）
   - 数据绑定与校验
   - 反射调用 Controller 方法
   - 返回值处理（ReturnValueHandler）
  ↓
⑤ HandlerInterceptor.postHandle()
   拦截器后置处理（按注册逆序执行）
  ↓
⑥ ViewResolver.resolveViewName()（如果返回视图）
   或 HttpMessageConverter 写 JSON（@ResponseBody）
  ↓
⑦ HandlerInterceptor.afterCompletion()
   请求完成后处理（无论成功失败都执行）
  ↓
响应客户端
```

---

## Q8：Spring 事务传播行为？

| 传播行为 | 说明 | 场景 |
|---------|------|------|
| **REQUIRED**（默认） | 有事务就加入，没有就新建 | 大多数场景 |
| REQUIRES_NEW | 无论是否有事务，都新建（挂起当前事务） | 日志记录（不随主事务回滚） |
| NESTED | 有事务就在其中开启嵌套事务（savepoint） | 部分回滚 |
| SUPPORTS | 有事务就加入，没有就不用事务 | 查询方法 |
| NOT_SUPPORTED | 无论是否有事务，都不用事务（挂起当前） | 不需要事务的操作 |
| MANDATORY | 必须在事务中，没有则报错 | 强制要求 |
| NEVER | 不能在事务中，有则报错 | 禁止事务 |

```java
@Service
public class OrderService {
    @Autowired
    private LogService logService;
    
    @Transactional
    public void createOrder(Order order) {
        orderMapper.insert(order);
        // 日志记录用 REQUIRES_NEW，即使主事务回滚，日志也能保留
        logService.saveLog("创建订单: " + order.getId());
        
        if (something_wrong) {
            throw new RuntimeException(); // 主事务回滚，但日志不回滚
        }
    }
}

@Service
public class LogService {
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveLog(String msg) {
        logMapper.insert(msg); // 独立事务
    }
}
```

---

## Q9：Spring 中的设计模式？

| 模式 | 应用 |
|------|------|
| 工厂模式 | BeanFactory / ApplicationContext |
| 单例模式 | Spring Bean 默认单例 |
| 代理模式 | AOP（JDK 动态代理 / CGLIB） |
| 模板方法 | JdbcTemplate、RestTemplate |
| 观察者模式 | ApplicationEvent / ApplicationListener |
| 适配器模式 | HandlerAdapter |
| 策略模式 | Resource 接口的多种实现 |
| 责任链模式 | Servlet Filter、Interceptor |

---

## Q10：@Component、@Service、@Repository、@Controller 的区别？

**功能上没有区别**，都是把类注册为 Spring Bean。区别在于语义：

| 注解 | 语义 | 额外功能 |
|------|------|---------|
| @Component | 通用组件 | 无 |
| @Controller | 控制层 | Spring MVC 识别为 Controller |
| @Service | 业务层 | 无（纯语义标记） |
| @Repository | 持久层 | 异常自动转换为 DataAccessException |


---

# 二十四、Spring 源码级面试题（深入篇）

> 如果提到阅读过 Bean 生命周期、AOP 代理、事务拦截器等核心源码，面试官大概率会深挖以下问题。

---

## 一、Spring IOC 容器

### 1. Spring IOC 容器启动流程？（refresh 方法）

```
AbstractApplicationContext.refresh() 是 Spring 容器启动的核心入口，共 12 步：

① prepareRefresh()
   准备工作：设置启动时间、激活标志位、初始化属性源

② obtainFreshBeanFactory()
   创建 BeanFactory（DefaultListableBeanFactory）
   加载所有 BeanDefinition（从 XML / 注解 / @Configuration 等来源）

③ prepareBeanFactory(beanFactory)
   配置 BeanFactory：设置 ClassLoader、SpEL 解析器
   注册默认的 BeanPostProcessor（如 ApplicationContextAwareProcessor）

④ postProcessBeanFactory(beanFactory)
   子类扩展点（如 Web 环境注册 Servlet 相关 Scope）

⑤ invokeBeanFactoryPostProcessors(beanFactory)    ★ 重点
   执行所有 BeanFactoryPostProcessor
   → ConfigurationClassPostProcessor 在这里工作
   → 解析 @Configuration、@Bean、@ComponentScan、@Import、@Conditional
   → 把解析出来的类注册为 BeanDefinition

⑥ registerBeanPostProcessors(beanFactory)
   注册所有 BeanPostProcessor（此时只注册，不执行）
   → AutowiredAnnotationBeanPostProcessor
   → CommonAnnotationBeanPostProcessor
   → AbstractAutoProxyCreator（AOP）

⑦ initMessageSource()
   初始化国际化消息源

⑧ initApplicationEventMulticaster()
   初始化事件广播器

⑨ onRefresh()
   子类扩展点
   → SpringBoot 在这里启动内嵌 Tomcat / Jetty / Undertow

⑩ registerListeners()
   注册事件监听器（@EventListener / ApplicationListener）

⑪ finishBeanDefinitionInstantiation()             ★ 重点
   实例化所有非懒加载的单例 Bean
   → 触发 Bean 生命周期（实例化 → 属性填充 → 初始化）

⑫ finishRefresh()
   发布 ContextRefreshedEvent 事件
   → 标志着容器启动完成
```

**面试简答版：**
> refresh() 主要做三件事：① 加载 BeanDefinition（设计图纸）② 注册各种后置处理器 ③ 实例化所有单例 Bean。其中 ConfigurationClassPostProcessor 负责解析 @Configuration 等注解生成 BeanDefinition，Bean 的创建则在 finishBeanDefinitionInstantiation 中完成。

---

### 2. BeanDefinition 是什么？有什么用？

```
BeanDefinition 是 Bean 的"设计图纸"/"元数据"，描述了如何创建一个 Bean。

包含的信息：
  - beanClassName          类全名
  - scope                  singleton / prototype
  - lazyInit               是否懒加载
  - dependsOn              依赖哪些 Bean
  - autowireMode           自动装配模式
  - initMethodName         初始化方法
  - destroyMethodName      销毁方法
  - constructorArgumentValues  构造器参数
  - propertyValues         属性值

来源（谁生成了 BeanDefinition）：
  @Component / @Service / @Controller
    → ClassPathBeanDefinitionScanner 扫描 + 注册
  @Bean
    → ConfigurationClassPostProcessor 解析 @Configuration 类
  XML <bean>
    → XmlBeanDefinitionReader 解析

核心理解：
  先有 BeanDefinition（图纸），后有 Bean 实例（产品）
  BeanFactoryPostProcessor 修改的是图纸
  BeanPostProcessor 修改的是产品
```

---

### 3. BeanFactory 和 ApplicationContext 的区别？

```
BeanFactory（IoC 容器的根接口）：
  - 最底层的容器接口
  - 懒加载：getBean() 时才创建
  - 只提供基本的 Bean 获取和管理
  
ApplicationContext（BeanFactory 的子接口）：
  - 在 BeanFactory 基础上扩展了企业级功能
  - 启动时就实例化所有单例 Bean（预加载）
  - 支持事件发布（ApplicationEvent）
  - 支持国际化（MessageSource）
  - 支持 AOP 自动代理
  - 支持资源加载（ResourceLoader）

常用实现类：
  AnnotationConfigApplicationContext  注解驱动
  ClassPathXmlApplicationContext      XML 驱动
  GenericWebApplicationContext        Web 环境

关系：
  ApplicationContext extends ListableBeanFactory extends BeanFactory
  ApplicationContext 内部持有一个 DefaultListableBeanFactory 做实际的 Bean 管理
```

---

### 4. @Autowired 的注入原理？在哪个阶段完成？

```
@Autowired 由 AutowiredAnnotationBeanPostProcessor 处理

时机：Bean 生命周期的"属性填充"阶段（populateBean）

详细流程：
① Bean 实例化完成后（还没初始化），进入 populateBean() 方法
② 遍历所有 BeanPostProcessor
③ AutowiredAnnotationBeanPostProcessor.postProcessProperties() 被调用
④ 扫描当前 Bean 类中所有标注 @Autowired / @Value 的字段和方法
   → 封装为 InjectionMetadata（注入元数据）
⑤ 对每个注入点执行 inject()：
   → 按类型从容器中查找候选 Bean（byType）
   → 如果有多个候选：
     → 优先看 @Qualifier 指定的名称
     → 其次看 @Primary 标记的 Bean
     → 最后按字段名匹配（byName）
   → 通过反射 Field.set() 或 Method.invoke() 完成注入

源码调用链：
  AbstractAutowireCapableBeanFactory.populateBean()
  → AutowiredAnnotationBeanPostProcessor.postProcessProperties()
  → InjectionMetadata.inject()
  → AutowiredFieldElement.inject()
  → beanFactory.resolveDependency()  // 从容器中查找 Bean
  → field.set(bean, value)           // 反射注入
```

---

## 二、Bean 生命周期（必问 TOP1）

### 5. Spring Bean 的完整生命周期？

```
以 createBean() → doCreateBean() 为入口：

┌───────────────────────────────────────────────────────────┐
│                      Bean 生命周期                          │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ① 实例化（Instantiation）                                  │
│     createBeanInstance()                                   │
│     → 推断构造方法                                          │
│     → 反射调用构造器创建对象（此时是空对象，属性都是 null）    │
│                         ↓                                  │
│  ② 放入三级缓存                                             │
│     addSingletonFactory(beanName, ObjectFactory)           │
│     → 为解决循环依赖做准备                                   │
│                         ↓                                  │
│  ③ 属性填充（Population）                                   │
│     populateBean()                                         │
│     → @Autowired 注入（AutowiredAnnotationBeanPostProcessor）│
│     → @Resource 注入（CommonAnnotationBeanPostProcessor）   │
│     → @Value 注入                                          │
│                         ↓                                  │
│  ④ Aware 回调                                               │
│     invokeAwareMethods()                                   │
│     → BeanNameAware.setBeanName(name)                      │
│     → BeanClassLoaderAware.setBeanClassLoader(cl)          │
│     → BeanFactoryAware.setBeanFactory(factory)             │
│                         ↓                                  │
│  ⑤ BeanPostProcessor 前置处理                               │
│     applyBeanPostProcessorsBeforeInitialization()          │
│     → ApplicationContextAwareProcessor                     │
│       → ApplicationContextAware.setApplicationContext()    │
│     → CommonAnnotationBeanPostProcessor                    │
│       → @PostConstruct 方法执行 ★                          │
│                         ↓                                  │
│  ⑥ 初始化（Initialization）                                 │
│     invokeInitMethods()                                    │
│     → InitializingBean.afterPropertiesSet()                │
│     → 自定义 init-method                                   │
│                         ↓                                  │
│  ⑦ BeanPostProcessor 后置处理                               │
│     applyBeanPostProcessorsAfterInitialization()           │
│     → AbstractAutoProxyCreator                             │
│       → 判断是否需要 AOP → 创建代理对象 ★                   │
│       → 返回代理对象（替换原始 Bean）                        │
│                         ↓                                  │
│  ⑧ 注册销毁回调                                             │
│     registerDisposableBeanIfNecessary()                    │
│                         ↓                                  │
│  ⑨ 放入一级缓存（完整的 Bean）                               │
│     addSingleton(beanName, singletonObject)                │
│                         ↓                                  │
│  ⑩ 使用 Bean                                               │
│                         ↓                                  │
│  ⑪ 销毁                                                    │
│     → @PreDestroy                                          │
│     → DisposableBean.destroy()                             │
│     → 自定义 destroy-method                                │
│                                                            │
└───────────────────────────────────────────────────────────┘

执行顺序总结：
  构造器 → @Autowired → @PostConstruct → afterPropertiesSet() → init-method → AOP代理

销毁顺序：
  @PreDestroy → destroy() → destroy-method
```

**高频追问：**

```
Q: AOP 代理在哪个阶段创建？
A: 第 ⑦ 步 postProcessAfterInitialization，
   由 AbstractAutoProxyCreator（AnnotationAwareAspectJAutoProxyCreator 的父类）创建。

Q: @PostConstruct 和 InitializingBean 谁先执行？
A: @PostConstruct 先执行（第 ⑤ 步 BeanPostProcessor.before 阶段）
   InitializingBean.afterPropertiesSet() 后执行（第 ⑥ 步初始化阶段）

Q: @Autowired 和 Aware 回调谁先？
A: @Autowired 先（第 ③ 步属性填充），Aware 后（第 ④ 步）
   但 ApplicationContextAware 比较特殊，它在第 ⑤ 步由 ApplicationContextAwareProcessor 处理

Q: Bean 实例化后为什么要先放入三级缓存再填充属性？
A: 因为属性填充时可能触发其他 Bean 的创建（循环依赖），
   先放入三级缓存才能让其他 Bean 获取到当前 Bean 的早期引用
```

---

## 三、循环依赖与三级缓存（必问 TOP2）

### 6. Spring 怎么解决循环依赖？三级缓存分别是什么？

```java
// DefaultSingletonBeanRegistry 中的三级缓存

// 一级缓存：存放完整的 Bean（已经历完整生命周期）
Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

// 二级缓存：存放提前暴露的 Bean（实例化了但未初始化完成）
Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);

// 三级缓存：存放 ObjectFactory（Bean 的工厂 lambda）
Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);
```

```
循环依赖场景：A 依赖 B，B 依赖 A

完整流程：

① getBean(A) → 一二三级缓存都没有 → 开始创建 A
② 实例化 A（构造器创建空对象）
③ 将 A 的 ObjectFactory 放入三级缓存
   singletonFactories.put("A", () -> getEarlyBeanReference(A))
   → 这个 lambda 被调用时才决定返回原始对象还是代理对象
④ 填充 A 的属性 → 发现依赖 B → getBean(B)

⑤ getBean(B) → 缓存都没有 → 开始创建 B
⑥ 实例化 B
⑦ 将 B 的 ObjectFactory 放入三级缓存
⑧ 填充 B 的属性 → 发现依赖 A → getBean(A)

⑨ getBean(A) → 一级没有 → 二级没有 → 三级有！
   → 调用 ObjectFactory.getObject()
   → 内部调用 getEarlyBeanReference(A)
   → SmartInstantiationAwareBeanPostProcessor.getEarlyBeanReference()
   → 如果 A 需要 AOP 代理，在这里提前创建代理对象
   → 如果 A 不需要代理，直接返回原始对象
   → 将结果放入二级缓存，删除三级缓存
⑩ B 拿到 A 的早期引用 → B 继续初始化 → B 完成 → 放入一级缓存

⑪ 回到 A → A 拿到完整的 B → A 继续初始化 → A 完成 → 放入一级缓存

时间线：
  createA → 实例化A → 三级缓存放A → 填充属性发现需要B
    → createB → 实例化B → 三级缓存放B → 填充属性发现需要A
      → 从三级缓存拿A → 放入二级缓存
    → B完成 → 一级缓存放B
  → A拿到B → A完成 → 一级缓存放A
```

---

### 7. 为什么需要三级缓存而不是两级？

```
核心原因：为了延迟 AOP 代理的创建时机

假设只有两级缓存（一级 + 二级）：
  实例化 A 后，立即就要决定放入二级缓存的是"原始对象"还是"代理对象"
  但此时 A 还没走到 postProcessAfterInitialization（AOP 创建代理的正常时机）
  → 不得不提前创建代理，打破了 Bean 生命周期的正常顺序

三级缓存的好处：
  第三级存的是 ObjectFactory（工厂 lambda），不是具体对象
  只有当这个 Bean 真正被其他 Bean 引用时，才调用工厂方法
  调用时才判断：
    - 需要 AOP？→ 创建代理对象返回
    - 不需要 AOP？→ 返回原始对象
  
  这样做到了：
  ① 如果没有循环依赖，代理对象在正常时机创建（第 ⑦ 步）
  ② 如果有循环依赖，才提前创建代理（但只创建一次，保证单例）
  ③ 不管哪种情况，最终容器中都是同一个对象

如果没有 AOP：
  确实两级缓存就够了
  三级缓存的存在是为了兼容 AOP 场景
```

---

### 8. 什么情况下 Spring 解决不了循环依赖？

```
① 构造器注入的循环依赖
   A 的构造器需要 B，B 的构造器需要 A
   → 实例化 A 时就需要 B，但 A 还没实例化完，无法放入三级缓存
   → 报错：BeanCurrentlyInCreationException
   
   解决：其中一方使用 @Lazy
   @Lazy 的原理：注入的不是真实 Bean，而是一个代理对象
                 代理对象在真正调用方法时才去容器 getBean()

② prototype 作用域的循环依赖
   Spring 只对 singleton 解决循环依赖
   prototype 每次都创建新对象，无法缓存

③ @Async + 循环依赖
   @Async 会创建代理对象，但创建时机和普通 AOP 不同
   可能导致"早期引用"和"最终 Bean"不是同一个对象
   → 报错：BeanCurrentlyInCreationException
   → 解决：@Lazy 或调整依赖关系
```

---

## 四、AOP 原理

### 9. Spring AOP 的实现原理？JDK 动态代理 vs CGLIB？

```
Spring AOP 基于动态代理实现，在运行时为目标对象创建代理对象。

┌──────────────────────────────────────────────────────────┐
│                    JDK 动态代理                            │
│                                                           │
│  条件：目标类实现了接口                                     │
│  原理：java.lang.reflect.Proxy.newProxyInstance()         │
│       生成一个实现了相同接口的代理类                         │
│  调用链：                                                  │
│    client → proxy.method()                                │
│           → InvocationHandler.invoke()                    │
│           → 前置增强                                       │
│           → target.method()（反射调用原始方法）             │
│           → 后置增强                                       │
│  限制：只能代理接口中定义的方法                              │
├──────────────────────────────────────────────────────────┤
│                    CGLIB 代理                              │
│                                                           │
│  条件：目标类没有实现接口（或强制使用 CGLIB）               │
│  原理：通过 ASM 字节码框架，生成目标类的子类                │
│       子类重写目标方法，在方法前后插入增强逻辑              │
│  调用链：                                                  │
│    client → proxy.method()                                │
│           → MethodInterceptor.intercept()                 │
│           → 前置增强                                       │
│           → methodProxy.invokeSuper()（调用父类原始方法）  │
│           → 后置增强                                       │
│  限制：不能代理 final 类和 final 方法（无法被子类重写）     │
└──────────────────────────────────────────────────────────┘

Spring Boot 2.x 默认配置：
  spring.aop.proxy-target-class=true
  → 无论是否有接口，都使用 CGLIB
  → 原因：避免类型转换问题（注入时用实现类接收却拿到接口代理）
```

---

### 10. AOP 代理对象的创建过程？（源码级）

```
入口：AbstractAutoProxyCreator.postProcessAfterInitialization()

源码流程：

① postProcessAfterInitialization(bean, beanName)
   → wrapIfNecessary(bean, beanName, cacheKey)

② 查找所有候选 Advisor
   → findCandidateAdvisors()
   → 从容器中找所有 Advisor 类型的 Bean
   → 解析所有 @Aspect 类中的 @Around/@Before/@After/@AfterReturning/@AfterThrowing
   → 每个通知方法被封装为一个 Advisor（包含 Pointcut + Advice）

③ 筛选能应用于当前 Bean 的 Advisor
   → findAdvisorsThatCanApply(candidateAdvisors, beanClass)
   → 对每个 Advisor 做匹配：
     → ClassFilter.matches(targetClass)     类级别匹配
     → MethodMatcher.matches(method, targetClass) 方法级别匹配
   → AspectJ 表达式在这里解析（如 execution(* com.example.service.*.*(..))）

④ 如果有匹配的 Advisor → 创建代理
   → createProxy(beanClass, beanName, specificInterceptors, targetSource)
   → ProxyFactory proxyFactory = new ProxyFactory()
   → proxyFactory.addAdvisors(advisors)
   → 判断使用 JDK 还是 CGLIB：
     if (proxyTargetClass || 目标类没有实现接口) → CGLIB
     else → JDK 动态代理
   → proxyFactory.getProxy(classLoader)

⑤ 返回代理对象
   → 这个代理对象替代原始 Bean 存入容器
   → 后续其他 Bean @Autowired 拿到的都是代理对象
```

---

### 11. @Aspect 中各种通知的执行顺序？

```
Spring 5.2.7+ 的执行顺序（修正后）：

正常执行：
  @Around 前半段（proceed 之前）
    → @Before
      → 目标方法执行
    → @AfterReturning
  → @After（finally 语义，一定执行）
  → @Around 后半段（proceed 之后）

异常执行：
  @Around 前半段
    → @Before
      → 目标方法抛异常
    → @AfterThrowing
  → @After（finally 语义，一定执行）
  → @Around（catch 到异常）

多个 @Aspect 的顺序：
  通过 @Order(n) 控制，值越小优先级越高
  → @Order(1) 的 @Before 先执行
  → @Order(1) 的 @After 后执行
  → 像洋葱模型一样层层嵌套

源码对应：
  所有 Advice 被封装为 MethodInterceptor，组成拦截器链
  通过 ReflectiveMethodInvocation.proceed() 按责任链模式依次调用
```

---

### 12. 拦截器链的执行原理？（责任链模式）

```java
// ReflectiveMethodInvocation 核心代码（简化版）
public Object proceed() throws Throwable {
    // 拦截器链执行完毕，调用目标方法
    if (this.currentInterceptorIndex == this.interceptorsAndDynamicMethodMatchers.size() - 1) {
        return invokeJoinpoint(); // 反射调用目标方法
    }
    
    // 获取下一个拦截器
    Object interceptorOrInterceptionAdvice =
        this.interceptorsAndDynamicMethodMatchers.get(++this.currentInterceptorIndex);
    
    // 调用拦截器
    return ((MethodInterceptor) interceptorOrInterceptionAdvice).invoke(this);
    // 注意：传入的是 this（当前 Invocation），拦截器内部会调用 invocation.proceed()
    // 从而形成递归调用链
}
```

```
执行过程（以 @Around + @Before + @After 为例）：

proceed()
  → AroundInterceptor.invoke(invocation)
    → // @Around 前半段
    → invocation.proceed()
      → MethodBeforeInterceptor.invoke(invocation)
        → // 执行 @Before
        → invocation.proceed()
          → AfterInterceptor.invoke(invocation)
            → try {
                invocation.proceed()
                  → invokeJoinpoint()  // 执行目标方法
              } finally {
                // 执行 @After
              }
        → // @Before 后续
      → // @Around 后半段（proceed 之后的代码）
```

---

## 五、事务原理

### 13. @Transactional 的底层原理？（源码级）

```
@Transactional 本质是 AOP 代理 + TransactionInterceptor

核心类关系：
  @EnableTransactionManagement
    → @Import(TransactionManagementConfigurationSelector)
    → 注册 ProxyTransactionManagementConfiguration
    → 注册 BeanFactoryTransactionAttributeSourceAdvisor（Advisor）
    → 包含 TransactionInterceptor（Advice）
    → 包含 TransactionAttributeSource（Pointcut 的一部分）

当 Bean 创建时，AbstractAutoProxyCreator 发现有 TransactionAdvisor 能匹配
→ 创建代理对象

调用流程：
  代理对象.method()
    → TransactionInterceptor.invoke(MethodInvocation)
    → TransactionAspectSupport.invokeWithinTransaction()

invokeWithinTransaction() 源码逻辑（简化）：

  // ① 获取事务属性
  TransactionAttribute txAttr = getTransactionAttributeSource()
      .getTransactionAttribute(method, targetClass);
  // 解析 @Transactional 的 propagation、isolation、rollbackFor 等

  // ② 获取事务管理器
  PlatformTransactionManager tm = determineTransactionManager(txAttr);
  // 通常是 DataSourceTransactionManager

  // ③ 根据传播行为，开启/加入/挂起事务
  TransactionInfo txInfo = createTransactionIfNecessary(tm, txAttr, joinpointId);
  // 内部调用 tm.getTransaction(txAttr)
  // → DataSourceTransactionManager.doBegin()
  // → 从 DataSource 获取 Connection
  // → connection.setAutoCommit(false)  ★ 关闭自动提交
  // → 将 Connection 绑定到 ThreadLocal（TransactionSynchronizationManager）

  Object retVal;
  try {
      // ④ 执行目标方法
      retVal = invocation.proceed();
  } catch (Throwable ex) {
      // ⑤ 异常处理
      completeTransactionAfterThrowing(txInfo, ex);
      // → 判断异常是否匹配 rollbackFor
      // → 匹配 → tm.rollback() → connection.rollback()
      // → 不匹配 → tm.commit() → connection.commit()
      throw ex;
  }
  
  // ⑥ 正常提交
  commitTransactionAfterReturning(txInfo);
  // → tm.commit() → connection.commit()
  
  return retVal;
```

---

### 14. 事务传播行为的源码实现？

```
核心方法：AbstractPlatformTransactionManager.getTransaction()

简化逻辑：

public TransactionStatus getTransaction(TransactionDefinition definition) {
    // 检查当前线程是否已有事务
    Object transaction = doGetTransaction();
    // → DataSourceTransactionManager.doGetTransaction()
    // → 从 ThreadLocal 中获取当前 Connection

    if (isExistingTransaction(transaction)) {
        // 已有事务 → 根据传播行为决定
        return handleExistingTransaction(definition, transaction);
        
        // REQUIRED     → 加入当前事务
        // REQUIRES_NEW → 挂起当前事务，新建事务
        // NESTED       → 创建 Savepoint（嵌套事务）
        // SUPPORTS     → 加入当前事务
        // NOT_SUPPORTED → 挂起当前事务，非事务运行
        // MANDATORY    → 加入当前事务
        // NEVER        → 抛异常！
    }
    
    // 没有事务
    // REQUIRED     → 新建事务
    // REQUIRES_NEW → 新建事务
    // NESTED       → 新建事务
    // SUPPORTS     → 非事务运行
    // NOT_SUPPORTED → 非事务运行
    // MANDATORY    → 抛异常！
    // NEVER        → 非事务运行
    
    if (definition.getPropagation() == REQUIRED ||
        definition.getPropagation() == REQUIRES_NEW ||
        definition.getPropagation() == NESTED) {
        // 新建事务
        doBegin(transaction, definition);
        // → connection.setAutoCommit(false)
    }
}
```

**REQUIRES_NEW 的"挂起"是怎么实现的？**

```
挂起 = 将当前事务的 Connection 从 ThreadLocal 解绑，暂存到 SuspendedResourcesHolder

  ① 当前事务 A 的 Connection_A 绑定在 ThreadLocal
  ② 遇到 REQUIRES_NEW → suspend(transaction)
     → 从 ThreadLocal 取出 Connection_A，暂存
  ③ 新建事务 B → 获取新的 Connection_B → 绑定到 ThreadLocal
  ④ 事务 B 执行完 → commit/rollback
  ⑤ resume() → 把 Connection_A 重新绑定到 ThreadLocal
  ⑥ 继续事务 A
```

---

### 15. @Transactional 失效的 7 种场景？（源码角度解释）

```
① 方法不是 public
   原因：Spring AOP 默认用 CGLIB 生成子类
        子类只能重写 public / protected 方法
        TransactionInterceptor 内部会检查方法可见性
   源码：AbstractFallbackTransactionAttributeSource.computeTransactionAttribute()
        → if (allowPublicMethodsOnly() && !Modifier.isPublic(method.getModifiers()))
             return null;  // 直接返回 null，不应用事务

② 自调用（this.method()）
   原因：this 指向原始对象，不是代理对象
        调用没有经过 TransactionInterceptor
   示例：
     @Service
     public class OrderService {
         public void createOrder() {
             this.saveOrder(); // ❌ 直接调用，事务不生效
         }
         @Transactional
         public void saveOrder() { ... }
     }
   解决方案：
     方案一：注入自身
       @Autowired @Lazy private OrderService self;
       self.saveOrder(); // ✅ 通过代理对象调用
     方案二：AopContext
       ((OrderService) AopContext.currentProxy()).saveOrder();
       需要配置 @EnableAspectJAutoProxy(exposeProxy = true)
     方案三：拆分到不同 Service

③ 异常被 catch 吞掉了
   原因：TransactionInterceptor 在 catch 块中判断是否回滚
        异常没抛出来 → 走正常 commit 逻辑
   解决：
     catch 后手动标记回滚：
     TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();

④ 抛出的是 checked 异常
   原因：默认 rollbackFor = {RuntimeException.class, Error.class}
        IOException 等 checked 异常不在回滚范围内
   源码：DefaultTransactionAttribute.rollbackOn(Throwable ex)
        → return (ex instanceof RuntimeException || ex instanceof Error)
   解决：@Transactional(rollbackFor = Exception.class)

⑤ 数据库引擎不支持事务
   原因：MyISAM 不支持事务，只有 InnoDB 支持

⑥ Bean 没被 Spring 管理
   原因：没有 @Service / @Component → 不会创建代理

⑦ 传播行为导致
   原因：SUPPORTS / NOT_SUPPORTED / NEVER 在没有外层事务时不开启事务
```

---

## 六、BeanPostProcessor 体系

### 16. BeanPostProcessor 能做什么？重要的实现类有哪些？

```
BeanPostProcessor 是 Spring 最核心的扩展机制
每个 Bean 创建时都会经过所有 BeanPostProcessor

接口定义：
  postProcessBeforeInitialization(bean, beanName)  // 初始化前
  postProcessAfterInitialization(bean, beanName)   // 初始化后

重要实现类：

┌────────────────────────────────────────┬──────────────────────────────┐
│ 实现类                                  │ 作用                          │
├────────────────────────────────────────┼──────────────────────────────┤
│ AutowiredAnnotationBeanPostProcessor   │ 处理 @Autowired / @Value 注入 │
│ CommonAnnotationBeanPostProcessor      │ 处理 @Resource / @PostConstruct│
│                                        │ / @PreDestroy                 │
│ ApplicationContextAwareProcessor       │ 处理各种 Aware 接口回调        │
│ AbstractAutoProxyCreator               │ AOP 代理创建                  │
│ (AnnotationAwareAspectJAutoProxyCreator)│                              │
│ AsyncAnnotationBeanPostProcessor       │ 处理 @Async 创建异步代理       │
│ ScheduledAnnotationBeanPostProcessor   │ 处理 @Scheduled 注册定时任务   │
└────────────────────────────────────────┴──────────────────────────────┘

一句话总结：
  Spring 几乎所有的"魔法"都是通过 BeanPostProcessor 实现的
  @Autowired、@PostConstruct、AOP、@Async、@Scheduled 等功能
  本质上都是不同的 BeanPostProcessor 在 Bean 生命周期中做了不同的事
```

---

### 17. BeanFactoryPostProcessor 和 BeanPostProcessor 的区别？

```
                    BeanFactoryPostProcessor        BeanPostProcessor
执行时机            BeanDefinition 加载完毕后         每个 Bean 实例化后
                    Bean 实例化之前                   初始化前后
操作对象            BeanDefinition（设计图）          Bean 实例（产品）
执行次数            只执行一次                        每个 Bean 都执行
典型实现            ConfigurationClassPostProcessor  AutowiredAnnotationBeanPostProcessor
                    PropertySourcesPlaceholderConfigurer  AbstractAutoProxyCreator

类比：
  BeanFactoryPostProcessor → 修改建筑图纸（可以改类名、改属性、改作用域）
  BeanPostProcessor → 对建好的房子做装修（注入属性、创建代理、注册回调）
```

---

## 七、面试回答模板

```
面试官："你读过 Spring 哪些源码？"

推荐回答（可按以下三块来组织）：

"我比较深入看过三部分源码：

【Bean 生命周期】
从 AbstractApplicationContext.refresh() 入口开始，重点看了
createBean → doCreateBean 这条线。理解了 Bean 从实例化到初始化的完整过程：
createBeanInstance 反射创建对象 → populateBean 属性填充（@Autowired 在这里由
AutowiredAnnotationBeanPostProcessor 处理）→ initializeBean 初始化（@PostConstruct
在 BeanPostProcessor.before 阶段处理，AOP 代理在 BeanPostProcessor.after 阶段
由 AbstractAutoProxyCreator 创建）。

【循环依赖】
看了 DefaultSingletonBeanRegistry 的三级缓存实现。理解了为什么需要第三级缓存
而不是两级——关键是为了延迟 AOP 代理的创建。三级缓存存的是 ObjectFactory，
只有当 Bean 真正被其他 Bean 引用时才调用，这时才判断是否需要创建代理，
既保证了循环依赖的解决，又保证了代理对象的单一性。

【事务】
看了 TransactionInterceptor 的 invokeWithinTransaction 方法。理解了事务的开启
本质上是 connection.setAutoCommit(false)，Connection 绑定在 ThreadLocal 中，
同一个线程的数据库操作共用一个 Connection 就实现了事务。也理解了为什么自调用
会导致事务失效——因为 this 指向原始对象绕过了 TransactionInterceptor。
REQUIRES_NEW 的实现是将当前 Connection 从 ThreadLocal 解绑暂存，新建另一个
Connection 绑定进去。"
```


---

# 二十九、JDK 动态代理与 Spring AOP

---

## 一、JDK 动态代理

### 1. JDK 动态代理的原理？

```
通过 Proxy.newProxyInstance() 在运行时生成一个实现了目标接口的代理类。

三个参数：
  ClassLoader loader         → 类加载器
  Class<?>[] interfaces      → 代理类要实现的接口（决定有哪些方法）
  InvocationHandler handler  → 所有方法调用转发到 handler.invoke()

运行时生成的代理类（伪代码）：
  public class $Proxy0 extends Proxy implements UserService {
      public String findUser(Long id) {
          return (String) handler.invoke(this, findUserMethod, new Object[]{id});
      }
  }

核心限制：只能代理接口
  因为代理类已经 extends Proxy，Java 单继承 → 只能通过 implements 接口代理

应用：
  ① MyBatis Mapper 接口 → MapperProxy
  ② Spring AOP（有接口时）→ JdkDynamicAopProxy
  ③ RPC 框架（Dubbo / Feign）→ 拦截方法调用发网络请求
```

### 2. JDK 动态代理 vs CGLIB？

```
                    JDK 动态代理              CGLIB
原理             实现接口                   继承目标类（生成子类）
要求             必须有接口                  不能是 final 类/方法
生成方式          Proxy.newProxyInstance     Enhancer.create
调用目标方法      method.invoke(target)      methodProxy.invokeSuper()
性能（创建）      快                         慢（生成子类字节码）
性能（调用）      反射调用                    FastClass 直接调用
Spring 选择      有接口时默认用这个           无接口时用这个
Spring Boot 2.x  -                         默认全用 CGLIB
```

## 二、Spring AOP 实现原理

### 1. AOP 代理对象什么时候创建的？

```
Bean 生命周期中，在初始化阶段的 BeanPostProcessor.postProcessAfterInitialization

调用链：
  initializeBean()
  → applyBeanPostProcessorsAfterInitialization()
  → AbstractAutoProxyCreator.postProcessAfterInitialization()  ★
    → wrapIfNecessary(bean, beanName)
      → getAdvicesAndAdvisorsForBean()   // 找匹配的切面
      → createProxy()                    // 创建代理
        → ProxyFactory.getProxy()
          → JdkDynamicAopProxy 或 CglibAopProxy

容器中最终存的是代理对象，不是原始对象
```

### 2. 为什么自调用 AOP 不生效？

```
@Service
public class OrderService {
    @Transactional
    public void createOrder() { ... }
    
    public void batchCreate() {
        this.createOrder(); // 自调用 → AOP 不生效！
    }
}

原因：this 指向原始对象，不是代理对象
     调用没有经过代理 → 不走拦截器链 → @Transactional 无效

解决方案：
  ① 注入自己：@Autowired OrderService self; self.createOrder();
  ② 从容器获取：ApplicationContext.getBean(OrderService.class).createOrder();
  ③ AopContext：((OrderService) AopContext.currentProxy()).createOrder();
```


---

# 三十、Spring Boot 自动装配与接口安全

---

## 一、Spring Boot 自动装配原理

```
@SpringBootApplication
  └── @EnableAutoConfiguration
        └── @Import(AutoConfigurationImportSelector.class)

启动时：
① AutoConfigurationImportSelector 读取 META-INF/spring.factories
   （Spring Boot 3.x 改为 META-INF/spring/...AutoConfiguration.imports）

② 文件里列了所有自动配置类：
   RedisAutoConfiguration
   DataSourceAutoConfiguration
   ...（几百个）

③ 每个配置类上有条件注解：
   @ConditionalOnClass(RedisOperations.class)    ← classpath 有这个类才生效
   @ConditionalOnMissingBean(RedisTemplate.class) ← 你没手动配才自动配

④ 条件满足 → 自动创建并注册 Bean

示例：你引入 spring-boot-starter-data-redis 依赖
  → classpath 有 RedisOperations.class
  → RedisAutoConfiguration 生效
  → 自动创建 RedisTemplate Bean
  → 你 @Autowired RedisTemplate 直接用

核心思想：约定大于配置，开箱即用
```

## 二、@ConfigurationProperties 原理

```
把配置文件中指定前缀的属性，自动映射到类的字段上。

@ConfigurationProperties(prefix = "spring.redis")
public class RedisProperties {
    private String host;      // ← spring.redis.host
    private int port;         // ← spring.redis.port
    private String password;  // ← spring.redis.password
}

和 @Value 的对比：
  @Value：逐个绑定，适合 1-2 个值
  @ConfigurationProperties：按前缀批量绑定，适合一组配置

支持松散绑定：
  max-pool-size / maxPoolSize / max_pool_size / MAX_POOL_SIZE
  都能绑定到 maxPoolSize 字段
```

## 三、防接口篡改

```
核心方案：参数签名（Sign）

客户端：
  ① 所有参数按 key 字母排序拼接
  ② 拼上双方约定的密钥（Secret Key）
  ③ SHA256 哈希生成签名 sign
  ④ sign 放到请求中一起发送

  排序拼接：amount=100&orderId=ABC123&userId=1
  加密钥：  amount=100&orderId=ABC123&userId=1&key=my_secret
  签名：    sign = SHA256("amount=100&orderId=ABC123&userId=1&key=my_secret")

服务端：
  ① 用同样的规则对参数排序拼接 + 密钥
  ② 算出签名，和客户端传来的 sign 对比
  ③ 一致 → 没被篡改；不一致 → 被篡改了

完整防护体系：
  防篡改：参数签名（Sign）          → 改了参数签名对不上
  防重放：时间戳（Timestamp）        → 过期请求拒绝（5分钟有效期）
  防重复：随机串（Nonce）            → Redis 存 5 分钟去重
  防窃听：HTTPS                     → 传输加密
  防伪造：Token 身份认证             → 确认调用者身份
```

## 四、金融金额用什么类型？

```
用 BigDecimal，不能用 float / double。

float/double 是 IEEE 754 浮点数，0.1 在二进制中无限循环 → 精度丢失
  System.out.println(0.1 + 0.2); // 0.30000000000000004

BigDecimal 注意事项：
  ① 创建用字符串：new BigDecimal("0.1")，不要 new BigDecimal(0.1)
  ② 除法必须指定精度：divide(x, 2, RoundingMode.HALF_UP)
  ③ 比较用 compareTo：不要用 equals（精度不同判不等）
  ④ 不可变对象：a.add(b) 不会改变 a，要接收返回值

数据库对应类型：DECIMAL(10, 2) / NUMBER(10, 2) / NUMERIC(10, 2)
```

