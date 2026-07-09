import json, re

qs = json.load(open(r'C:\Users\Ahmed\Documents\ESATprep\src\data\questions.json', encoding='utf-8'))

math_span = re.compile(r'\$[^$]*\$')
sqrt_word = re.compile(r'sqrt', re.I)
latex_cmd = re.compile(r'\\[a-zA-Z]+')
caret_us = re.compile(r'[\^_]')

def outside_math(s):
    return math_span.sub('', s)

lit_sqrt, bad_cmd, caret, unbalanced = [], [], [], []
for q in qs:
    for letter, opt in q['options'].items():
        out = outside_math(opt)
        loc = q['id'] + '/' + letter
        if sqrt_word.search(out):
            lit_sqrt.append((loc, opt))
        if latex_cmd.search(out):
            bad_cmd.append((loc, opt))
        if caret_us.search(out):
            caret.append((loc, opt))
        if opt.count('$') % 2 == 1:
            unbalanced.append((loc, opt))

def show(title, rows, n=15):
    print('===', title, ':', len(rows))
    for loc, o in rows[:n]:
        print('   ', loc, '::', repr(o[:90]))
    print()

show("literal 'sqrt' outside math mode", lit_sqrt)
show("LaTeX command (backslash) outside $...$  -- renders as raw text", bad_cmd)
show("^ or _ outside math mode", caret)
show("ODD number of $ (unbalanced math delimiters)", unbalanced)
