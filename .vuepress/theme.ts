import { hopeTheme } from "vuepress-theme-hope";
import { publicNavbarGroups } from "./navbar.js";

export default hopeTheme({
  navbar: [
    { text: "首页", link: "/" },
    { text: "学习路线", link: "/学习路线图.html" },
    ...publicNavbarGroups,
    { text: "发布规范", link: "/发布与脱敏规则.html" }
  ],
  sidebar: "structure",
  footer: "公开技术学习笔记",
  displayFooter: true,
  darkmode: "switch",
  markdown: {
    gfm: true,
    mark: true,
    plantuml: true,
    tasklist: true
  },
  plugins: {
    slimsearch: {
      indexContent: true
    }
  }
});
