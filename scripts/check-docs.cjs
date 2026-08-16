#!/usr/bin/env node
/**
 * Docs & skills drift checker for TamashaRoom.
 *
 * Verifies, across AGENTS.md, the skills, and docs/ (excluding docs/TASK.md,
 * which is the canonical count owner and a historical changelog):
 *
 *   1. Skill frontmatter `name:` matches the directory name.
 *   2. Backticked file-path references resolve to real files/directories.
 *   3. Hardcoded test-count patterns appear nowhere but docs/TASK.md.
 *   4. Backticked skill references point to an existing skill directory
 *      (i.e. no references to deleted skills).
 *   5. The debugging skill's `file:line` references are within bounds and its
 *      polling-timing table rows still point at the right constant values.
 *
 * Exit code 0 = clean, 1 = issues found. Run via `npm run check:docs`.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = fs.existsSync(path.join(ROOT, ".skills"))
    ? path.join(ROOT, ".skills")
    : path.join(ROOT, ".opencode", "skills");
const EXCLUDED_DOCS = new Set(["TASK.md"]);

// Boost-managed skills (third-party content synced by `php artisan boost:install`)
// are excluded from the path-reference check: their generic Laravel/Tailwind
// examples reference files that don't exist in this project (e.g. `tailwind.config.js`,
// `app/Rules`), and editing vendor content would diverge from upstream.
let boostSkillDirs = new Set();
try {
    const boostJson = JSON.parse(
        fs.readFileSync(path.join(ROOT, "boost.json"), "utf8"),
    );
    if (Array.isArray(boostJson.skills)) {
        boostSkillDirs = new Set(boostJson.skills);
    }
} catch {
    // No or malformed boost.json — treat every skill as project-owned.
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

const skillDirs = fs.existsSync(SKILLS_DIR)
    ? fs
          .readdirSync(SKILLS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
    : [];
const skillSet = new Set(skillDirs);

// Built-in / third-party skills that live outside this repo's skills dir.
const knownExternalSkills = new Set([
    "customize-opencode",
    "find-skills",
    "gepeto",
    "pinokio",
]);

const skillLikeSuffix = /-(rules|strategy|checklist|workflow|maintenance|efficiency|conventions|debugging|testing|decisions|opencode|skills)$/;

const issues = [];
function report(file, line, check, msg) {
    issues.push({ file, line, check, msg });
}

// Resolve a backticked path-like token to an existing repo path, or null.
function resolvePath(token) {
    let p = token.trim();
    // Chapter/line suffixes: "docs/SYSTEM.md 18.05", "file.ts:13", "file.ts:48-66"
    p = p.replace(/\s+(Chapter\s+)?\d+(\.\d+)?$/, "");
    p = p.replace(/^(.+?):\d+(-\d+)?$/, "$1");
    p = p.replace(/,\s*Chapter.*$/i, "");
    if (p.startsWith("@/")) p = p.replace(/^@\//, "resources/js/");
    if (p.includes("://")) return null; // URL, not a path
    if (p.startsWith("#")) return null;

    const full = path.join(ROOT, p);
    if (fs.existsSync(full)) return full;

    // Check junction alias fallback (.opencode/skills or .agents/skills -> .skills)
    let aliasP = p;
    if (p.startsWith(".opencode/skills")) {
        aliasP = p.replace(/^\.opencode\/skills/, ".skills");
    } else if (p.startsWith(".agents/skills")) {
        aliasP = p.replace(/^\.agents\/skills/, ".skills");
    }
    if (aliasP !== p) {
        const aliasFull = path.join(ROOT, aliasP);
        if (fs.existsSync(aliasFull)) return aliasFull;
    }

    // Try common extensions when the base name has none.
    const exts = [".ts", ".tsx", ".js", ".cjs", ".php", ".md", ".css", ".json"];
    for (const e of exts) {
        if (fs.existsSync(full + e)) return full + e;
        if (aliasP !== p && fs.existsSync(path.join(ROOT, aliasP) + e)) {
            return path.join(ROOT, aliasP) + e;
        }
    }
    // Directory index files.
    for (const idx of ["/index.ts", "/index.tsx", "/index.js", "/index.css"]) {
        if (fs.existsSync(full + idx)) return full + idx;
    }
    return null;
}

const knownPathRoots = [
    "docs/",
    "resources/",
    "app/",
    "routes/",
    "public/",
    "tests/",
    "config/",
    "database/",
    "bootstrap/",
    ".skills/",
    ".opencode/",
    ".agents/",
    "storage/",
    "vendor/",
    "scripts/",
    "package.json",
    "composer.json",
    ".env.example",
    "opencode.json",
    "eslint.config.js",
    "vite.config.",
    "vitest.config.",
    "tsconfig.json",
    "playwright.config.",
    "tailwind.config.",
    "artisan",
];

function isPathToken(token) {
    const t = token.trim();
    if (t.startsWith("@/")) return true;
    return knownPathRoots.some((r) => t.startsWith(r));
}

// Tokens that are globs, placeholders, or descriptions — not literal paths to
// verify (e.g. `docs/ai/**`, `docs/ai/plans/<PLAN FILE>`, `docs/…`,
// `public/storage → storage/app/public`).
function isNonLiteralToken(token) {
    return /[*<>…]|→|\s+or\s+/i.test(token);
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Scans
// ---------------------------------------------------------------------------

function frontmatterName(fileContent) {
    const m = /^---\n([\s\S]*?)\n---/.exec(fileContent);
    if (!m) return null;
    const name = /(?:^|\n)name:\s*["']?([^"'\n]+)["']?/.exec(m[1]);
    return name ? name[1].trim() : null;
}

const testCountPatterns = [
    /(\d{2,3})\s+(PHPUnit\s+)?tests?\b/i,
    /\b(\d+)\s*\/\s*(\d+)\s+(pass(ed|ing)?|green)\b/i,
    /\b(\d+)\s+test[s]?\s+(pass(ed|ing)?)\b/i,
];

// ---------------------------------------------------------------------------

const files = [];
for (const dir of [SKILLS_DIR, path.join(ROOT, "docs")]) {
    for (const f of walk(dir)) {
        if (f.endsWith(".md") || f.endsWith(".js") || f.endsWith(".json")) files.push(f);
    }
}
files.push(path.join(ROOT, "AGENTS.md"));

for (const file of files) {
    const rel = path.relative(ROOT, file);
    const isSkill =
        rel.startsWith(".skills") ||
        rel.startsWith(path.join(".opencode", "skills")) ||
        rel.startsWith(path.join(".agents", "skills"));
    const base = path.basename(file);
    const skipDocs = rel.startsWith("docs") && EXCLUDED_DOCS.has(base);
    if (skipDocs) continue;

    const relPosix = rel.split(path.sep).join("/");
    const boostMatch = /^\.skills\/([^/]+)\//.exec(relPosix);
    const isBoostManaged = boostMatch !== null && boostSkillDirs.has(boostMatch[1]);

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    // --- Check 1: frontmatter name === directory ---
    if (isSkill && base === "SKILL.md") {
        const dirName = path.basename(path.dirname(file));
        const name = frontmatterName(content);
        if (!name) {
            report(rel, 1, "frontmatter", "missing `name:` frontmatter");
        } else if (name !== dirName) {
            report(rel, 1, "frontmatter", `frontmatter name "${name}" != directory "${dirName}"`);
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;

        // --- Check 2: broken file-path references ---
        const backticks = [...line.matchAll(/`([^`]+)`/g)];
        if (!isBoostManaged) {
            for (const m of backticks) {
                const token = m[1];
                if (isNonLiteralToken(token)) continue;
                // Skip negative references ("There is no `docs/DESIGN.md`",
                // "not a `tailwind.config.ts`").
                if (
                    new RegExp(
                        `(not a |no |without )\`${escapeRegExp(token.trim())}\``,
                    ).test(line)
                ) {
                    continue;
                }
                if (isPathToken(token) && !resolvePath(token)) {
                    report(rel, lineNo, "path", `unresolved path reference: \`${token}\``);
                }
            }
        }

        // --- Check 3: hardcoded test counts (anywhere except docs/TASK.md) ---
        if (!rel.startsWith("docs")) {
            for (const re of testCountPatterns) {
                if (re.test(line)) {
                    report(rel, lineNo, "test-count", `hardcoded test-count pattern: "${line.trim()}"`);
                    break;
                }
            }
        }

        // --- Check 4: references to deleted skills ---
        for (const m of backticks) {
            const token = m[1];
            if (token.includes("/") || token.includes(".") || token.includes("@")) continue;
            if (!/^[a-z][a-z0-9-]*$/.test(token)) continue;
            if (skillSet.has(token) || knownExternalSkills.has(token)) continue;
            if (skillLikeSuffix.test(token)) {
                report(rel, lineNo, "skill-ref", `reference to unknown skill: \`${token}\``);
            }
        }
    }
}

// --- Check 5: debugging skill file:line references ---
const debugSkill = path.join(SKILLS_DIR, "debugging", "SKILL.md");
if (fs.existsSync(debugSkill)) {
    const rel = path.relative(ROOT, debugSkill);
    const lines = fs.readFileSync(debugSkill, "utf8").split("\n");

    // Polling timings table: file:line must contain the expected interval value.
    const timingRows = [
        { file: "use-playback-sync.ts", line: 15, expect: "3000" },
        { file: "use-playback-sync.ts", line: 16, expect: "10000" },
        { file: "use-presence.ts", line: 24, expect: "30000" },
        { file: "use-presence.ts", line: 25, expect: "5000" },
        { file: "use-presence.ts", line: 26, expect: "300000" },
    ];
    for (const row of timingRows) {
        const hit = walk(path.join(ROOT, "resources")).find(
            (f) => path.basename(f) === row.file,
        );
        if (!hit) {
            report(rel, 1, "debug-ref", `debugging table references ${row.file} but it was not found`);
            continue;
        }
        const fileLines = fs.readFileSync(hit, "utf8").split("\n");
        const target = fileLines[row.line - 1] ?? "";
        if (!target.includes(row.expect)) {
            report(
                rel,
                1,
                "debug-ref",
                `debugging table: ${row.file}:${row.line} no longer contains "${row.expect}" (now: "${target.trim() || "(empty)"}")`,
            );
        }
    }

    // All file:line refs (path:NN / path:NN-NN) must be within bounds.
    for (let i = 0; i < lines.length; i++) {
        const m = [...lines[i].matchAll(/`([^`]+?):(\d+)(?:-(\d+))?`/g)];
        for (const g of m) {
            const fileToken = g[1];
            const from = Number(g[2]);
            const to = g[3] ? Number(g[3]) : from;
            const hit = walk(path.join(ROOT, "resources")).find((f) => path.basename(f) === fileToken) ||
                (fs.existsSync(path.join(ROOT, fileToken)) ? path.join(ROOT, fileToken) : null);
            if (!hit) {
                report(rel, i + 1, "debug-ref", `debugging ref target not found: \`${fileToken}:${from}\``);
                continue;
            }
            const count = fs.readFileSync(hit, "utf8").split("\n").length;
            if (to > count) {
                report(rel, i + 1, "debug-ref", `debugging ref out of bounds: \`${fileToken}:${from}-${to}\` (file has ${count} lines)`);
            }
        }
    }
}

// ---------------------------------------------------------------------------

if (issues.length === 0) {
    console.log(`check:docs — clean (${files.length} files scanned)`);
    process.exit(0);
}

console.log(`check:docs — ${issues.length} issue(s) found:\n`);
for (const it of issues) {
    console.log(`  [${it.check}] ${it.file}:${it.line} — ${it.msg}`);
}
process.exit(1);
