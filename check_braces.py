
import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    pairs = {'{': '}', '(': ')', '[': ']'}
    for i, line in enumerate(content.split('\n')):
        for j, char in enumerate(line):
            if char in '{([':
                stack.append((char, i+1, j+1))
            elif char in '})]':
                if not stack:
                    print(f"Extra closing {char} at line {i+1}, col {j+1}")
                else:
                    opening, line_num, col_num = stack.pop()
                    if pairs[opening] != char:
                        print(f"Mismatched {opening} and {char} at line {i+1}, col {j+1}")
    
    if stack:
        for char, line, col in stack:
            print(f"Unclosed opening {char} at line {line}, col {col}")
    else:
        print("All brackets, parens and braces are balanced!")

if __name__ == "__main__":
    check_braces(sys.argv[1])
