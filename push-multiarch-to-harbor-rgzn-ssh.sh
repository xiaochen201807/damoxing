#!/usr/bin/env bash

set -euo pipefail

# 通过可访问 Harbor 白名单的 SSH 主机转发镜像。
# 默认使用 SSH 动态 SOCKS5，保留 Harbor 原始域名和 TLS/SNI；
# 如果运行环境不支持 SOCKS5 代理，可设置 SSH_MODE=local 使用 -L 本地端口转发。

SRC="${SRC:-ghcr.io/xiaoguan521/damoxing:20260615-0318}"
DST_REPO="${DST_REPO:-harbor.sjgj.cn:10443/gjjrgzn/damoxing}"
DST_SUFFIX="${DST_SUFFIX:-gjsj}"
DST="${DST:-}"
SSH_MODE="${SSH_MODE:-socks5}"
SSH_TARGET="${SSH_TARGET:-}"
SSH_HOST="${SSH_HOST:-}"
SSH_USER="${SSH_USER:-}"
SSH_PORT="${SSH_PORT:-2222}"
SSH_KEY="${SSH_KEY:-}"
SSH_EXTRA_ARGS="${SSH_EXTRA_ARGS:-}"
SSH_SOCKS_PORT="${SSH_SOCKS_PORT:-18080}"
SSH_LOCAL_PORT="${SSH_LOCAL_PORT:-18443}"
SSH_PROXY_SCHEME="${SSH_PROXY_SCHEME:-socks5}"
REGISTRY_AUTH_FILE="${REGISTRY_AUTH_FILE:-${AUTH_FILE:-}}"
SRC_CREDS="${SRC_CREDS:-}"
DST_CREDS="${DST_CREDS:-}"
SKOPEO_EXTRA_ARGS="${SKOPEO_EXTRA_ARGS:-}"

SSH_PID=""

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf '缺少命令: %s\n' "$command_name" >&2
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

strip_transport_prefix() {
    local ref="$1"
    ref="${ref#docker://}"
    ref="${ref#https://}"
    ref="${ref#http://}"
    printf '%s\n' "$ref"
}

parse_registry_ref() {
    local ref="$1"
    local without_prefix
    without_prefix="$(strip_transport_prefix "$ref")"

    if [[ "$without_prefix" != */* ]]; then
        printf '镜像引用缺少 registry/repository: %s\n' "$ref" >&2
        exit 1
    fi

    REF_HOST="${without_prefix%%/*}"
    REF_PATH_TAG="${without_prefix#*/}"
    REF_PATH="${REF_PATH_TAG%:*}"

    if [[ "$REF_PATH_TAG" != *:* || -z "$REF_HOST" || -z "$REF_PATH" ]]; then
        printf '镜像引用必须包含 registry、repository 和 tag: %s\n' "$ref" >&2
        exit 1
    fi
}

build_ssh_target() {
    if [[ -n "$SSH_TARGET" ]]; then
        return
    fi

    if [[ -z "$SSH_HOST" ]]; then
        printf '请设置 SSH_TARGET=user@cloud-host，或同时设置 SSH_USER 和 SSH_HOST。\n' >&2
        exit 1
    fi

    if [[ -n "$SSH_USER" ]]; then
        SSH_TARGET="${SSH_USER}@${SSH_HOST}"
    else
        SSH_TARGET="$SSH_HOST"
    fi
}

start_ssh_tunnel() {
    local ssh_options=(-p "$SSH_PORT"
        -o ExitOnForwardFailure=yes
        -o ServerAliveInterval=30
        -o ServerAliveCountMax=3)

    if [[ -n "$SSH_KEY" ]]; then
        ssh_options+=(-i "$SSH_KEY")
    fi

    if [[ -n "$SSH_EXTRA_ARGS" ]]; then
        local extra_options=()
        read -r -a extra_options <<< "$SSH_EXTRA_ARGS"
        ssh_options+=("${extra_options[@]}")
    fi

    if [[ "$SSH_MODE" == "socks5" ]]; then
        printf '建立 SSH SOCKS5 隧道: 127.0.0.1:%s -> %s\n' "$SSH_SOCKS_PORT" "$SSH_TARGET"
        ssh "${ssh_options[@]}" -N -D "127.0.0.1:${SSH_SOCKS_PORT}" "$SSH_TARGET" &
    elif [[ "$SSH_MODE" == "local" ]]; then
        printf '建立 SSH 本地端口隧道: 127.0.0.1:%s -> %s:%s\n' \
            "$SSH_LOCAL_PORT" "$HARBOR_HOST" "$HARBOR_PORT"
        ssh "${ssh_options[@]}" -N -L "127.0.0.1:${SSH_LOCAL_PORT}:${HARBOR_HOST}:${HARBOR_PORT}" "$SSH_TARGET" &
    else
        printf '不支持的 SSH_MODE: %s，可选值为 socks5、local。\n' "$SSH_MODE" >&2
        exit 1
    fi

    SSH_PID=$!
    sleep 1

    if ! kill -0 "$SSH_PID" 2>/dev/null; then
        printf 'SSH 隧道未能启动，请检查 SSH 地址、密钥和远端到 Harbor 的连通性。\n' >&2
        exit 1
    fi
}

cleanup() {
    if [[ -n "$SSH_PID" ]] && kill -0 "$SSH_PID" 2>/dev/null; then
        kill "$SSH_PID" 2>/dev/null || true
        wait "$SSH_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

probe_harbor() {
    local probe_url="https://${HARBOR_HOST}:${HARBOR_PORT}/v2/"
    local http_code

    if [[ "$SSH_MODE" == "socks5" ]]; then
        http_code="$(curl --silent --show-error --max-time 15 \
            --proxy "${SSH_PROXY_SCHEME}://127.0.0.1:${SSH_SOCKS_PORT}" \
            -o /dev/null -w '%{http_code}' "$probe_url" || true)"
    else
        http_code="$(curl --silent --show-error --max-time 15 \
            --noproxy '*' --insecure \
            -o /dev/null -w '%{http_code}' \
            "https://127.0.0.1:${SSH_LOCAL_PORT}/v2/" || true)"
    fi

    case "$http_code" in
        200|401|403)
            printf 'Harbor /v2/ 连通检查通过（HTTP %s）。\n' "$http_code"
            ;;
        *)
            printf 'Harbor /v2/ 连通检查失败（HTTP %s）。\n' "${http_code:-000}" >&2
            exit 1
            ;;
    esac
}

run_skopeo_copy() {
    local src_ref="$1"
    local dst_ref="$2"
    local skopeo_args=(copy --all)

    if [[ -n "$REGISTRY_AUTH_FILE" ]]; then
        skopeo_args+=(--authfile "$REGISTRY_AUTH_FILE")
    fi
    if [[ -n "$SRC_CREDS" ]]; then
        skopeo_args+=(--src-creds "$SRC_CREDS")
    fi
    if [[ -n "$DST_CREDS" ]]; then
        skopeo_args+=(--dest-creds "$DST_CREDS")
    fi
    if [[ -n "$SKOPEO_EXTRA_ARGS" ]]; then
        local extra_args=()
        read -r -a extra_args <<< "$SKOPEO_EXTRA_ARGS"
        skopeo_args+=("${extra_args[@]}")
    fi

    if [[ "$SSH_MODE" == "local" ]]; then
        # 本地转发地址没有 Harbor 证书对应的域名，只能显式关闭该跳的证书校验。
        # 推荐优先使用 socks5 模式，以保留 Harbor 原始域名和 token realm。
        skopeo_args+=(--dest-tls-verify=false)
    fi

    skopeo "${skopeo_args[@]}" "docker://${src_ref}" "docker://${dst_ref}"
}

verify_destination() {
    local dst_ref="$1"
    local inspect_args=(inspect)

    if [[ "$SSH_MODE" == "local" ]]; then
        inspect_args+=(--tls-verify=false)
    fi

    skopeo "${inspect_args[@]}" "docker://${dst_ref}" >/dev/null
    printf '目标 manifest 校验通过: %s\n' "$dst_ref"
}

require_command ssh
require_command curl
require_command skopeo
build_ssh_target

SRC_REF="$(strip_transport_prefix "$SRC")"
if [[ -z "$DST" ]]; then
    DST_TAG="${DST_TAG:-$(derive_dst_tag_from_src "$SRC_REF")}"
    DST="${DST_REPO}:${DST_TAG}"
fi

parse_registry_ref "$DST"
DST_HOST="$REF_HOST"
DST_PATH="$REF_PATH"
DST_TAG="${DST_TAG:-${REF_PATH_TAG##*:}}"
DST_REF="$(strip_transport_prefix "$DST")"
HARBOR_HOST="${HARBOR_HOST:-${DST_HOST%%:*}}"
HARBOR_PORT="${HARBOR_PORT:-${DST_HOST##*:}}"

if [[ "$HARBOR_HOST" == "$HARBOR_PORT" ]]; then
    HARBOR_PORT=443
fi

printf '源镜像: %s\n' "$SRC_REF"
printf '目标镜像: %s\n' "$DST_REF"
printf 'SSH 模式: %s\n' "$SSH_MODE"
printf 'SSH 主机: %s\n' "$SSH_TARGET"
printf 'Harbor 地址: %s:%s\n' "$HARBOR_HOST" "$HARBOR_PORT"

start_ssh_tunnel
probe_harbor

if [[ "$SSH_MODE" == "socks5" ]]; then
    # 保持源镜像直连，只有 Harbor 通过 SSH SOCKS5；旧版 skopeo 如果不支持
    # SOCKS 代理环境变量，请改用 SSH_MODE=local。
    parse_registry_ref "$SRC_REF"
    SRC_HOST="$REF_HOST"
    export HTTPS_PROXY="${SSH_PROXY_SCHEME}://127.0.0.1:${SSH_SOCKS_PORT}"
    export HTTP_PROXY="${SSH_PROXY_SCHEME}://127.0.0.1:${SSH_SOCKS_PORT}"
    export ALL_PROXY="${SSH_PROXY_SCHEME}://127.0.0.1:${SSH_SOCKS_PORT}"
    export NO_PROXY="${NO_PROXY:+${NO_PROXY},}${SRC_HOST},127.0.0.1,localhost"
    SKOPEO_DST="$DST_REF"
else
    SKOPEO_DST="127.0.0.1:${SSH_LOCAL_PORT}/${DST_PATH}:${DST_TAG}"
fi

printf '\n[1/2] 通过 SSH 隧道推送双架构 manifest 到 Harbor\n'
run_skopeo_copy "$SRC_REF" "$SKOPEO_DST"

printf '\n[2/2] 校验目标镜像 manifest\n'
verify_destination "$SKOPEO_DST"

printf '\n完成，SSH 隧道将自动关闭。\n'
