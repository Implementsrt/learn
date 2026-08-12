# 01 - 代码质量

## 学习目标
- 写出整洁、可维护、可扩展的代码
- 建立团队代码质量标准
- 主导有效的 Code Review

## 核心知识点
### Clean Code 原则
- **命名**：见名知意、避免缩写、使用领域术语
- **函数**：单一职责、参数≤3、避免副作用
- **注释**：解释"为什么"而非"是什么"
- **错误处理**：抛异常 > 返回错误码
- **不要重复自己**（DRY）
- **YAGNI**：不要过度设计
- **KISS**：保持简单

### SOLID 原则
- **S**ingle Responsibility（单一职责）
- **O**pen/Closed（开闭原则）
- **L**iskov Substitution（里氏替换）
- **I**nterface Segregation（接口隔离）
- **D**ependency Inversion（依赖倒置）

### 代码坏味道（22种）
- 重复代码、过长函数、过大类
- 过长参数列表、发散式变化、霰弹式修改
- 依恋情结、数据泥团、基本类型偏执
- switch惊悚现身、平行继承体系、冗赘类
- 夸夸其谈未来性、临时字段、过度耦合的消息链
- 中间人、狎昵关系、异曲同工的类
- 不完美的库类、纯数据类、被拒绝的馈赠
- 过多的注释、神秘命名

### 重构手法
- **提炼函数**（Extract Method）
- **内联函数**（Inline Method）
- **搬移函数**（Move Method）
- **以查询取代临时变量**
- **引入参数对象**
- **用多态取代条件表达式**
- **用卫语句取代嵌套条件**

### 代码质量工具
- **SonarQube**：质量门禁
- **Checkstyle**：格式规范
- **PMD**：潜在问题
- **SpotBugs**：Bug检测
- **ArchUnit**：架构规则校验

### Code Review 最佳实践
- **Review清单**：功能/设计/性能/安全/可读性/测试
- **小批量 PR**（<400行）
- **及时 Review**（24小时内）
- **对事不对人**、给建议不给命令
- **Pull Request 模板**

## 实战任务
- [ ] 用 ArchUnit 定义项目架构规则（如：controller不能直接调dao）
- [ ] SonarQube 集成到 CI，设置质量门禁
- [ ] 对团队一段"祖传代码"进行重构（含测试保护）
- [ ] 制定团队 **Code Review Checklist**

## 参考资料
- 《Clean Code》Robert Martin ★★★★★
- 《重构》Martin Fowler ★★★★★
- 《Effective Java》
- 《代码整洁之道：程序员的职业素养》
- Google Engineering Practices

## 学习笔记
<!-- 按 YYYY-MM-DD-主题.md 格式在本目录创建笔记 -->
