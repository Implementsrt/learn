import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type PrivateContentManifest = {
  privatePaths?: string[];
};

const root = process.cwd();
const localPrivateManifestPath = join(root, ".private-content.json");
const localPrivateArticlePaths = new Set(
  existsSync(localPrivateManifestPath)
    ? (JSON.parse(readFileSync(localPrivateManifestPath, "utf8")) as PrivateContentManifest)
        .privatePaths ?? []
    : []
);

const legacyPrivateArticlePatterns = [
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

export const privateContentPatterns = [
  "!0-简历/**",
  "!简历强化/**",
  "!AGENTS.md",
  "!私有资料审计清单.md",
  "!.agent/**",
  "!.agents/**",
  "!.obsidian/**",
  ...legacyPrivateArticlePatterns,
  ...[...localPrivateArticlePaths].map((path) => `!${path}`)
];

export const getRelativePath = (filePath: string) =>
  relative(root, filePath).replaceAll("\\", "/");

export const isPublicArticle = (filePath: string) => {
  const path = getRelativePath(filePath);

  return (
    !localPrivateArticlePaths.has(path) &&
    !legacyPrivateArticlePatterns.some((pattern) => {
      const matcher = new RegExp(
        `^${pattern.slice(1).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace("\\*", ".+")}$`,
        "u"
      );

      return matcher.test(path);
    })
  );
};
