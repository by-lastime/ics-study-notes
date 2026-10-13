"""Assemble the five printed chapters without rerasterizing text or figures."""
from pathlib import Path
from pypdf import PdfReader, PdfWriter

out = Path(__file__).resolve().parents[2] / 'site' / 'downloads'
files = [
    '第1讲-整数与汇编入门.pdf',
    '第2讲-浮点与条件分支.pdf',
    '第3讲-循环与过程调用.pdf',
    '第4讲-数据布局与内存安全.pdf',
    '第5讲-完整测验与考前整理.pdf',
]
writer = PdfWriter()
for name in files:
    writer.append(str(out / name), outline_item=Path(name).stem, import_outline=True)
writer.add_metadata({'/Title': 'ICS第一次小测复习讲义·正文合订本', '/Subject': '五讲正文与练习；答案另册；每讲页脚独立编号'})
writer.page_mode = '/UseOutlines'
target = out / 'ICS第一次小测-正文合订本.pdf'
writer.write(target)
expected = sum(len(PdfReader(out / f).pages) for f in files)
assert len(PdfReader(target).pages) == expected
print(f'{target.name}: {expected} pages, five chapter bookmarks')
