import { existsSync, readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { getRelativePath, isPublicArticle } from "./private-content.js";

type NavbarArticle = {
  text: string;
  link: string;
};

type NavbarDirectory = {
  text: string;
  children: NavbarArticle[];
};

type NavbarGroup = {
  text: string;
  link: string;
  children: NavbarDirectory[];
};

const root = process.cwd();

const publicTopLevelDirectories = [
  "1-Java基础",
  "2-Java高级",
  "3-Java框架",
  "4-架构设计",
  "5-性能优化",
  "6-DevOps与云原生",
  "7-工程实践",
  "8-面试与总结",
  "99-业务场景实践题"
];

const stripOrderPrefix = (value: string) => value.replace(/^\d+-/u, "");
const stripDatePrefix = (value: string) => value.replace(/^\d{4}-\d{2}-\d{2}-/u, "");

// 数字前缀表达本地编排顺序；同级目录统一排在文章前面。
const compareLocalNames = (left: string, right: string) =>
  left.localeCompare(right, "zh-CN", {
    numeric: true,
    sensitivity: "base"
  });

const compareDirectoryEntries = (left: Dirent, right: Dirent) => {
  if (left.isDirectory() !== right.isDirectory()) {
    return left.isDirectory() ? -1 : 1;
  }

  return compareLocalNames(left.name, right.name);
};

const decodeTitle = (filePath: string) => {
  const source = readFileSync(filePath, "utf8");
  const title = source.match(/^#\s+(.+)$/mu)?.[1]?.trim();

  return title ?? stripDatePrefix(filePath.split(/[\\/]/u).at(-1)?.replace(/\.md$/u, "") ?? "");
};

const toRoute = (filePath: string) => {
  const path = getRelativePath(filePath);

  if (path.endsWith("/README.md")) {
    return `/${path.slice(0, -"README.md".length)}`;
  }

  return `/${path.replace(/\.md$/u, ".html")}`;
};

const readArticles = (directoryPath: string): NavbarArticle[] =>
  readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .sort((left, right) => compareLocalNames(left.name, right.name))
    .filter((entry) => isPublicArticle(join(directoryPath, entry.name)))
    .map((entry) => {
      const filePath = join(directoryPath, entry.name);

      return {
        text: decodeTitle(filePath),
        link: toRoute(filePath)
      };
    });

const readDirectories = (topLevelDirectory: string): NavbarDirectory[] => {
  const directoryPath = join(root, topLevelDirectory);

  const nestedDirectories = readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort(compareDirectoryEntries);

  const directories = nestedDirectories.map((entry) => {
    const nestedPath = join(directoryPath, entry.name);

    return {
      text: stripOrderPrefix(entry.name),
      children: readArticles(nestedPath)
    };
  });

  const topLevelArticles = readArticles(directoryPath);

  if (topLevelArticles.length > 0) {
    directories.push({
      text: "专题文章",
      children: topLevelArticles
    });
  }

  return directories;
};

export const publicNavbarGroups: NavbarGroup[] = publicTopLevelDirectories
  .filter((directory) => existsSync(join(root, directory)))
  .map((directory) => ({
    text: stripOrderPrefix(directory),
    link: `/${directory}/`,
    children: readDirectories(directory)
  }));
