import { viteBundler } from "@vuepress/bundler-vite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1);
const isProjectPages =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName !== undefined &&
  !repositoryName.endsWith(".github.io");

type PrivateContentManifest = {
  privatePaths?: string[];
};

const localPrivateManifestPath = join(process.cwd(), ".private-content.json");
const localPrivateContentPatterns = existsSync(localPrivateManifestPath)
  ? (JSON.parse(
      readFileSync(localPrivateManifestPath, "utf8")
    ) as PrivateContentManifest).privatePaths?.map((path) => `!${path}`) ?? []
  : [];

const legacyPrivateContentPatterns = [
  "!2-Java高级/01-反射与字节码/2026-05-05-*.md",
  "!3-Java框架/04-ORM与数据访问/2026-05-05-*.md",
  "!3-Java框架/05-常用中间件/2026-05-05-*.md",
  "!4-架构设计/03-高可用与高并发/2026-05-05-*.md",
  "!4-架构设计/04-数据一致性/2026-05-05-*.md",
  "!5-性能优化/02-数据库优化/2026-05-05-*.md",
  "!5-性能优化/03-缓存策略/2026-05-05-*.md",
  "!7-工程实践/01-代码质量/2026-05-05-*.md",
  "!8-面试与总结/02-项目复盘/2026-05-05-*.md"
];

const privateContentPatterns = [
  "!0-简历/**",
  "!简历强化/**",
  "!AGENTS.md",
  "!私有资料审计清单.md",
  "!.agent/**",
  "!.agents/**",
  "!.obsidian/**",
  ...legacyPrivateContentPatterns,
  ...localPrivateContentPatterns
];

export default defineUserConfig({
  base: isProjectPages ? `/${repositoryName}/` : "/",
  lang: "zh-CN",
  title: "Java 架构学习笔记",
  description: "面向 Java 架构能力的公开技术学习笔记。",
  dest: ".vuepress/dist",
  bundler: viteBundler(),
  theme,
  pagePatterns: ["**/*.md", ...privateContentPatterns]
});
