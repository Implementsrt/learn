import { hopeTheme } from "vuepress-theme-hope";
import type { SidebarInfo } from "vuepress-theme-hope";
import { publicNavbarGroups } from "./navbar.js";

const getSidebarName = (info: SidebarInfo) =>
  info.type === "dir" ? info.dirname : info.filename;

// 侧栏沿用文件系统的数字编排，并保证同级目录先于文档。
const compareSidebarInfo = (left: SidebarInfo, right: SidebarInfo) => {
  if (left.type !== right.type) {
    return left.type === "dir" ? -1 : 1;
  }

  return getSidebarName(left).localeCompare(getSidebarName(right), "zh-CN", {
    numeric: true,
    sensitivity: "base"
  });
};

export default hopeTheme({
  navbar: [
    { text: "首页", link: "/" },
    { text: "学习路线", link: "/学习路线图.html" },
    ...publicNavbarGroups,
    { text: "发布规范", link: "/发布与脱敏规则.html" }
  ],
  sidebar: "structure",
  sidebarSorter: compareSidebarInfo,
  toc: {
    // 只把问题编号放进大纲，正文细节仍由页面内标题层级表达。
    selector: '#markdown-content > h2[id^="q"]',
    levels: 2
  },
  footer: "公开技术学习笔记",
  displayFooter: true,
  darkmode: "switch",
  markdown: {
    gfm: true,
    mark: true,
    // 兼容仓库现有的 ```plantuml、```puml 和 ```uml 围栏写法。
    plantuml: [
      { type: "fence", name: "uml", fence: "plantuml" },
      { type: "fence", name: "uml", fence: "puml" },
      { type: "fence", name: "uml", fence: "uml" }
    ],
    tasklist: true
  },
  plugins: {
    slimsearch: {
      indexContent: true
    }
  }
});
