
filename = r"c:\Users\NikolayGunzburg\Desktop\wall_pro\ANCHOR2\src\components\Canvas\InteractionLayer.tsx"

with open(filename, 'r') as f:
    lines = f.readlines()

balance = 0
found_start = False

for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            balance += 1
            if i + 1 == 138:
                 found_start = True
        elif char == '}':
            balance -= 1
            if found_start and balance == 0:
                print(f"InteractionLayer potentially closed at line {i+1}: {line}")
                # Don't break, keep checking to see if it dips below 0 or stays 0
                
    if balance < 0:
         print(f"Balance negative at {i+1}")
         break
