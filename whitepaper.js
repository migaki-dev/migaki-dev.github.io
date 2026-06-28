const KATEX_URL = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.mjs";
const WHITEPAPER_BASE =
  "https://raw.githubusercontent.com/migaki-dev/migaki-whitepaper/main/paper/";

const WHITEPAPER_SECTIONS = [
  "sections/00-abstract.tex",
  "sections/01-introduction.tex",
  "sections/02-the-missing-middle.tex",
  "sections/03-position-within-the-ecosystem.tex",
  "sections/04-from-compiler-analogy-to-probabilistic-query-optimization.tex",
  "sections/05-formal-model.tex",
  "sections/06-mir-migaki-intermediate-representation.tex",
  "sections/07-context-selection-and-deduplication.tex",
  "sections/08-cache-planning.tex",
  "sections/09-routing-under-constraints.tex",
  "sections/10-provider-neutral-capability-aware.tex",
  "sections/11-optimization-passes.tex",
  "sections/12-verification-and-evidence.tex",
  "sections/13-examples.tex",
  "sections/14-initial-scope.tex",
  "sections/15-why-now.tex",
  "sections/16-long-term-vision.tex",
  "sections/17-conclusion.tex",
  "sections/a1-one-sentence-positioning.tex",
  "sections/a2-claims-migaki-can-defend.tex",
  "sections/a3-claims-migaki-should-avoid.tex",
];

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

async function main() {
  if (!statusElement || !documentElement) {
    return;
  }

  try {
    const [{ default: katex }, sectionTexts] = await Promise.all([
      import(KATEX_URL),
      Promise.all(WHITEPAPER_SECTIONS.map(fetchSection)),
    ]);

    const fragment = document.createDocumentFragment();
    addPaperTitle(fragment);

    for (const sectionText of sectionTexts) {
      fragment.append(renderLatexDocument(sectionText, katex));
    }

    documentElement.replaceChildren(fragment);
    statusElement.remove();
    readerElement?.setAttribute("aria-busy", "false");
  } catch (error) {
    statusElement.textContent =
      "Could not load the whitepaper source. The GitHub source link is still available above.";
    readerElement?.setAttribute("aria-busy", "false");
    console.error(error);
  }
}

async function fetchSection(path) {
  const response = await fetch(`${WHITEPAPER_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.text();
}

function addPaperTitle(fragment) {
  const title = document.createElement("h3");
  title.textContent = "Migaki: Toward an Execution Optimizer for Agentic Systems";
  fragment.append(title);

  const meta = document.createElement("p");
  meta.className = "paper-caption";
  meta.textContent = "Draft Vision Paper v0.3. Aleksandr Lopashev, Migaki Project.";
  fragment.append(meta);
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
  }

  wrapper.innerHTML = katex.renderToString(math, {
    displayMode: true,
    macros: KATEX_MACROS,
    throwOnError: false,
  });
  return wrapper;
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

  for (const line of cleaned.split(/\\\\/).map((entry) => entry.trim()).filter(Boolean)) {
    const row = document.createElement("div");
    appendInline(row, line.replace(/^\}+|\}+$/g, ""), katex);
    element.append(row);
  }

  return element;
}

function renderTable(content, katex) {
  const fragment = document.createDocumentFragment();
  const tableBody = extractTabularBody(content);
  const captionMatch = content.match(/\\caption\{([^}]+)\}/);

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

  if (captionMatch) {
    const caption = document.createElement("p");
    caption.className = "paper-caption";
    appendInline(caption, captionMatch[1], katex);
    fragment.append(caption);
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
  const html = cleanupText(source)
    .replace(/\\href\{(https?:\/\/[^}]+)\}\{([^}]+)\}/g, '<a href="$1">$2</a>')
    .replace(/\\url\{(https?:\/\/[^}]+)\}/g, '<a href="$1">$1</a>')
    .replace(/\\textbf\{([^}]+)\}/g, "<strong>$1</strong>")
    .replace(/\\emph\{([^}]+)\}/g, "<em>$1</em>")
    .replace(/\\texttt\{([^}]+)\}/g, "<code>$1</code>")
    .replace(/\\textsc\{([^}]+)\}/g, "<span>$1</span>")
    .replace(/\\citep\{([^}]+)\}/g, '<span class="paper-citation">[$1]</span>')
    .replace(/\\cite\{([^}]+)\}/g, '<span class="paper-citation">[$1]</span>');

  const template = document.createElement("template");
  template.innerHTML = html;
  parent.append(template.content);
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
    .replace(/\\ldots/g, "...")
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
