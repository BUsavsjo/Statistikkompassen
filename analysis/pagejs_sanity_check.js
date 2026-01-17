/*
  Quick sanity checker for scripts/kommunbild/page.js.
  Purpose: pinpoint syntax issues that surface as "Unexpected end of input" in browsers.

  Usage (PowerShell):
    node analysis/pagejs_sanity_check.js
*/

const fs = require("fs");
const vm = require("vm");

const FILE = "scripts/kommunbild/page.js";
const code = fs.readFileSync(FILE, "utf8");

function stripLeadingImports(src) {
  // Remove all top-level import lines (best-effort), preserving line count where possible.
  return src.replace(/^\s*import[^;]*;\s*\r?\n/gm, "");
}

function parseAsScript(src) {
  try {
    new vm.Script(src, { filename: FILE });
    return { ok: true };
  } catch (err) {
    return { ok: false, err };
  }
}

function findUnclosedTokens(src) {
  // Lightweight scanner: tracks quotes/templates/comments + (),[],{} in NORMAL state.
  // Note: template literals are treated as strings (we don't parse ${...} expressions).
  let line = 1;
  let col = 0;
  let state = "normal"; // normal | line | block | sq | dq | tpl
  let escape = false;
  const stack = [];
  let opener = null;

  function push(ch) {
    stack.push({ ch, line, col });
  }
  function pop(ch) {
    if (!stack.length) return;
    const top = stack[stack.length - 1];
    const pair = ch === ")" ? "(" : ch === "]" ? "[" : ch === "}" ? "{" : null;
    if (pair && top.ch === pair) stack.pop();
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    col++;
    if (ch === "\n") {
      line++;
      col = 0;
    }

    if (state === "line") {
      if (ch === "\n") state = "normal";
      continue;
    }
    if (state === "block") {
      if (ch === "*" && src[i + 1] === "/") {
        i++;
        col++;
        state = "normal";
        opener = null;
      }
      continue;
    }
    if (state === "sq") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "'") {
        state = "normal";
        opener = null;
      }
      continue;
    }
    if (state === "dq") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        state = "normal";
        opener = null;
      }
      continue;
    }
    if (state === "tpl") {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "`") {
        state = "normal";
        opener = null;
      }
      continue;
    }

    // normal
    if (ch === "/" && src[i + 1] === "/") {
      state = "line";
      i++;
      col++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      state = "block";
      opener = { kind: "block", line, col };
      i++;
      col++;
      continue;
    }
    if (ch === "'") {
      state = "sq";
      opener = { kind: "sq", line, col };
      continue;
    }
    if (ch === '"') {
      state = "dq";
      opener = { kind: "dq", line, col };
      continue;
    }
    if (ch === "`") {
      state = "tpl";
      opener = { kind: "tpl", line, col };
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") push(ch);
    else if (ch === ")" || ch === "]" || ch === "}") pop(ch);
  }

  return { eofState: state, opener, unclosed: stack.length, tail: stack.slice(-10) };
}

console.log(`[sanity] reading ${FILE} (${code.length} chars)`);

const stripped = stripLeadingImports(code);
const parsed = parseAsScript(stripped);
if (!parsed.ok) {
  console.error("[sanity] vm.Script parse FAILED:");
  console.error(String(parsed.err && parsed.err.stack ? parsed.err.stack : parsed.err));
} else {
  console.log("[sanity] vm.Script parse OK");
}

const scan = findUnclosedTokens(code);
console.log("[sanity] token scan:");
console.log(JSON.stringify(scan, null, 2));

process.exitCode = parsed.ok ? 0 : 1;
