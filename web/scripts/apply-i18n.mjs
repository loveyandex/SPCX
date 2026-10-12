import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../src");
const han = /[\u4e00-\u9fff]/;
const drafts = path.join(root, "i18n/drafts");

function loadMap() {
  const map = {};
  for (const name of fs.readdirSync(drafts)) {
    if (!name.startsWith("part-") || !name.endsWith(".json")) continue;
    const part = JSON.parse(fs.readFileSync(path.join(drafts, name), "utf8"));
    for (const [zh, value] of Object.entries(part)) {
      if (!value || typeof value.en !== "string" || typeof value.fa !== "string") continue;
      map[zh] = value;
    }
  }
  return map;
}

const map = loadMap();
if (Object.keys(map).length === 0) {
  console.error("No part-*.json translations found");
  process.exit(1);
}

const faMessages = {};
const missing = [];
const collisions = [];

function remember(en, fa) {
  if (!en) return;
  if (Object.prototype.hasOwnProperty.call(faMessages, en) && faMessages[en] !== fa) {
    collisions.push({ en, kept: faMessages[en], ignored: fa });
    return;
  }
  faMessages[en] = fa;
}

function lookup(text) {
  if (map[text]) return map[text];
  const trimmed = text.trim();
  if (trimmed !== text && map[trimmed]) return map[trimmed];
  return null;
}

function isInsideFunction(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return true;
    current = current.parent;
  }
  return false;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "i18n" || entry.name === "drafts") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function transform(file) {
  let sourceText = fs.readFileSync(file, "utf8");
  if (!han.test(sourceText)) return false;
  let changed = false;
  for (let pass = 0; pass < 6 && han.test(sourceText); pass += 1) {
    const updated = transformOnce(file, sourceText);
    if (!updated || updated === sourceText) break;
    sourceText = updated;
    changed = true;
  }
  if (changed) fs.writeFileSync(file, sourceText);
  return changed;
}

function transformOnce(file, sourceText) {
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const replacements = [];
  let needsT = false;

  function add(start, end, text, useT) {
    replacements.push({ start, end, text });
    if (useT) needsT = true;
  }

  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (han.test(node.text)) {
        const hit = lookup(node.text);
        if (!hit) missing.push(`${path.relative(root, file)} :: ${node.text.slice(0, 180)}`);
        else {
          remember(hit.en, hit.fa);
          const inside = isInsideFunction(node);
          const call = `t(${JSON.stringify(hit.en)})`;
          if (inside && ts.isJsxAttribute(node.parent)) add(node.getStart(sourceFile), node.getEnd(), `{${call}}`, true);
          else if (inside) add(node.getStart(sourceFile), node.getEnd(), call, true);
          else add(node.getStart(sourceFile), node.getEnd(), JSON.stringify(hit.en), false);
        }
      }
    } else if (ts.isJsxText(node) && han.test(node.text)) {
      const hit = lookup(node.text.trim());
      if (!hit) missing.push(`${path.relative(root, file)} JSX :: ${node.text.trim().slice(0, 180)}`);
      else {
        remember(hit.en, hit.fa);
        const lead = node.text.match(/^\s*/)?.[0] ?? "";
        const trail = node.text.match(/\s*$/)?.[0] ?? "";
        add(node.getStart(sourceFile), node.getEnd(), `${lead}{t(${JSON.stringify(hit.en)})}${trail}`, true);
      }
    } else if (ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent)) {
      const pieces = [{ text: node.head.text }];
      for (const span of node.templateSpans) {
        pieces.push({ expr: span.expression.getText(sourceFile) });
        pieces.push({ text: span.literal.text });
      }
      if (pieces.some((piece) => piece.text && han.test(piece.text))) {
        let en = "";
        let fa = "";
        const args = [];
        let failed = false;
        for (const piece of pieces) {
          if (piece.expr !== undefined) {
            const index = args.length;
            en += `{${index}}`;
            fa += `{${index}}`;
            args.push(piece.expr);
          } else if (han.test(piece.text)) {
            const hit = lookup(piece.text);
            if (!hit) {
              failed = true;
              missing.push(`${path.relative(root, file)} TPL :: ${piece.text.slice(0, 180)}`);
            } else {
              en += hit.en;
              fa += hit.fa;
            }
          } else {
            en += piece.text;
            fa += piece.text;
          }
        }
        if (!failed) {
          remember(en, fa);
          const inside = isInsideFunction(node);
          let call = `t(${JSON.stringify(en)})`;
          if (args.length > 0) {
            const fields = args.map((expr, index) => `${JSON.stringify(String(index))}: ${expr}`).join(", ");
            call = `t(${JSON.stringify(en)}, { ${fields} })`;
          }
          if (inside && ts.isJsxAttribute(node.parent)) add(node.getStart(sourceFile), node.getEnd(), `{${call}}`, true);
          else if (inside) add(node.getStart(sourceFile), node.getEnd(), call, true);
          else add(node.getStart(sourceFile), node.getEnd(), JSON.stringify(en), false);
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (replacements.length === 0) return null;
  replacements.sort((a, b) => b.start - a.start);
  let next = sourceText;
  for (const replacement of replacements) {
    next = next.slice(0, replacement.start) + replacement.text + next.slice(replacement.end);
  }
  if (needsT && !/from\s+["']@\/i18n\/t["']/.test(next)) {
    const line = 'import { t } from "@/i18n/t";\n';
    const useClient = next.match(/^(?:["']use client["'];?\s*\n)/);
    next = useClient ? next.replace(useClient[0], `${useClient[0]}${line}`) : line + next;
  } else if (needsT) {
    next = next.replace(/import\s+\{([^}]+)\}\s+from\s+["']@\/i18n\/t["']/g, (full, names) => {
      if (/\bt\b/.test(names)) return full;
      return `import { t, ${names.trim()} } from "@/i18n/t"`;
    });
  }
  return next;
}

let changed = 0;
for (const file of walk(root)) {
  if (transform(file)) {
    changed += 1;
    console.log("updated", path.relative(root, file));
  }
}

const enMessages = {};
for (const key of Object.keys(faMessages)) enMessages[key] = key;
const messagesDir = path.join(root, "i18n/messages");
fs.writeFileSync(path.join(messagesDir, "en.json"), `${JSON.stringify(enMessages, null, 2)}\n`);
fs.writeFileSync(path.join(messagesDir, "fa.json"), `${JSON.stringify(faMessages, null, 2)}\n`);
fs.writeFileSync(path.join(drafts, "missing.txt"), missing.join("\n"));
console.log(`files ${changed} messages ${Object.keys(faMessages).length} missing ${missing.length} collisions ${collisions.length}`);
if (collisions.length) fs.writeFileSync(path.join(drafts, "collisions.json"), JSON.stringify(collisions, null, 2));
