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
  "!99-业务场景实践题/简历项目复盘/**"
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
