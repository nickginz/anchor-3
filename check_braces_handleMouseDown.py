
filename = r"c:\Users\NikolayGunzburg\Desktop\wall_pro\ANCHOR2\src\components\Canvas\InteractionLayer.tsx"

with open(filename, 'r') as f:
    lines = f.readlines()

balance = 0
start_line = 374
end_line = 988
found_start = False

for i in range(start_line - 1, end_line):
    line = lines[i]
    for char in line:
        if char == '{':
            balance += 1
            found_start = True
        elif char == '}':
            balance -= 1
            if found_start and balance == 0:
                print(f"handleMouseDown closed at line {i+1}: {line}")
                
    if found_start and balance < 0:
         print(f"Balance negative at {i+1}")
         break
