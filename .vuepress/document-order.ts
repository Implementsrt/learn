type DocumentSortKey = {
  group: 0 | 1 | 2;
  order: number;
};

const datePrefixPattern = /^\d{4}-\d{2}-\d{2}-/u;
const arabicPrefixPattern = /^\s*(\d+)\s*(?=[-_.、:：)）]|\p{Script=Han})/u;
const chinesePrefixPattern = /^\s*([零〇一二两三四五六七八九十百千万亿]+)\s*(?=[-_.、:：)）]|\p{Script=Han})/u;

const chineseDigits: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

const chineseUnits: Record<string, number> = {
  十: 10,
  百: 100,
  千: 1000,
  万: 10000,
  亿: 100000000
};

const parseChineseNumber = (value: string) => {
  let total = 0;
  let section = 0;
  let number = 0;

  for (const character of value) {
    const digit = chineseDigits[character];

    if (digit !== undefined) {
      number = digit;
      continue;
    }

    const unit = chineseUnits[character];

    if (unit >= 10000) {
      section = (section + number) * unit;
      total += section;
      section = 0;
      number = 0;
      continue;
    }

    section += (number || 1) * unit;
    number = 0;
  }

  return total + section + number;
};

const getSortKey = (filename: string, title = ""): DocumentSortKey => {
  // 日期前缀是时间信息，不是本地编排编号；优先使用标题中的大类编号。
  const candidates = [
    ...(datePrefixPattern.test(filename) ? [] : [filename]),
    title
  ];

  for (const candidate of candidates) {
    const match = candidate.match(arabicPrefixPattern);

    if (match) {
      return { group: 0, order: Number(match[1]) };
    }
  }

  for (const candidate of candidates) {
    const match = candidate.match(chinesePrefixPattern);

    if (match) {
      return { group: 1, order: parseChineseNumber(match[1]) };
    }
  }

  return { group: 2, order: Number.MAX_SAFE_INTEGER };
};

const compareText = (left: string, right: string) =>
  left.localeCompare(right, "zh-CN", {
    numeric: true,
    sensitivity: "base"
  });

/**
 * 按“阿拉伯数字前缀 → 中文数字前缀 → 自然名称”排序。
 * filename 保留本地文件编排权重，title 用于识别 Markdown 内容中的标题编号。
 */
export const compareDocumentNames = (
  leftFilename: string,
  leftTitle: string | undefined,
  rightFilename: string,
  rightTitle: string | undefined
) => {
  const leftKey = getSortKey(leftFilename, leftTitle);
  const rightKey = getSortKey(rightFilename, rightTitle);

  if (leftKey.group !== rightKey.group) {
    return leftKey.group - rightKey.group;
  }

  if (leftKey.order !== rightKey.order) {
    return leftKey.order - rightKey.order;
  }

  const filenameResult = compareText(leftFilename, rightFilename);

  return filenameResult !== 0 ? filenameResult : compareText(leftTitle ?? "", rightTitle ?? "");
};

/** 隐藏展示名称中的阿拉伯数字或中文数字编号前缀。 */
export const stripOrderPrefix = (value: string) =>
  (datePrefixPattern.test(value) ? value.replace(datePrefixPattern, "") : value)
    .replace(
      /^\s*(?:\d+|[零〇一二两三四五六七八九十百千万亿]+)\s*[-_.、:：)）]\s*/u,
      ""
    )
    .replace(/^\s*\d+\s*道\s*/u, "")
    .trim();
