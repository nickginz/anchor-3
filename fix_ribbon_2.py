
import re

file_path = r'c:\Users\NikolayGunzburg\Desktop\wall_pro\ANCHOR2\src\components\UI\Ribbon.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the edge case where a space is missing between bg-[...] and mx-1
content = content.replace('bg-[var(--border-color)]mx-1', 'bg-[var(--border-color)] mx-1')

# Also general safety check for bg-[...] followed immediately by something
content = re.sub(r'(bg-\[[^\]]+\])([a-zA-Z])', r'\1 \2', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed Ribbon.tsx edge cases")
