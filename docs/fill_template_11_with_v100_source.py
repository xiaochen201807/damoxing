#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from textwrap import wrap
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path("/Users/xiaochen/Downloads/damoxing")
TEMPLATE_DOCX_PATH = ROOT / "docs" / "模板.docx"
DOCX_PATH = ROOT / "docs" / "11.docx"
TARGET_BRANCH = "v1.0.0"
TARGET_PAGES = 60
LINES_PER_PAGE = 60
TOTAL_LINES = TARGET_PAGES * LINES_PER_PAGE
MAX_CHARS_PER_LINE = 66
SEPARATOR = "// =========================================================="

SELECTED_FILES = [
    "server/index.js",
    "server/db.js",
    "server/middleware/auth.js",
    "server/middleware/security.js",
    "server/middleware/errorHandler.js",
    "server/middleware/validator.js",
    "server/routes/http/index.js",
    "server/routes/http/auth.js",
    "server/routes/http/menu.js",
    "server/routes/http/routes.js",
    "server/routes/http/schema.js",
    "server/routes/http/page-template.js",
    "server/routes/http/ai.js",
    "server/routes/http/cache.js",
    "server/routes/http/health.js",
    "server/routes/http/themes.js",
    "server/routes/mcp/index.js",
    "server/routes/mcp/mcp.js",
    "server/services/http-server.js",
    "server/services/mcp-server.js",
    "server/utils/logger.js",
    "server/utils/cache.js",
    "server/utils/pagination.js",
    "server/utils/amis-variable-escape.js",
    "server/utils/mcp-renderer.js",
    "client/src/main.tsx",
    "client/src/App.tsx",
    "client/src/api/client.ts",
    "client/src/api/menu.ts",
    "client/src/api/page.ts",
    "client/src/api/routes.ts",
    "client/src/layout/MainLayout.tsx",
    "client/src/components/AmisRenderer.tsx",
    "client/src/components/AuthGuard.tsx",
    "client/src/components/ErrorBoundary.tsx",
    "client/src/components/SkeletonLayout.tsx",
    "client/src/components/Menu/MenuList.tsx",
    "client/src/pages/Login.tsx",
    "client/src/pages/SystemConfig.tsx",
    "client/src/pages/AutoDashboard.tsx",
    "client/src/hooks/useMenu.ts",
    "client/src/hooks/useRoutes.ts",
    "client/src/services/menuService.ts",
    "client/src/services/routeService.ts",
    "client/src/utils/fetcher.ts",
    "client/src/utils/menuTree.ts",
    "client/src/utils/urlParams.ts",
    "client/src/config/constants.ts",
    "client/src/config/env.ts",
    "SmartChartAdapter.java",
]


def git_stdout(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def ensure_branch() -> None:
    current = git_stdout("branch", "--show-current")
    if current != TARGET_BRANCH:
        raise RuntimeError(f"当前分支为 {current}，不是目标分支 {TARGET_BRANCH}")


def cap_for_excerpt(total: int) -> int:
    if total >= 800:
        return 120
    if total >= 400:
        return 100
    if total >= 250:
        return 90
    if total >= 120:
        return 80
    return total


def normalize_line(line: str) -> str:
    return line.rstrip("\n").replace("\t", "    ")


def wrap_display_line(line: str, width: int = MAX_CHARS_PER_LINE) -> list[str]:
    text = normalize_line(line)
    if not text:
        return [""]

    leading = len(text) - len(text.lstrip(" "))
    indent = " " * leading
    continuation = indent + "    "

    pieces = wrap(
        text,
        width=width,
        expand_tabs=False,
        replace_whitespace=False,
        drop_whitespace=False,
        break_long_words=True,
        break_on_hyphens=False,
        subsequent_indent=continuation,
    )
    return pieces or [text]


def module_desc(rel: str) -> str:
    if rel.startswith("server/routes/http/"):
        return "后端HTTP路由"
    if rel.startswith("server/routes/mcp/"):
        return "MCP路由"
    if rel.startswith("server/middleware/"):
        return "后端中间件"
    if rel.startswith("server/services/"):
        return "后端服务"
    if rel.startswith("server/utils/"):
        return "后端工具"
    if rel.startswith("server/"):
        return "后端核心"
    if rel.startswith("client/src/pages/"):
        return "前端页面"
    if rel.startswith("client/src/components/"):
        return "前端组件"
    if rel.startswith("client/src/layout/"):
        return "前端布局"
    if rel.startswith("client/src/api/"):
        return "前端API封装"
    if rel.startswith("client/src/services/"):
        return "前端服务层"
    if rel.startswith("client/src/hooks/"):
        return "前端Hook"
    if rel.startswith("client/src/utils/"):
        return "前端工具"
    if rel.startswith("client/src/config/"):
        return "前端配置"
    if rel.startswith("client/src/"):
        return "前端核心"
    if rel.endswith(".java"):
        return "Java适配器"
    return "项目源码"


def detect_symbol(line: str) -> str | None:
    s = line.strip()
    if not s or s.startswith("//") or s.startswith("*") or s.startswith("/*"):
        return None

    patterns = [
        r"\b(?:async\s+)?function\s+([A-Za-z_][\w$]*)\s*\(",
        r"\b(?:const|let|var|export\s+const)\s+([A-Za-z_][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>",
        r"\b(?:const|let|var|export\s+const)\s+([A-Za-z_][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_][\w$]*\s*=>",
        r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][\w$]*)\s*\(",
        r"^(?:public|private|protected|static|final|synchronized|native|abstract|\s)+(?:<[^>]+>\s*)?[\w\[\]<>?, ]+\s+([A-Za-z_][\w$]*)\s*\(",
        r"^(?:async\s+)?([A-Za-z_][\w$]*)\s*\([^;]*\)\s*\{\s*$",
    ]
    for pattern in patterns:
        m = re.search(pattern, s)
        if m:
            name = m.group(1)
            if name not in {"if", "for", "while", "switch", "catch", "return", "new", "constructor"}:
                return name

    route_match = re.search(r"router\.(get|post|put|delete|patch)\s*\(\s*[\"']([^\"']+)", s)
    if route_match:
        return f"{route_match.group(1).upper()} {route_match.group(2)}"
    return None


def method_comment(name: str, rel: str) -> str:
    if name.startswith(("GET ", "POST ", "PUT ", "DELETE ", "PATCH ")):
        return f"// 方法注释：{name} 路由，处理当前接口请求。"
    if name.startswith("use"):
        return f"// 方法注释：{name} Hook，封装当前模块状态与副作用。"
    if rel.endswith(".tsx") and name[:1].isupper():
        return f"// 方法注释：{name} 组件，负责当前界面渲染与交互。"
    if rel.endswith(".java"):
        return f"// 方法注释：{name} 方法，负责当前Java适配处理。"
    if "/middleware/" in rel:
        return f"// 方法注释：{name} 方法，负责当前中间件处理。"
    if "/routes/" in rel:
        return f"// 方法注释：{name} 方法，负责当前路由分发处理。"
    if "/services/" in rel:
        return f"// 方法注释：{name} 方法，负责当前服务编排处理。"
    if "/utils/" in rel:
        return f"// 方法注释：{name} 方法，负责当前通用逻辑处理。"
    return f"// 方法注释：{name} 方法，负责当前模块核心处理。"


def build_lines() -> list[str]:
    lines: list[str] = [
        "// 当前项目源码整理文档",
        f"// 分支：{TARGET_BRANCH}",
        "// 模板：docs/11.docx",
        "// 要求：60页，每页60行，已补方法注释",
    ]

    for rel in SELECTED_FILES:
        path = ROOT / rel
        raw_lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        excerpt_total = cap_for_excerpt(len(raw_lines))
        excerpt = raw_lines[:excerpt_total]

        lines.extend(
            [
                SEPARATOR,
                f"// 文件：{rel}",
                f"// 模块：{module_desc(rel)}",
                f"// 节选：1-{excerpt_total}/{len(raw_lines)}",
            ]
        )

        for raw in excerpt:
            symbol = detect_symbol(raw)
            if symbol:
                lines.extend(wrap_display_line(method_comment(symbol, rel)))
            lines.extend(wrap_display_line(raw))

    if len(lines) > TOTAL_LINES:
        lines = lines[:TOTAL_LINES]
    else:
        lines.extend([""] * (TOTAL_LINES - len(lines)))

    return lines


def make_paragraph(text: str, page_break_before: bool = False) -> str:
    safe = escape(text if text else " ")
    page_break_xml = '<w:pageBreakBefore w:val="1"/>' if page_break_before else '<w:pageBreakBefore w:val="0"/>'
    return (
        "<w:p>"
        "<w:pPr>"
        '<w:keepNext w:val="0"/>'
        '<w:keepLines w:val="0"/>'
        + page_break_xml +
        '<w:widowControl w:val="0"/>'
        "<w:kinsoku/>"
        "<w:wordWrap/>"
        "<w:overflowPunct/>"
        '<w:topLinePunct w:val="0"/>'
        "<w:autoSpaceDE/>"
        "<w:autoSpaceDN/>"
        '<w:bidi w:val="0"/>'
        "<w:adjustRightInd/>"
        '<w:snapToGrid w:val="0"/>'
        '<w:textAlignment w:val="auto"/>'
        "<w:rPr>"
        '<w:rFonts w:hint="default" w:asciiTheme="minorEastAsia" '
        'w:hAnsiTheme="minorEastAsia" w:cstheme="minorEastAsia"/>'
        '<w:sz w:val="18"/>'
        '<w:szCs w:val="18"/>'
        '<w:lang w:val="en-US" w:eastAsia="zh-CN"/>'
        "</w:rPr>"
        "</w:pPr>"
        "<w:r>"
        "<w:rPr>"
        '<w:rFonts w:hint="default" w:asciiTheme="minorEastAsia" '
        'w:hAnsiTheme="minorEastAsia" w:cstheme="minorEastAsia"/>'
        '<w:sz w:val="18"/>'
        '<w:szCs w:val="18"/>'
        '<w:lang w:val="en-US" w:eastAsia="zh-CN"/>'
        "</w:rPr>"
        f'<w:t xml:space="preserve">{safe}</w:t>'
        "</w:r>"
        "</w:p>"
    )


def build_document_xml(template_document_xml: str, lines: list[str]) -> str:
    body_match = re.search(r"<w:body>([\s\S]*)</w:body>", template_document_xml)
    if not body_match:
        raise RuntimeError("无法解析模板 document.xml 的 body 节点")

    sect_match = re.search(r"<w:sectPr>[\s\S]*</w:sectPr>", body_match.group(1))
    if not sect_match:
        raise RuntimeError("无法解析模板 document.xml 的 sectPr 节点")

    sect_pr = sect_match.group(0).replace('<w:lnNumType w:countBy="1"/>', '<w:lnNumType w:countBy="1" w:restart="newPage"/>')

    body_parts: list[str] = []
    for page_index in range(TARGET_PAGES):
        start = page_index * LINES_PER_PAGE
        end = start + LINES_PER_PAGE
        for line_index, line in enumerate(lines[start:end]):
            page_break_before = page_index > 0 and line_index == 0
            body_parts.append(make_paragraph(line, page_break_before=page_break_before))

    return re.sub(
        r"<w:body>[\s\S]*</w:body>",
        "<w:body>" + "".join(body_parts) + sect_pr + "</w:body>",
        template_document_xml,
        count=1,
    )


def patch_footer_xml(footer_xml: str) -> str:
    return footer_xml.replace("<w:t>30</w:t>", "<w:t>60</w:t>", 1)


def main() -> None:
    ensure_branch()
    lines = build_lines()
    if len(lines) != TOTAL_LINES:
        raise RuntimeError(f"生成行数异常：{len(lines)} != {TOTAL_LINES}")

    source_path = DOCX_PATH if DOCX_PATH.exists() else TEMPLATE_DOCX_PATH
    with ZipFile(source_path, "r") as src:
        original_files = {name: src.read(name) for name in src.namelist()}

    document_xml = original_files["word/document.xml"].decode("utf-8", errors="ignore")
    footer_xml = original_files["word/footer1.xml"].decode("utf-8", errors="ignore")

    original_files["word/document.xml"] = build_document_xml(document_xml, lines).encode("utf-8")
    original_files["word/footer1.xml"] = patch_footer_xml(footer_xml).encode("utf-8")

    with ZipFile(DOCX_PATH, "w", compression=ZIP_DEFLATED) as dst:
        for name, data in original_files.items():
            dst.writestr(name, data)

    print(f"Updated template: {DOCX_PATH}")
    print(f"Pages: {TARGET_PAGES}, Lines per page: {LINES_PER_PAGE}, Total lines: {TOTAL_LINES}")


if __name__ == "__main__":
    main()
