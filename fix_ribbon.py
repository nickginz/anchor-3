
import re

file_path = r'c:\Users\NikolayGunzburg\Desktop\wall_pro\ANCHOR2\src\components\UI\Ribbon.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix spaces around hyphens in class names
# Matches: word - word, word - number, word - [stuff]
# Examples: panel - bg, p - 0.5, bg - [#333]

# 1. Word - Word (e.g., panel - bg -> panel-bg)
content = re.sub(r'([a-zA-Z0-9]+)\s-\s([a-zA-Z0-9]+)', r'\1-\2', content)

# 2. Word - Number (e.g., p - 0.5 -> p-0.5, duration - 300 -> duration-300)
# Note: This might overlap with subtraction, but in className strings it's usually safe.
# We will target specific known prefixes to be safe.
prefixes = ['p', 'px', 'py', 'm', 'mx', 'my', 'duration', 'z', 'top', 'left', 'right', 'bottom', 'gap', 'h', 'w', 'min', 'max']
for p in prefixes:
    content = re.sub(r'\b' + p + r'\s-\s', p + '-', content)

# 3. Word - [Example] (e.g., bg - [#333] -> bg-[#333])
content = re.sub(r'([a-zA-Z0-9]+)\s-\s(\[)', r'\1-\2', content)

# 4. Specific known issues from file view
content = content.replace('panel - border', 'panel-border')
content = content.replace('panel - bg', 'panel-bg')
content = content.replace('items - stretch', 'items-stretch')
content = content.replace('select - none', 'select-none')
content = content.replace('transition - all', 'transition-all')
content = content.replace('transition - colors', 'transition-colors')
content = content.replace('transition - transform', 'transition-transform')
content = content.replace('items - center', 'items-center')
content = content.replace('justify - center', 'justify-center')
content = content.replace('border - b', 'border-b')
content = content.replace('border - l', 'border-l')
content = content.replace('border - r', 'border-r')
content = content.replace('border - t', 'border-t')
content = content.replace('shadow - xl', 'shadow-xl')
content = content.replace('shadow - inner', 'shadow-inner')
content = content.replace('flex - col', 'flex-col')
content = content.replace('flex - 1', 'flex-1')
content = content.replace('rounded - full', 'rounded-full')
content = content.replace('hover: bg -', 'hover:bg-') # specific fix
content = content.replace('bg - white', 'bg-white')

# Fix bg - [var(--border - color)]mx - 1 to bg-[var(--border-color)] mx-1
content = re.sub(r'bg-\[var\(--border\s-\scolor\)\]mx\s-\s1', 'bg-[var(--border-color)] mx-1', content)
content = re.sub(r'bg-\[var\(--border\s-\scolor\)\]', 'bg-[var(--border-color)]', content)

# General "word - word" might have covered some, but "hover: bg" has two parts.
content = re.sub(r'hover:\s+bg\s+-\s+', 'hover:bg-', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed Ribbon.tsx")
