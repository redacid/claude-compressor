'use strict';

// Minimal, conservative shell scanning helpers. They do not parse shell; they
// only blank out quoted text so that operators inside strings are ignored,
// and split the rest into simple command segments.

// Replaces the contents of '...', "..." and backslash escapes with spaces,
// keeping the length. Returns null for unterminated quotes.
function maskQuotes(cmd) {
  let out = '';
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
        out += ch;
      } else if (quote === '"' && ch === '\\' && i + 1 < cmd.length) {
        out += '  ';
        i++;
      } else {
        out += ch === '\n' ? '\n' : ' ';
      }
    } else if (ch === '\\' && i + 1 < cmd.length) {
      out += '  ';
      i++;
    } else {
      if (ch === "'" || ch === '"') quote = ch;
      out += ch;
    }
  }
  return quote ? null : out;
}

// Splits a masked command on control operators (&&, ||, ;, |, &, newline,
// parentheses) and returns each segment's words, without leading VAR=value
// assignments.
function segments(masked) {
  return masked
    .split(/&&|\|\||[;|&\n()]/)
    .map((s) => s.trim().split(/\s+/).filter(Boolean))
    .map((words) => {
      let i = 0;
      while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
      return words.slice(i);
    })
    .filter((words) => words.length > 0);
}

// True when output is redirected into something other than /dev/null or
// another file descriptor (2>&1, >&2 are fine).
function redirectsToFile(masked) {
  const re = /(?:&>>?|\d*>>?|>\|)(\s*)(&?)([^\s;|&()<>]*)/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    if (m[2] === '&') continue;
    if (m[3] === '/dev/null') continue;
    return true;
  }
  return false;
}

module.exports = { maskQuotes, segments, redirectsToFile };
