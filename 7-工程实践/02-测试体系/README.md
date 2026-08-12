# 02 - 测试体系

## 学习目标
- 建立分层测试金字塔
- 掌握主流测试框架
- 让测试成为开发的加速器而非负担

## 核心知识点
### 测试金字塔
```
        ┌────┐
        │ E2E │        少量（慢、贵）
       ┌┴─────┴┐
       │ 集成测试 │    适量
      ┌┴────────┴┐
      │  单元测试  │   大量（快、便宜）
      └──────────┘
```

### 单元测试
- **JUnit 5**：`@Test` / `@ParameterizedTest` / `@Nested`
- **AssertJ / Hamcrest**：流畅断言
- **Mockito**：Mock/Stub/Spy、`@InjectMocks`
- **PowerMock**（慎用）：Mock静态/final
- **覆盖率**：JaCoCo（关注分支覆盖率）

### 集成测试
- **Spring Boot Test**：`@SpringBootTest`
- **`@DataJpaTest`** / **`@WebMvcTest`**（切片测试）
- **Testcontainers**（Docker化依赖，真实数据库/MQ）
- **WireMock**（Mock HTTP）

### 契约测试
- **Spring Cloud Contract**
- **Pact**
- 生产者/消费者契约

### 端到端测试
- **Selenium**（Web）
- **Cypress / Playwright**（现代首选）
- **RestAssured**（API）

### 性能测试
- **JMH**（微基准测试）
- **JMeter / Gatling / wrk**

### 混沌工程
- **ChaosBlade**（阿里）
- **Chaos Mesh**（K8s原生）
- 故障注入：网络延迟、CPU满载、节点宕机

### TDD / BDD
- **TDD**：红→绿→重构
- **BDD**：Given-When-Then、Cucumber

## 测试设计
### 好的测试
- **F.I.R.S.T**：Fast / Independent / Repeatable / Self-Validating / Timely
- **3A 结构**：Arrange / Act / Assert
- **单一断言**、**边界用例**
- **可读的测试名**（describe行为）

### 测试反模式
- 测试私有方法
- 一个测试多个断言
- 依赖执行顺序
- 依赖外部环境

## 实战任务
- [ ] 给现有业务代码补充到 **80% 单元测试覆盖率**
- [ ] 用 Testcontainers 替代 H2 做集成测试
- [ ] 搭建 Chaos Mesh 做一次故障演练
- [ ] 实现 Contract Test（生产者-消费者）

## 参考资料
- 《Effective Unit Testing》
- 《测试驱动开发》Kent Beck
- 《xUnit Test Patterns》
- Testcontainers 官方文档

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
