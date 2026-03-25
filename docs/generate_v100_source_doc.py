#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape
import zipfile


ROOT = Path("/Users/xiaochen/Downloads/damoxing")
OUTPUT = ROOT / "docs" / "damoxing_v1.0.0_源码整理文档.docx"
TARGET_PAGES = 60
LINES_PER_PAGE = 60
TOTAL_LINES = TARGET_PAGES * LINES_PER_PAGE
BRANCH = "v1.0.0"

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
]


def run_git(args: list[str]) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def ensure_branch() -> None:
    current = run_git(["branch", "--show-current"])
    if current != BRANCH:
        raise RuntimeError(f"当前分支为 {current}，不是目标分支 {BRANCH}")


def cap_for_line_count(total: int) -> int:
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


def human_module_desc(rel: str) -> str:
    if rel.startswith("server/routes/http/"):
        return "后端 HTTP 路由处理源码"
    if rel.startswith("server/routes/mcp/"):
        return "MCP 路由与协议接入源码"
    if rel.startswith("server/middleware/"):
        return "后端中间件与安全控制源码"
    if rel.startswith("server/services/"):
        return "后端服务启动与封装源码"
    if rel.startswith("server/utils/"):
        return "后端工具函数源码"
    if rel.startswith("client/src/pages/"):
        return "前端页面组件源码"
    if rel.startswith("client/src/components/"):
        return "前端通用组件源码"
    if rel.startswith("client/src/layout/"):
        return "前端布局组件源码"
    if rel.startswith("client/src/api/"):
        return "前端 API 封装源码"
    if rel.startswith("client/src/services/"):
        return "前端服务层源码"
    if rel.startswith("client/src/hooks/"):
        return "前端 Hook 复用逻辑源码"
    if rel.startswith("client/src/utils/"):
        return "前端工具函数源码"
    if rel.startswith("client/src/config/"):
        return "前端配置源码"
    if rel.startswith("client/src/"):
        return "前端入口源码"
    if rel.endswith(".java"):
        return "Java 适配器源码"
    return "项目核心源码"


def describe_symbol(name: str, rel: str) -> str:
    if name.startswith("GET ") or name.startswith("POST ") or name.startswith("PUT ") or name.startswith("DELETE ") or name.startswith("PATCH "):
        return f"方法注释：{name} 路由处理逻辑，负责接收请求参数并组织当前接口的业务流程。"
    if name.startswith("use"):
        return f"方法注释：{name} Hook，用于封装当前模块的状态管理、数据加载或副作用逻辑。"
    if rel.endswith(".tsx") and name[:1].isupper():
        return f"方法注释：{name} 组件，负责当前页面或组件片段的渲染与交互逻辑。"
    if rel.endswith(".java"):
        return f"方法注释：{name} 方法，负责当前 Java 适配层中的核心处理逻辑。"
    if "/routes/" in rel:
        return f"方法注释：{name} 方法，负责当前路由模块中的接口处理或请求分发逻辑。"
    if "/services/" in rel:
        return f"方法注释：{name} 方法，负责当前服务层中的业务编排或调用封装逻辑。"
    if "/utils/" in rel:
        return f"方法注释：{name} 方法，负责当前工具模块中的复用计算或通用处理逻辑。"
    if "/middleware/" in rel:
        return f"方法注释：{name} 方法，负责当前中间件中的鉴权、校验或安全处理逻辑。"
    return f"方法注释：{name} 方法，负责当前模块中的核心处理逻辑。"


def detect_symbol(line: str) -> str | None:
    import re

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
        match = re.search(pattern, s)
        if match:
            symbol = match.group(1)
            if symbol not in {"if", "for", "while", "switch", "catch", "return", "new", "constructor"}:
                return symbol

    route_match = re.search(r"router\.(get|post|put|delete|patch)\s*\(\s*[\"']([^\"']+)", s)
    if route_match:
        return f"{route_match.group(1).upper()} {route_match.group(2)}"

    return None


def build_doc_lines() -> list[str]:
    lines: list[str] = []

    for rel in SELECTED_FILES:
        path = ROOT / rel
        raw = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        excerpt_count = cap_for_line_count(len(raw))
        excerpt = raw[:excerpt_count]

        header = [
            "// ==============================================================================",
            f"// 文件：{rel}",
            f"// 说明：{human_module_desc(rel)}；文档收录行：1-{excerpt_count} / 共 {len(raw)} 行。",
            "// ==============================================================================",
        ]
        lines.extend(header)

        for idx, raw_line in enumerate(excerpt, start=1):
            symbol = detect_symbol(raw_line)
            if symbol:
                lines.append(f"      // {describe_symbol(symbol, rel)}")
            lines.append(f"{idx:>4}  {normalize_line(raw_line)}")

    if len(lines) > TOTAL_LINES:
        lines = lines[:TOTAL_LINES]
    elif len(lines) < TOTAL_LINES:
        lines.extend([""] * (TOTAL_LINES - len(lines)))

    return lines


def paragraph_xml(text: str) -> str:
    safe = escape(text if text else " ")
    return (
        "<w:p>"
        "<w:pPr>"
        '<w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="exact"/>'
        '<w:ind w:left="120" w:right="0"/>'
        "</w:pPr>"
        "<w:r>"
        "<w:rPr>"
        '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="等线"/>'
        '<w:sz w:val="18"/>'
        '<w:szCs w:val="18"/>'
        "</w:rPr>"
        f'<w:t xml:space="preserve">{safe}</w:t>'
        "</w:r>"
        "</w:p>"
    )


def page_break_xml() -> str:
    return "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>"


def build_document_xml(lines: list[str]) -> str:
    body_parts: list[str] = []
    for page_index in range(TARGET_PAGES):
        start = page_index * LINES_PER_PAGE
        end = start + LINES_PER_PAGE
        for line in lines[start:end]:
            body_parts.append(paragraph_xml(line))
        if page_index < TARGET_PAGES - 1:
            body_parts.append(page_break_xml())

    sect_pr = (
        "<w:sectPr>"
        '<w:headerReference w:type="default" r:id="rId1"/>'
        '<w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="900" '
        'w:header="360" w:footer="360" w:gutter="0"/>'
        '<w:cols w:space="720"/>'
        '<w:docGrid w:linePitch="210"/>'
        "</w:sectPr>"
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" '
        'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
        'xmlns:o="urn:schemas-microsoft-com:office:office" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
        'xmlns:v="urn:schemas-microsoft-com:vml" '
        'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:w10="urn:schemas-microsoft-com:office:word" '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" '
        'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" '
        'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" '
        'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" '
        'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" '
        'mc:Ignorable="w14 wp14">'
        "<w:body>"
        + "".join(body_parts)
        + sect_pr
        + "</w:body></w:document>"
    )


def build_header_xml() -> str:
    title = "damoxing v1.0.0 分支源码整理文档"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:hdr xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
        'xmlns:w10="urn:schemas-microsoft-com:office:word" '
        'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" '
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
        'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">'
        "<w:p>"
        "<w:pPr><w:jc w:val=\"right\"/></w:pPr>"
        "<w:r><w:rPr>"
        '<w:rFonts w:ascii="等线" w:hAnsi="等线" w:eastAsia="等线"/>'
        '<w:color w:val="808080"/>'
        '<w:sz w:val="18"/><w:szCs w:val="18"/>'
        "</w:rPr>"
        f"<w:t>{escape(title)}</w:t>"
        "</w:r>"
        "</w:p>"
        "</w:hdr>"
    )


def build_styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:docDefaults>'
        '<w:rPrDefault><w:rPr>'
        '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="等线"/>'
        '<w:sz w:val="18"/><w:szCs w:val="18"/>'
        "</w:rPr></w:rPrDefault>"
        '<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="210" w:lineRule="exact"/></w:pPr></w:pPrDefault>'
        "</w:docDefaults>"
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
        "</w:styles>"
    )


def build_settings_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:zoom w:percent="100"/>'
        '<w:defaultTabStop w:val="420"/>'
        "</w:settings>"
    )


def build_content_types_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
        '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        "</Types>"
    )


def build_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def build_document_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
        "</Relationships>"
    )


def build_core_xml() -> str:
    created = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    title = "damoxing v1.0.0 分支源码整理文档"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        f"<dc:title>{escape(title)}</dc:title>"
        "<dc:creator>Codex</dc:creator>"
        "<cp:lastModifiedBy>Codex</cp:lastModifiedBy>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def build_app_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>Microsoft Office Word</Application>"
        "<DocSecurity>0</DocSecurity>"
        "<ScaleCrop>false</ScaleCrop>"
        "<Company>OpenAI Codex</Company>"
        "<LinksUpToDate>false</LinksUpToDate>"
        "<SharedDoc>false</SharedDoc>"
        "<HyperlinksChanged>false</HyperlinksChanged>"
        "<AppVersion>16.0000</AppVersion>"
        "</Properties>"
    )


def write_docx(lines: list[str]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", build_content_types_xml())
        zf.writestr("_rels/.rels", build_rels_xml())
        zf.writestr("docProps/core.xml", build_core_xml())
        zf.writestr("docProps/app.xml", build_app_xml())
        zf.writestr("word/document.xml", build_document_xml(lines))
        zf.writestr("word/styles.xml", build_styles_xml())
        zf.writestr("word/settings.xml", build_settings_xml())
        zf.writestr("word/header1.xml", build_header_xml())
        zf.writestr("word/_rels/document.xml.rels", build_document_rels_xml())


def main() -> None:
    ensure_branch()
    lines = build_doc_lines()
    if len(lines) != TOTAL_LINES:
        raise RuntimeError(f"行数不正确：{len(lines)} != {TOTAL_LINES}")
    write_docx(lines)
    print(f"Generated: {OUTPUT}")
    print(f"Pages: {TARGET_PAGES}, Lines per page: {LINES_PER_PAGE}, Total lines: {len(lines)}")


if __name__ == "__main__":
    main()
