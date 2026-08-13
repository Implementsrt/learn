import { viteBundler } from "@vuepress/bundler-vite";
import { defineUserConfig } from "vuepress";
import { privateContentPatterns } from "./private-content.js";
import theme from "./theme.js";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/").at(-1);
const isProjectPages =
  process.env.GITHUB_ACTIONS === "true" &&
  repositoryName !== undefined &&
  !repositoryName.endsWith(".github.io");

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
