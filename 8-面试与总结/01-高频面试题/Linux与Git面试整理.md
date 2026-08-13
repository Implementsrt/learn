# 二十一、Linux 常用命令（面试常问）

```bash
# 文件操作
ls -la                     # 列出所有文件（含隐藏）
cat / less / tail / head   # 查看文件
tail -f app.log            # 实时跟踪日志
tail -n 100 app.log        # 查看最后 100 行
grep "ERROR" app.log       # 搜索关键字
grep -n "ERROR" app.log    # 带行号
grep -C 5 "ERROR" app.log  # 上下文各 5 行
find / -name "*.log"       # 查找文件
wc -l file.txt             # 统计行数

# 进程
ps -ef | grep java         # 查看 Java 进程
ps aux --sort=-%mem         # 按内存排序
top                         # 实时监控（按 P 按 CPU 排序，按 M 按内存排序）
kill -9 PID                 # 强制杀进程
kill -15 PID                # 优雅停止
nohup java -jar app.jar &  # 后台运行

# 网络
netstat -tlnp               # 查看端口占用
ss -tlnp                    # 同上（更快）
curl http://localhost:8080   # HTTP 请求
ping / telnet / traceroute  # 网络诊断
lsof -i:8080                # 查看占用 8080 端口的进程

# 磁盘
df -h                       # 磁盘使用率
du -sh *                    # 当前目录各文件/文件夹大小
du -sh /var/log             # 指定目录大小

# 系统
free -h                     # 内存使用
uptime                      # 运行时间和负载
uname -a                    # 系统信息

# 日志排查组合技
# 查找某个时间段的错误日志
grep "2026-04-12 06:" app.log | grep "ERROR"

# 统计某个接口的调用次数
grep "/api/users" access.log | wc -l

# 统计各 HTTP 状态码出现次数
awk '{print $9}' access.log | sort | uniq -c | sort -rn

# 查看 TCP 连接状态统计
netstat -an | awk '{print $6}' | sort | uniq -c | sort -rn
```


---

# 二十二、Git 常用操作

```bash
# 基础操作
git init                    # 初始化
git clone <url>             # 克隆
git add .                   # 暂存所有
git commit -m "msg"         # 提交
git push origin main        # 推送
git pull origin main        # 拉取

# 分支
git branch                  # 查看分支
git branch feature-xxx      # 创建分支
git checkout feature-xxx    # 切换分支
git checkout -b feature-xxx # 创建并切换
git merge feature-xxx       # 合并分支
git branch -d feature-xxx   # 删除分支

# 常用场景
git stash                   # 暂存当前修改（切分支前）
git stash pop               # 恢复暂存
git log --oneline -10       # 查看最近 10 条提交
git diff                    # 查看未暂存的修改
git reset --soft HEAD~1     # 撤销上一次提交（保留代码）
git reset --hard HEAD~1     # 撤销上一次提交（丢弃代码！）
git revert <commit-hash>    # 生成一个新提交来撤销某次提交（安全）
git cherry-pick <commit>    # 将某个提交应用到当前分支

# Git 工作流（面试常问）
主流工作流：Git Flow
  main         生产分支
  develop      开发分支
  feature/*    功能分支（从 develop 拉，合并回 develop）
  release/*    预发布分支
  hotfix/*     紧急修复分支（从 main 拉，合并回 main + develop）
```

