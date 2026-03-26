#!/usr/bin/env bash

set -euo pipefail

SRC="${SRC:-ghcr.docker.201807.xyz/xiaoguan521/damoxing:20260326-2227}"
DST_REPO="${DST_REPO:-harbor.sjgjj.cn:10443/gjjrgzn/damoxing}"
DST_SUFFIX="${DST_SUFFIX:-gjsj}"
TRANSFER_TOOL="${TRANSFER_TOOL:-auto}"

require_command() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        printf '缺少命令: %s\n' "$cmd" >&2
        exit 1
    fi
}

derive_dst_tag_from_src() {
    local src_ref="$1"
    local src_tag="${src_ref##*:}"

    if [[ "$src_ref" != *:* || "$src_tag" == *"/"* ]]; then
        printf '无法从 SRC 提取 tag，请显式传入带 tag 的 SRC。\n' >&2
        exit 1
    fi

    local normalized_tag="${src_tag//-/}"
    printf '%s-%s\n' "$normalized_tag" "$DST_SUFFIX"
}

require_command docker

DST_TAG="${DST_TAG:-$(derive_dst_tag_from_src "$SRC")}"
DST="${DST:-${DST_REPO}:${DST_TAG}}"

printf '源镜像: %s\n' "$SRC"
printf '目标镜像: %s\n' "$DST"

if [[ "$TRANSFER_TOOL" == "auto" ]]; then
    if command -v skopeo >/dev/null 2>&1; then
        TRANSFER_TOOL="skopeo"
    else
        TRANSFER_TOOL="buildx"
    fi
fi

printf '传输方式: %s\n' "$TRANSFER_TOOL"

printf '\n[1/2] 创建并推送双架构 manifest 到 Harbor\n'
if [[ "$TRANSFER_TOOL" == "skopeo" ]]; then
    skopeo copy --all "docker://$SRC" "docker://$DST"
elif [[ "$TRANSFER_TOOL" == "buildx" ]]; then
    if ! docker buildx version >/dev/null 2>&1; then
        printf '当前 Docker 不支持 buildx，请先安装或启用 buildx。\n' >&2
        exit 1
    fi
    docker buildx imagetools create --tag "$DST" "$SRC"
else
    printf '不支持的 TRANSFER_TOOL: %s，可选值为 auto、skopeo、buildx。\n' "$TRANSFER_TOOL" >&2
    exit 1
fi

printf '\n[2/2] 校验目标镜像 manifest\n'
docker buildx imagetools inspect "$DST"

printf '\n完成。\n'
