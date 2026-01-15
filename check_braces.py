
filename = r"c:\Users\NikolayGunzburg\Desktop\wall_pro\ANCHOR2\src\components\Canvas\InteractionLayer.tsx"

with open(filename, 'r') as f:
    lines = f.readlines()

balance = 0
for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            balance += 1
        elif char == '}':
            balance -= 1
    
    if balance < 0:
        print(f"Balance went negative at line {i+1}: {line}")
        break  # Found the first extra brace

if balance >= 0:
    print(f"Final balance: {balance}")
