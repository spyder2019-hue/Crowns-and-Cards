"""Validate syntax of JavaScript embedded in the production index.html."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

class InlineScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active = False
        self.current = []
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            attributes = dict(attrs)
            self.active = "src" not in attributes and attributes.get("type", "text/javascript") in ("text/javascript", "module")
            self.current = []

    def handle_data(self, text):
        if self.active:
            self.current.append(text)

    def handle_endtag(self, tag):
        if tag == "script" and self.active:
            code = "".join(self.current).strip()
            if code:
                self.scripts.append(code)
            self.active = False
            self.current = []

checker = InlineScripts()
checker.feed((ROOT / "index.html").read_text(encoding="utf-8"))
if not checker.scripts:
    raise SystemExit("No inline JavaScript found in index.html")

errors = []
for index, source in enumerate(checker.scripts, 1):
    result = subprocess.run(["node", "--check", "-"], input=source, text=True, capture_output=True)
    if result.returncode:
        errors.append(f"Inline script {index}: {result.stderr.strip()}")
if errors:
    print("\n\n".join(errors), file=sys.stderr)
    raise SystemExit(1)
print(f"Validated {len(checker.scripts)} embedded JavaScript blocks.")
