#!/usr/bin/env python3
"""前文明档案馆 · 构建脚本

    python3 tools/build.py           校验 + 生成离线包（data/bundle.js、data/img-bundle.js）
    python3 tools/build.py --check   只校验（GitHub Actions / Cloudflare 部署前也跑这一步）

离线包只在双击 index.html（file://）时使用，已在 .gitignore 中忽略，不需要提交。
通过 HTTP 访问（本地 python3 -m http.server 或线上部署）时直接读取源文件。
"""
import base64
import json
import mimetypes
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ["data/worlds.json", "data/pages.json", "data/characters.json", "data/novels.json"]
errors = []


def err(msg):
    errors.append(msg)


def load_json(rel):
    try:
        return json.loads((ROOT / rel).read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(f"{rel}: JSON 格式错误 — {e}")
        return None


def check():
    data = {rel: load_json(rel) for rel in DATA}

    # 所有 "file" 字段指向的文件必须存在
    for rel in DATA:
        text = (ROOT / rel).read_text(encoding="utf-8")
        for f in re.findall(r'"file"\s*:\s*"([^"]+)"', text):
            if not (ROOT / f).exists():
                err(f"{rel}: 引用的文件不存在 — {f}")

    # 世界 id 唯一、kind 合法
    w = data.get("data/worlds.json")
    if w:
        cats = set((w.get("categories") or {}).keys())
        seen = set()
        for x in w.get("worlds", []):
            wid = x.get("id")
            if not wid:
                err(f"worlds.json: 有世界缺少 id — {x.get('name')}")
                continue
            if wid in seen:
                err(f"worlds.json: id 重复 — {wid}")
            seen.add(wid)
            if cats and x.get("kind") not in cats:
                err(f"worlds.json: {wid} 的 kind「{x.get('kind')}」不在 categories 里")
            for k in ("x", "y", "z"):
                if not isinstance(x.get(k), (int, float)):
                    err(f"worlds.json: {wid} 缺少数值坐标 {k}")

    # 词条与人物 id 唯一
    for rel, key in (("data/pages.json", "pages"), ("data/characters.json", "characters")):
        d = data.get(rel)
        if not d:
            continue
        ids = [x.get("id") for x in d.get(key, [])]
        dup = {i for i in ids if ids.count(i) > 1}
        if dup:
            err(f"{rel}: id 重复 — {', '.join(sorted(map(str, dup)))}")

    # Markdown 里引用的图片必须存在
    for md in ROOT.glob("content/**/*.md"):
        for img in re.findall(r"assets/img/[^\s\"')]+", md.read_text(encoding="utf-8")):
            if not (ROOT / img).exists():
                err(f"{md.relative_to(ROOT)}: 图片不存在 — {img}")


def bundle():
    files = {}
    for rel in DATA:
        files[rel] = (ROOT / rel).read_text(encoding="utf-8")
    for md in sorted(ROOT.glob("content/**/*.md")):
        files[md.relative_to(ROOT).as_posix()] = md.read_text(encoding="utf-8")
    (ROOT / "data/bundle.js").write_text(
        "/* 自动生成：python3 tools/build.py。供 file:// 离线打开使用，请勿手动编辑。 */\n"
        "window.__PA_BUNDLE__ = " + json.dumps(files, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    imgs = {}
    for p in sorted((ROOT / "assets/img").rglob("*")):
        if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp", ".svg"):
            mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
            imgs[p.relative_to(ROOT).as_posix()] = f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
    (ROOT / "data/img-bundle.js").write_text(
        "/* 自动生成：python3 tools/build.py。file:// 下 WebGL 不能读本地图片，故内嵌。 */\n"
        "window.__PA_IMG__ = Object.assign(window.__PA_IMG__ || {}, " + json.dumps(imgs) + ");\n",
        encoding="utf-8",
    )
    print(f"已生成 data/bundle.js（{len(files)} 个文本）与 data/img-bundle.js（{len(imgs)} 张图片）")


if __name__ == "__main__":
    check()
    if errors:
        print("校验失败：")
        for e in errors:
            print("  ✗", e)
        sys.exit(1)
    print("校验通过")
    if "--check" not in sys.argv:
        bundle()
