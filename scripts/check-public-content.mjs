import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const artifactIndex = process.argv.indexOf("--artifact");
const artifactDirectory = artifactIndex === -1 ? null : process.argv[artifactIndex + 1];

const basePrivatePaths = [
  "0-简历/",
  "简历强化/",
  "AGENTS.md",
  ".agent/",
  ".agents/",
  ".obsidian/",
  ".private-content.json",
  "私有资料审计清单.md",
  "99-业务场景实践题/简历项目复盘/",
  "99-业务场景实践题/README.md"
];

const legacyPrivatePathPatterns = [
  "8-面试与总结/01-高频面试题/面试角色交互模式提示词.md"
];

const manifestPath = join(root, ".private-content.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : {};
const manifestPrivatePaths = Array.isArray(manifest.privatePaths) ? manifest.privatePaths : [];
const privatePaths = [...basePrivatePaths, ...manifestPrivatePaths];
const allPrivatePathsIncludingLegacy = [...privatePaths, ...legacyPrivatePathPatterns];

const publicForbiddenText = [
  "简历",
  "来源**：简历",
  "来源：简历"
];
const localForbiddenText = Array.isArray(manifest.forbiddenText)
  ? manifest.forbiddenText
  : [];
const forbiddenText = [...publicForbiddenText, ...localForbiddenText];

const normalize = (file) => file.replaceAll("\\", "/");

const listFiles = (directory) => {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
};

const trackedFiles = () =>
  execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .map(normalize);

const commits = () =>
  execFileSync("git", ["rev-list", "--all"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(Boolean);

const isPrivatePath = (file) =>
  privatePaths.some((privatePath) =>
    privatePath.endsWith("/") ? file.startsWith(privatePath) : file === privatePath
  ) || legacyPrivatePathPatterns.some((legacyPath) =>
    legacyPath.endsWith("/") ? file.startsWith(legacyPath) : file === legacyPath
  );

const scanText = (files) => {
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, "utf8");

    for (const token of forbiddenText) {
      if (content.includes(token)) {
        violations.push(`${normalize(relative(root, file))}: contains forbidden token \"${token}\"`);
      }
    }
  }

  return violations;
};

// Scan every reachable commit so deleting a private note from the working tree
// cannot hide an earlier leak in the public repository history.
const scanHistoryText = () => {
  const violations = [];

  for (const commit of commits()) {
    try {
      const output = execFileSync(
        "git",
        [
          "grep",
          "-I",
          "-n",
          "-F",
          ...forbiddenText.flatMap((token) => ["-e", token]),
          commit,
          "--",
          "*.md",
          "*.html"
        ],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      );

      if (output.trim()) {
        const matches = output
          .trim()
          .split(/\r?\n/u)
          .filter((line) => {
            // Extract file path from git grep output format: commit:"path":linenum:content
            const match = line.match(/^[^:]+:"([^"]+)":/);
            if (!match) return true;

            // Decode octal escape sequences: git outputs UTF-8 bytes as \344\270\232
            // Convert octal sequences to bytes, then decode as UTF-8
            let rawPath = match[1];
            if (rawPath.includes('\\')) {
              const bytes = [];
              let i = 0;
              while (i < rawPath.length) {
                if (rawPath[i] === '\\' && /\d{3}/.test(rawPath.slice(i + 1, i + 4))) {
                  bytes.push(parseInt(rawPath.slice(i + 1, i + 4), 8));
                  i += 4;
                } else {
                  bytes.push(rawPath.charCodeAt(i));
                  i++;
                }
              }
              rawPath = Buffer.from(bytes).toString('utf8');
            }
            const filePath = normalize(rawPath);

            // Skip if the file is now in a private path (including legacy paths)
            const shouldFilter = allPrivatePathsIncludingLegacy.some((privatePath) => {
              const normalizedPrivatePath = normalize(privatePath);
              return filePath === normalizedPrivatePath || filePath.startsWith(normalizedPrivatePath);
            });

            return !shouldFilter;
          })
          .map((line) => `history ${commit.slice(0, 12)}: ${line}`);

        violations.push(...matches);
      }
    } catch (error) {
      if (error.status !== 1) {
        const detail = error.stderr?.toString().trim() ?? "unknown git grep error";
        violations.push(`history ${commit.slice(0, 12)}: scan failed: ${detail}`);
      }
    }
  }

  return violations;
};

const validateSourceConfiguration = () => {
  const violations = [];
  const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
  const config = readFileSync(join(root, ".vuepress", "config.ts"), "utf8");
  const privateContent = readFileSync(join(root, ".vuepress", "private-content.ts"), "utf8");
  const guardScript = readFileSync(join(root, "scripts", "check-public-content.mjs"), "utf8");

  if (
    !config.includes('import { privateContentPatterns }') ||
    !config.includes('pagePatterns: ["**/*.md", ...privateContentPatterns]')
  ) {
    violations.push(".vuepress/config.ts: must use the shared private content patterns");
  }

  if (!privateContent.includes(".private-content.json") || !privateContent.includes("localPrivateArticlePaths")) {
    violations.push(".vuepress/private-content.ts: missing local private manifest loading");
  }

  if (!guardScript.includes("scanHistoryText")) {
    violations.push("scripts/check-public-content.mjs: missing reachable history scan");
  }

  for (const pagePattern of [
    "!0-简历/**",
    "!简历强化/**",
    "!AGENTS.md",
    "!私有资料审计清单.md",
    "!.agent/**",
    "!.agents/**",
    "!.obsidian/**"
  ]) {
    if (!privateContent.includes(pagePattern)) {
      violations.push(`.vuepress/private-content.ts: missing ${pagePattern}`);
    }
  }

  for (const privatePath of basePrivatePaths) {
    const ignoreRule = `/${privatePath}`;

    if (!gitignore.includes(ignoreRule)) {
      violations.push(`.gitignore: missing ${ignoreRule}`);
    }
  }

  for (const privatePath of manifestPrivatePaths) {
    try {
      execFileSync("git", ["check-ignore", "-q", "--", privatePath], {
        cwd: root,
        stdio: "ignore"
      });
    } catch {
      violations.push(`.gitignore: does not ignore a local manifest entry`);
      break;
    }
  }

  for (const pattern of [
    "/99-业务场景实践题/简历项目复盘/",
    "/99-业务场景实践题/README.md"
  ]) {
    if (!gitignore.includes(pattern)) {
      violations.push(`.gitignore: missing ${pattern}`);
    }
  }

  return violations;
};

if (artifactDirectory !== null) {
  const artifactPath = join(root, artifactDirectory);

  if (!existsSync(artifactPath)) {
    throw new Error(`Generated artifact does not exist: ${artifactDirectory}`);
  }

  const violations = scanText(listFiles(artifactPath));

  if (violations.length > 0) {
    console.error("Public artifact guard failed:");
    console.error(violations.join("\n"));
    process.exit(1);
  }

  console.log(`Public artifact guard passed: ${artifactDirectory}`);
} else {
  const files = trackedFiles();
  const pathViolations = files
    .filter(isPrivatePath)
    .map((file) => `${file}: private path is tracked`);
  const textFiles = files
    .filter((file) => /\.(?:md|html)$/u.test(file) && existsSync(join(root, file)))
    .map((file) => join(root, file));
  const violations = [
    ...validateSourceConfiguration(),
    ...pathViolations,
    ...scanText(textFiles),
    ...scanHistoryText()
  ];

  if (violations.length > 0) {
    console.error("Public source guard failed:");
    console.error(violations.join("\n"));
    process.exit(1);
  }

  console.log(`Public source guard passed: ${files.length} tracked files and ${commits().length} commits checked`);
}
