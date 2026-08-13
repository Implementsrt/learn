import { viteBundler } from "@vuepress/bundler-vite";
import { defineUserConfig } from "vuepress";
import { privateContentPatterns } from "./private-content.js";
import theme from "./theme.js";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1);
const isProjectPages =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName !== undefined &&
  !repositoryName.endsWith(".github.io");

// 开发服务按进程隔离临时目录，避免多个 VuePress 进程互相清理 SlimSearch 索引。
const developmentSuffix = process.env.NODE_ENV === "development" ? `-${process.pid}` : "";
const tempDirectory = `.vuepress/.temp${developmentSuffix}`;
const cacheDirectory = `.vuepress/.cache${developmentSuffix}`;

export default defineUserConfig({
  base: isProjectPages ? `/${repositoryName}/` : "/",
  lang: "zh-CN",
  title: "Java 架构学习笔记",
  description: "面向 Java 架构能力的公开技术学习笔记。",
  head: [["link", { rel: "icon", href: "/logo.png" }]],
  dest: ".vuepress/dist",
  temp: tempDirectory,
  cache: cacheDirectory,
  bundler: viteBundler(),
  theme,
  pagePatterns: ["**/*.md", ...privateContentPatterns]
});
