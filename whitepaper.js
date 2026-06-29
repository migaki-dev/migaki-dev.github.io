const KATEX_VERSION = "0.17.0";
const KATEX_URL = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.mjs`;
const KATEX_PACKAGE_URL = `https://www.npmjs.com/package/katex/v/${KATEX_VERSION}`;
const WHITEPAPER_BASE =
  "https://raw.githubusercontent.com/migaki-dev/migaki-whitepaper/main/paper/";
const WHITEPAPER_MAIN_PATH = "main.tex";

const KATEX_MACROS = {
  "\\Accept": "\\mathsf{Accept}",
  "\\Constraints": "\\mathcal{K}",
  "\\Cost": "\\widehat{C}",
  "\\Latency": "\\widehat{L}",
  "\\Models": "\\mathcal{M}",
  "\\Plans": "\\Pi",
  "\\Policy": "\\mathsf{Policy}",
  "\\Quality": "Q",
  "\\Risk": "\\widehat{R}",
  "\\Tasks": "\\mathcal{T}",
  "\\Validators": "\\mathcal{V}",
  "\\baseplan": "\\pi_0",
  "\\mir": "\\text{mIR}",
  "\\migaki": "\\text{Migaki}",
  "\\plan": "\\pi",
  "\\textsc": "\\text{#1}",
};

const statusElement = document.getElementById("whitepaper-status");
const documentElement = document.getElementById("whitepaper-document");
const readerElement = document.querySelector(".whitepaper-reader");
const katexVersionElement = document.querySelector("[data-katex-version]");

let referenceIndex = new Map();

async function main() {
  if (!statusElement || !documentElement) {
    return;
  }

  try {
    if (katexVersionElement) {
      katexVersionElement.textContent = `KaTeX ${KATEX_VERSION}`;
      katexVersionElement.setAttribute("href", KATEX_PACKAGE_URL);
    }

    const [{ default: katex }, mainText] = await Promise.all([
      import(KATEX_URL),
      fetchSource(WHITEPAPER_MAIN_PATH),
    ]);
    const inputPaths = extractInputPaths(mainText);
    const sectionPaths = inputPaths.filter((path) => path.startsWith("sections/"));
    const bibliographyPath = inputPaths.find((path) => path === "bibliography.tex");
    const [sectionTexts, bibliographyText] = await Promise.all([
      Promise.all(sectionPaths.map(fetchSource)),
      bibliographyPath ? fetchSource(bibliographyPath) : Promise.resolve(""),
    ]);
    const references = extractBibliographyEntries(bibliographyText);
    referenceIndex = new Map(
      references.map((entry, index) => [entry.key, { ...entry, number: index + 1 }]),
    );

    const fragment = document.createDocumentFragment();
    addPaperTitle(fragment, extractPaperMetadata(mainText));

    for (const sectionText of sectionTexts) {
      fragment.append(renderLatexDocument(sectionText, katex));
    }

    if (references.length > 0) {
      fragment.append(renderBibliography(references, katex));
    }

    documentElement.replaceChildren(fragment);
    await document.fonts?.ready;
    documentElement.classList.add("paper-flow");
    statusElement.remove();
    readerElement?.setAttribute("aria-busy", "false");
  } catch (error) {
    statusElement.textContent =
      "Could not load the whitepaper source. The GitHub source link is still available above.";
    readerElement?.setAttribute("aria-busy", "false");
    console.error(error);
  }
}

async function fetchSource(path) {
  const response = await fetch(`${WHITEPAPER_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.text();
}

function extractInputPaths(source) {
  return Array.from(source.matchAll(/\\input\{([^}]+)\}/g), (match) =>
    normalizeTexPath(match[1]),
  ).filter((path) => path !== "preamble.tex");
}

function normalizeTexPath(path) {
  return path.endsWith(".tex") ? path : `${path}.tex`;
}

function extractPaperMetadata(source) {
  const titleLines = splitLatexLines(extractCommandArgument(source, "title") ?? "")
    .map(cleanPlainLatexText)
    .filter(Boolean);
  const authorLines = splitLatexLines(extractCommandArgument(source, "author") ?? "")
    .map(cleanPlainLatexText)
    .filter(Boolean);
  const date = cleanPlainLatexText(extractCommandArgument(source, "date") ?? "");

  return {
    title: titleLines[0] || "Whitepaper",
    subtitle: titleLines.slice(1).join(" "),
    authors: authorLines,
    date,
  };
}

function extractCommandArgument(source, command) {
  const commandIndex = source.indexOf(`\\${command}`);
  if (commandIndex === -1) {
    return "";
  }

  const start = source.indexOf("{", commandIndex);
  if (start === -1) {
    return "";
  }

  let depth = 0;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\" && !escaped) {
      escaped = true;
      continue;
    }

    if (char === "{" && !escaped) {
      depth += 1;
    }

    if (char === "}" && !escaped) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start + 1, index);
      }
    }

    escaped = false;
  }

  return "";
}

function splitLatexLines(source) {
  return source.replace(/\\vspace\{[^}]+\}/g, "").split(/\\\\(?:\[[^\]]+\])?/);
}

function cleanPlainLatexText(source) {
  return source
    .replace(/\\(?:textbf|emph|texttt|textsc)\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:small|large)\b/g, "")
    .replace(/\\migaki\{\}|\\migaki/g, "Migaki")
    .replace(/\\mir\{\}|\\mir/g, "mIR")
    .replace(/``/g, "\"")
    .replace(/''/g, "\"")
    .replace(/---/g, "-")
    .replace(/~+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addPaperTitle(fragment, metadata) {
  const header = document.createElement("header");
  header.className = "paper-title-page";

  const title = document.createElement("h3");
  title.className = "paper-title";
  title.textContent = metadata.title;
  header.append(title);

  if (metadata.subtitle) {
    const subtitle = document.createElement("p");
    subtitle.className = "paper-subtitle";
    subtitle.textContent = metadata.subtitle;
    header.append(subtitle);
  }

  if (metadata.authors.length > 0 || metadata.date) {
    const meta = document.createElement("p");
    meta.className = "paper-byline";
    meta.textContent = [...metadata.authors, metadata.date].filter(Boolean).join(" · ");
    header.append(meta);
  }

  fragment.append(header);
}

function renderLatexDocument(source, katex) {
  const fragment = document.createDocumentFragment();
  const text = stripComments(source);
  const blockPattern =
    /\\begin\{(abstract|equation|align|itemize|lstlisting|quote|center|table|claim|definition|principle)\}(?:\[([^\]]*)\])?/g;
  let cursor = 0;
  let match = blockPattern.exec(text);

  while (match) {
    appendTextBlocks(fragment, text.slice(cursor, match.index), katex);

    const environment = match[1];
    const option = match[2] ?? "";
    const contentStart = blockPattern.lastIndex;
    const endPattern = new RegExp(`\\\\end\\{${environment}\\}`, "g");
    endPattern.lastIndex = contentStart;
    const endMatch = endPattern.exec(text);

    if (!endMatch) {
      appendTextBlocks(fragment, text.slice(match.index), katex);
      return fragment;
    }

    const content = text.slice(contentStart, endMatch.index);
    fragment.append(renderEnvironment(environment, option, content, katex));
    cursor = endPattern.lastIndex;
    blockPattern.lastIndex = cursor;
    match = blockPattern.exec(text);
  }

  appendTextBlocks(fragment, text.slice(cursor), katex);
  return fragment;
}

function appendTextBlocks(fragment, source, katex) {
  const lines = source.split("\n");
  let paragraph = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const heading = trimmed.match(/^\\(section|subsection)\{(.+)\}$/);
    if (heading) {
      flushParagraph();
      const level = heading[1] === "section" ? "h3" : "h4";
      const element = document.createElement(level);
      appendInline(element, heading[2], katex);
      fragment.append(element);
      continue;
    }

    if (/^\\(label|caption)\{/.test(trimmed)) {
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    const element = document.createElement("p");
    appendInline(element, paragraph.join(" "), katex);
    fragment.append(element);
    paragraph = [];
  }
}

function renderEnvironment(environment, option, content, katex) {
  switch (environment) {
    case "abstract":
      return renderAbstract(content, katex);
    case "equation":
    case "align":
      return renderMathBlock(content, katex, environment === "align");
    case "itemize":
      return renderItemize(content, katex);
    case "lstlisting":
      return renderListing(content);
    case "quote":
      return renderQuote(content, katex);
    case "center":
      return renderCenter(content, katex);
    case "table":
      return renderTable(content, katex);
    case "claim":
    case "definition":
    case "principle":
      return renderTheorem(environment, option, content, katex);
    default:
      return document.createTextNode(content);
  }
}

function renderAbstract(content, katex) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement("h3");
  heading.textContent = "Abstract";
  fragment.append(heading);
  appendTextBlocks(fragment, content, katex);
  return fragment;
}

function renderMathBlock(content, katex, aligned) {
  const wrapper = document.createElement("div");
  wrapper.className = "paper-equation";
  let math = content.replace(/\\label\{[^}]+\}/g, "").trim();

  if (aligned) {
    math = `\\begin{aligned}\n${math}\n\\end{aligned}`;
  } else {
    math = normalizeDisplayMath(math);
  }

  if (math.length > 120) {
    wrapper.classList.add("paper-equation-long");
  }

  wrapper.innerHTML = katex.renderToString(math, {
    displayMode: true,
    macros: KATEX_MACROS,
    throwOnError: false,
  });
  return wrapper;
}

function normalizeDisplayMath(math) {
  const typeSet = math.match(/^\\tau\(v\)\s*\\in\s*\\\{(.+)\\\}\.$/s);
  if (!typeSet) {
    return math;
  }

  const items = typeSet[1].split(/\s*,\s*/).filter(Boolean);
  if (items.length < 7) {
    return math;
  }

  const splitIndex = Math.ceil(items.length / 2);
  return `\\begin{aligned}
\\tau(v) \\in \\{&${items.slice(0, splitIndex).join(", ")},\\\\
&${items.slice(splitIndex).join(", ")}\\}.
\\end{aligned}`;
}

function renderItemize(content, katex) {
  const list = document.createElement("ul");
  for (const item of content.split(/\\item\s+/).map((entry) => entry.trim()).filter(Boolean)) {
    const element = document.createElement("li");
    appendInline(element, item, katex);
    list.append(element);
  }
  return list;
}

function renderListing(content) {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = content.replace(/^\[[^\]]*\]\s*/, "").trim();
  pre.append(code);
  return pre;
}

function renderQuote(content, katex) {
  const quote = document.createElement("blockquote");
  appendTextBlocks(quote, content, katex);
  return quote;
}

function renderCenter(content, katex) {
  const element = document.createElement("div");
  element.className = "paper-center";
  const cleaned = content
    .replace(/\\small/g, "")
    .replace(/\\centering/g, "")
    .replace(/\\fbox\{?/g, "")
    .replace(/\\begin\{minipage\}\{[^}]+\}/g, "")
    .replace(/\\end\{minipage\}\}?/g, "")
    .trim();

  if (/\\begin\{tabular\}/.test(cleaned)) {
    element.append(renderTable(cleaned, katex));
    return element;
  }

  const lines = cleaned
    .split("\n")
    .map((entry) => entry.trim().replace(/\\\\\s*$/, "").trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^\}+$/g.test(line)) {
      continue;
    }

    const row = document.createElement("div");
    appendInline(row, line, katex);
    element.append(row);
  }

  return element;
}

function renderTable(content, katex) {
  const fragment = document.createDocumentFragment();
  const tableBody = extractTabularBody(content);
  const caption = extractCommandArgument(content, "caption");

  if (!tableBody) {
    const pre = document.createElement("pre");
    pre.textContent = cleanupText(content);
    return pre;
  }

  const table = document.createElement("table");
  const scroll = document.createElement("div");
  scroll.className = "paper-table-scroll";
  const body = document.createElement("tbody");
  const rows = tableBody
    .split(/\\\\/)
    .map((row) => row.trim())
    .map((row) => row.replace(/\\(toprule|midrule|bottomrule)/g, "").trim())
    .filter(Boolean);

  for (const [index, row] of rows.entries()) {
    const tr = document.createElement("tr");
    const cellName = index === 0 ? "th" : "td";
    const cells = row.split("&").map((cell) => cell.trim()).filter(Boolean);

    for (const cell of cells) {
      const element = document.createElement(cellName);
      appendInline(element, cell, katex);
      tr.append(element);
    }

    body.append(tr);
  }

  table.append(body);
  scroll.append(table);
  fragment.append(scroll);

  if (caption) {
    const captionElement = document.createElement("p");
    captionElement.className = "paper-caption";
    appendInline(captionElement, caption, katex);
    fragment.append(captionElement);
  }

  return fragment;
}

function extractTabularBody(content) {
  const start = content.indexOf("\\begin{tabular}");
  if (start === -1) {
    return "";
  }

  const bodyStart = content.indexOf("\n", start);
  const end = content.indexOf("\\end{tabular}", bodyStart);
  if (bodyStart === -1 || end === -1) {
    return "";
  }

  return content.slice(bodyStart + 1, end);
}

function renderTheorem(environment, option, content, katex) {
  const aside = document.createElement("aside");
  aside.className = "paper-theorem";

  const title = document.createElement("strong");
  title.className = "paper-theorem-title";
  title.textContent = option ? `${capitalize(environment)}: ${option}` : capitalize(environment);
  aside.append(title);
  appendTextBlocks(aside, content, katex);
  return aside;
}

function appendInline(parent, source, katex) {
  const parts = source.split(/(\$[^$]+\$)/g).filter(Boolean);

  for (const part of parts) {
    if (part.startsWith("$") && part.endsWith("$")) {
      const span = document.createElement("span");
      span.innerHTML = katex.renderToString(part.slice(1, -1), {
        displayMode: false,
        macros: KATEX_MACROS,
        throwOnError: false,
      });
      parent.append(span);
      continue;
    }

    appendFormattedText(parent, part);
  }
}

function appendFormattedText(parent, source) {
  const html = cleanupInlineText(source)
    .replace(/\\href\{(https?:\/\/[^}]+)\}\{([^}]+)\}/g, '<a href="$1">$2</a>')
    .replace(/\\url\{(https?:\/\/[^}]+)\}/g, '<a href="$1">$1</a>')
    .replace(/\\textbf\{([^}]+)\}/g, "<strong>$1</strong>")
    .replace(/\\emph\{([^}]+)\}/g, "<em>$1</em>")
    .replace(/\\texttt\{([^}]+)\}/g, "<code>$1</code>")
    .replace(/\\textsc\{([^}]+)\}/g, "<span>$1</span>")
    .replace(/\\citep?\{([^}]+)\}/g, (_match, keys) => renderCitationHtml(keys));

  const template = document.createElement("template");
  template.innerHTML = html;
  parent.append(template.content);
}

function renderCitationHtml(keys) {
  const citations = keys
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
    .map((key) => {
      const reference = referenceIndex.get(key);
      if (!reference) {
        return escapeHtml(key);
      }

      return `<a href="#${referenceId(key)}">${reference.number}</a>`;
    });

  return `<span class="paper-citation">[${citations.join(", ")}]</span>`;
}

function renderBibliography(entries, katex) {
  const fragment = document.createDocumentFragment();

  const heading = document.createElement("h3");
  heading.textContent = "References";
  fragment.append(heading);

  for (const [index, entry] of entries.entries()) {
    const item = document.createElement("p");
    item.className = "paper-reference";
    item.id = referenceId(entry.key);

    const label = document.createElement("span");
    label.className = "paper-reference-number";
    label.textContent = `[${index + 1}]`;
    item.append(label);

    const body = document.createElement("span");
    appendInline(body, entry.body, katex);
    item.append(body);
    fragment.append(item);
  }

  return fragment;
}

function extractBibliographyEntries(source) {
  const text = stripComments(source)
    .replace(/\\begin\{thebibliography\}\{[^}]+\}/g, "")
    .replace(/\\end\{thebibliography\}/g, "");
  const entries = [];
  const pattern = /\\bibitem\{([^}]+)\}/g;
  let match = pattern.exec(text);

  while (match) {
    const bodyStart = pattern.lastIndex;
    const nextMatch = pattern.exec(text);
    const body = text.slice(bodyStart, nextMatch ? nextMatch.index : text.length);
    entries.push({
      key: match[1],
      body: body.replace(/\s+/g, " ").trim(),
    });
    match = nextMatch;
  }

  return entries;
}

function referenceId(key) {
  return `ref-${key.replace(/[^a-z0-9_-]+/gi, "-")}`;
}

function cleanupInlineText(source) {
  const leading = /^\s/.test(source) ? " " : "";
  const trailing = /\s$/.test(source) ? " " : "";
  const cleaned = cleanupText(source);

  if (!cleaned) {
    return leading || trailing ? " " : "";
  }

  return `${leading}${cleaned}${trailing}`;
}

function cleanupText(source) {
  return escapeHtml(source)
    .replace(/\\migaki\{\}|\\migaki/g, "Migaki")
    .replace(/\\mir\{\}|\\mir/g, "mIR")
    .replace(/\\newblock\s*/g, "")
    .replace(/\\label\{[^}]+\}/g, "")
    .replace(/\\ref\{([^}]+)\}/g, "$1")
    .replace(/Equation~eq:/g, "Equation ")
    .replace(/~+/g, " ")
    .replace(/``/g, "\"")
    .replace(/''/g, "\"")
    .replace(/---/g, "-")
    .replace(/\\LaTeX/g, "LaTeX")
    .replace(/\\ldots/g, "...")
    .replace(/\\_/g, "_")
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stripComments(source) {
  return source
    .split("\n")
    .map((line) => {
      let escaped = false;
      let result = "";

      for (const char of line) {
        if (char === "%" && !escaped) {
          break;
        }

        result += char;
        escaped = char === "\\" && !escaped;
        if (char !== "\\") {
          escaped = false;
        }
      }

      return result;
    })
    .join("\n");
}

function escapeHtml(source) {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalize(source) {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

main();
