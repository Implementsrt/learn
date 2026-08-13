# 01 - Spring核心

## 学习目标
- 源码级掌握 IoC/AOP/事务 三大核心
- 熟悉 Spring 全部扩展点
- 能手写 Mini-Spring

## 核心知识点
### IoC 容器
- **BeanFactory vs ApplicationContext**
- **Bean生命周期**（12步完整流程）
- **三级缓存**解决循环依赖
  - `singletonObjects` / `earlySingletonObjects` / `singletonFactories`
  - 为什么需要三级？二级可以吗？
- **BeanDefinition** 与 BD 解析
- **`@Autowired` vs `@Resource`**
- **`FactoryBean` vs `BeanFactory`**

### AOP
- **JDK动态代理 vs CGLIB**
- **切点表达式**：execution/within/annotation
- **通知类型**：Before/After/Around/AfterReturning/AfterThrowing
- **AOP 失效场景**（内部方法调用、final、static）
- **AutoProxyCreator** 源码

### 事务
- **传播行为** 7 种
- **隔离级别**
- **事务失效**（方法非public、自调用、异常被吞、非Spring管理）
- `TransactionSynchronizationManager`

### 扩展点（面试高频）
- `BeanFactoryPostProcessor`
- `BeanPostProcessor`
- `ImportSelector` / `ImportBeanDefinitionRegistrar`
- `@Import`、`@Conditional`
- `ApplicationContextAware` 等 Aware 接口
- `SmartInitializingSingleton`
- `ApplicationListener` 事件机制

### SpringMVC
- `DispatcherServlet` 9 大组件
- `HandlerMapping` → `HandlerAdapter` → `ViewResolver`
- 参数解析、返回值处理
- 拦截器 vs 过滤器

### Spring Security
- Servlet Filter 安全链
- 认证与授权核心组件
- `SecurityContext` 与上下文传播
- URL 权限、方法权限、401/403

## 实战任务
- [ ] 手写 **Mini-Spring**（IoC + AOP + MVC）
- [ ] 复现 3 个事务失效场景并给出解决方案
- [ ] 研究 Spring Boot 为什么默认 CGLIB 代理
- [ ] 基于 BeanPostProcessor 实现自定义注解处理

## 重要源码
- `AbstractApplicationContext#refresh`（12 步启动）
- `AbstractAutowireCapableBeanFactory#doCreateBean`
- `DefaultSingletonBeanRegistry#getSingleton`
- `AbstractAutoProxyCreator#postProcessAfterInitialization`

## 参考资料
- 《Spring源码深度解析》
- 《Spring技术内幕》
- Spring Framework 官方文档
- 小马哥 Spring 视频

## 学习笔记

- [2026-06-24-Spring-AOP代理链.md](2026-06-24-Spring-AOP代理链.md)
- [2026-06-24-Spring-Bean生命周期.md](2026-06-24-Spring-Bean生命周期.md)
- [2026-06-24-Spring三级缓存与循环依赖.md](2026-06-24-Spring三级缓存与循环依赖.md)
- [2026-08-14-Spring事务原理与失效场景.md](2026-08-14-Spring事务原理与失效场景.md)
- [2026-07-03-Spring-MVC核心流程与原理.md](2026-07-03-Spring-MVC核心流程与原理.md)
- [2026-07-21-Spring-Security基本组件与核心原理.md](2026-07-21-Spring-Security基本组件与核心原理.md)
