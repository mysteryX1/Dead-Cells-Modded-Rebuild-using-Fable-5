# -*- coding: utf-8 -*-
"""一次性切图脚本：把 assets/raw/ 下的原始拼合图集切成规则网格图集。

用法：
    pip install pillow
    python tools/slice.py

产出：
    assets/player.png  每行一个动作、行内等宽帧、底对齐（脚部稳定）
    assets/zombie.png  同上（动作：walk/windup/attack/hurt/dead）
    assets/tiles.png   64x32，帧0=实心砖，帧1=单向平台

切完后把打印出的 {action: {row, frames}} 抄进 src/anims.js（frames 字段）。

【素材现状】2026-06 调研结论：The Spriters Resource 的 PC/deadcells 页面不存在
（404；Wayback CDX 全量查询亦无记录），站内与《死亡细胞》相关的仅有
Return to Castlevania DLC 的 5 个 NPC 压缩包（Alucard/Maria/Richter/Shanoa/
Dracula 过场），均无玩家动作集、僵尸或监狱图块，无法用于本游戏。
因此 CROPS 暂为空，脚本在缺少原图时直接跳过并提示——游戏由
BootScene 的 loaderror 兜底继续使用占位纹理，保持可玩。

日后拿到原始图集（放入 assets/raw/）时：
1. 用看图工具量出每个动作每帧的源区域 (x, y, w, h)，填进 CROPS；
2. 运行本脚本生成规则网格图集；
3. 把打印的 meta 抄进 src/anims.js，并确认 SHEETS 的 frameWidth/Height 一致。
"""
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # Windows GBK 控制台下避免中文乱码

try:
    from PIL import Image
except ImportError:
    print("需要 Pillow：pip install pillow")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 每项: (动作名, 源图路径, [ (x, y, w, h), ... 每帧的源区域 ])
CROPS = {
    "player": {
        "frame_size": (64, 64),
        "out": "assets/player.png",
        "rows": [
            ("idle",    "assets/raw/player_sheet.png", []),
            ("run",     "assets/raw/player_sheet.png", []),
            ("jump",    "assets/raw/player_sheet.png", []),
            ("fall",    "assets/raw/player_sheet.png", []),
            ("roll",    "assets/raw/player_sheet.png", []),
            ("attack1", "assets/raw/player_sheet.png", []),
            ("attack2", "assets/raw/player_sheet.png", []),
            ("hurt",    "assets/raw/player_sheet.png", []),
            ("dead",    "assets/raw/player_sheet.png", []),
        ],
    },
    "zombie": {
        "frame_size": (64, 64),
        "out": "assets/zombie.png",
        "rows": [
            ("walk",   "assets/raw/zombie_sheet.png", []),
            ("windup", "assets/raw/zombie_sheet.png", []),
            ("attack", "assets/raw/zombie_sheet.png", []),
            ("hurt",   "assets/raw/zombie_sheet.png", []),
            ("dead",   "assets/raw/zombie_sheet.png", []),
        ],
    },
}

# 图块：从原始图集里各取一块 32x32 的可平铺纹理。
# (源图路径, (x, y, w, h))；帧0=实心砖，帧1=单向平台（只用顶部 12px 有内容）
TILES = {
    "out": "assets/tiles.png",
    "solid":    ("assets/raw/tileset.png", None),  # None = 未标定
    "platform": ("assets/raw/tileset.png", None),
}


def build(name, spec):
    fw, fh = spec["frame_size"]
    rows = spec["rows"]
    if all(len(r[2]) == 0 for r in rows):
        print(f"[skip] {name}: CROPS 未标定（原始图集缺失），沿用占位纹理")
        return
    missing = [r[1] for r in rows if r[2] and not os.path.exists(os.path.join(ROOT, r[1]))]
    if missing:
        print(f"[skip] {name}: 缺少原图 {sorted(set(missing))}")
        return
    max_frames = max(len(r[2]) for r in rows)
    out = Image.new("RGBA", (fw * max_frames, fh * len(rows)))
    meta = {}
    for ri, (action, src_path, boxes) in enumerate(rows):
        if boxes:
            src = Image.open(os.path.join(ROOT, src_path)).convert("RGBA")
        for fi, (x, y, w, h) in enumerate(boxes):
            frame = src.crop((x, y, x + w, y + h))
            frame.thumbnail((fw, fh), Image.NEAREST)
            ox = fi * fw + (fw - frame.width) // 2
            oy = ri * fh + (fh - frame.height)  # 底对齐，保证脚部稳定
            out.paste(frame, (ox, oy))
        meta[action] = {"row": ri, "frames": len(boxes)}
    out_path = os.path.join(ROOT, spec["out"])
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path)
    print(f"[ok] {spec['out']} ({out.width}x{out.height})")
    for action, m in meta.items():
        print(f"     {action}: row={m['row']} frames={m['frames']}  -> 抄进 src/anims.js")


def build_tiles(spec):
    if spec["solid"][1] is None or spec["platform"][1] is None:
        print("[skip] tiles: 源区域未标定（原始图集缺失），沿用占位纹理")
        return
    out = Image.new("RGBA", (64, 32))
    for fi, key in enumerate(("solid", "platform")):
        src_path, (x, y, w, h) = spec[key]
        src = Image.open(os.path.join(ROOT, src_path)).convert("RGBA")
        tile = src.crop((x, y, x + w, y + h)).resize((32, 32), Image.NEAREST)
        out.paste(tile, (fi * 32, 0))
    out_path = os.path.join(ROOT, spec["out"])
    out.save(out_path)
    print(f"[ok] {spec['out']} (64x32, 帧0=实心砖 帧1=平台)")


if __name__ == "__main__":
    for name, spec in CROPS.items():
        build(name, spec)
    build_tiles(TILES)
