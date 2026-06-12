# -*- coding: utf-8 -*-
"""把 assets/ 下用户手工下载的三张立绘裁透明边、按高度缩放成游戏用单帧贴图。

用法：python tools/prepare_singles.py   （需要 Pillow：pip install Pillow）
"""
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # Windows GBK 控制台下避免中文乱码

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / 'assets'

# (源文件名关键字, 输出文件名, 目标高度px)
JOBS = [
    ('t46vigyt1o4r3j4l9kbbbuh2g7h6si', 'player.png', 48),
    ('石雕守卫', 'elite.png', 56),
    ('fis3hcv0nqe0g6f2kepd069izn7civ', 'boss.png', 80),
]


def find_source(keyword):
    for p in ASSETS.iterdir():
        if keyword in p.name and p.suffix.lower() == '.png':
            return p
    raise FileNotFoundError(f'assets/ 下找不到文件名含 {keyword} 的 png')


def process(src, out_name, target_h):
    img = Image.open(src).convert('RGBA')
    bbox = img.getbbox()  # 全透明边界裁掉
    if bbox:
        img = img.crop(bbox)
    scale = target_h / img.height
    size = (max(1, round(img.width * scale)), target_h)
    img = img.resize(size, Image.NEAREST)  # 像素风：最近邻
    img.save(ASSETS / out_name)
    print(f'{src.name} -> {out_name} {size[0]}x{size[1]}')


if __name__ == '__main__':
    for keyword, out_name, target_h in JOBS:
        process(find_source(keyword), out_name, target_h)
