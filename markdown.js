function ensureEmojiPresentation(value) {
  return String(value || "").replace(
    /\p{Extended_Pictographic}(?:[\uFE0E\uFE0F])?/gu,
    (match) => {
      if (match.endsWith("\uFE0E") || match.endsWith("\uFE0F")) return match;
      return /^\p{Emoji_Presentation}$/u.test(match) ? match : `${match}\uFE0F`;
    }
  );
}

function createMarkdownTextNode(value) {
  return document.createTextNode(ensureEmojiPresentation(value));
}

function appendMarkdownInline(parent, source) {
  const patterns = [
    {
      regex: /`([^`\n]+)`/,
      create(match) {
        const code = document.createElement("code");
        code.textContent = match[1];
        return code;
      }
    },
    {
      regex: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
      create(match) {
        const link = document.createElement("a");
        link.href = match[2];
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        appendMarkdownInline(link, match[1]);
        return link;
      }
    },
    {
      regex: /\*\*([^*\n]+)\*\*/,
      create(match) {
        const strong = document.createElement("strong");
        appendMarkdownInline(strong, match[1]);
        return strong;
      }
    },
    {
      regex: /__([^_\n]+)__/,
      create(match) {
        const strong = document.createElement("strong");
        appendMarkdownInline(strong, match[1]);
        return strong;
      }
    },
    {
      regex: /~~([^~\n]+)~~/,
      create(match) {
        const strike = document.createElement("s");
        appendMarkdownInline(strike, match[1]);
        return strike;
      }
    },
    {
      regex: /\*([^*\n]+)\*/,
      create(match) {
        const emphasis = document.createElement("em");
        appendMarkdownInline(emphasis, match[1]);
        return emphasis;
      }
    }
  ];

  let remaining = source;
  while (remaining) {
    let selected = null;

    patterns.forEach((pattern, priority) => {
      const match = pattern.regex.exec(remaining);
      if (!match) return;
      if (!selected || match.index < selected.match.index ||
          (match.index === selected.match.index && priority < selected.priority)) {
        selected = { pattern, match, priority };
      }
    });

    if (!selected) {
      parent.append(createMarkdownTextNode(remaining));
      break;
    }

    if (selected.match.index > 0) {
      parent.append(createMarkdownTextNode(remaining.slice(0, selected.match.index)));
    }
    parent.append(selected.pattern.create(selected.match));
    remaining = remaining.slice(selected.match.index + selected.match[0].length);
  }
}

function isMarkdownBlockStart(line) {
  return /^(?:#{1,3}\s+|>\s?|```|(?:[-*+]\s+)|(?:\d+\.\s+)|(?:-{3,}\s*$))/.test(line);
}

function renderMarkdown(target, source) {
  target.replaceChildren();
  const text = String(source || "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return;

  const lines = text.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      if (language) code.dataset.language = language;
      code.textContent = codeLines.join("\n");
      pre.append(code);
      target.append(pre);
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const heading = document.createElement(`h${headingMatch[1].length + 2}`);
      appendMarkdownInline(heading, headingMatch[2]);
      target.append(heading);
      index += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(line)) {
      target.append(document.createElement("hr"));
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      const quote = document.createElement("blockquote");
      quoteLines.forEach((quoteLine, quoteIndex) => {
        appendMarkdownInline(quote, quoteLine);
        if (quoteIndex < quoteLines.length - 1) quote.append(document.createElement("br"));
      });
      target.append(quote);
      continue;
    }

    const unordered = /^\s*[-*+]\s+/.test(line);
    const ordered = /^\s*\d+\.\s+/.test(line);
    if (unordered || ordered) {
      const list = document.createElement(ordered ? "ol" : "ul");
      const itemPattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;

      while (index < lines.length) {
        const itemMatch = itemPattern.exec(lines[index]);
        if (!itemMatch) break;
        const item = document.createElement("li");
        const checkboxMatch = /^\[([ xX])\]\s+(.+)$/.exec(itemMatch[1]);

        if (checkboxMatch) {
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = checkboxMatch[1].toLowerCase() === "x";
          checkbox.disabled = true;
          item.className = "markdown-task-item";
          item.append(checkbox);
          appendMarkdownInline(item, checkboxMatch[2]);
        } else {
          appendMarkdownInline(item, itemMatch[1]);
        }
        list.append(item);
        index += 1;
      }
      target.append(list);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    const paragraph = document.createElement("p");
    paragraphLines.forEach((paragraphLine, paragraphIndex) => {
      appendMarkdownInline(paragraph, paragraphLine);
      if (paragraphIndex < paragraphLines.length - 1) paragraph.append(document.createElement("br"));
    });
    target.append(paragraph);
  }
}

function getLineIndentAt(value, position) {
  const lineStart = position === 0
    ? 0
    : value.lastIndexOf("\n", position - 1) + 1;
  const indent = /^[\t ]*/.exec(value.slice(lineStart, position));
  return indent ? indent[0] : "";
}

function enableMarkdownMulticursor(textarea) {
  if (textarea.__markdownMulticursor) return textarea.__markdownMulticursor;

  const shell = document.createElement("div");
  shell.className = "multicursor-shell";
  textarea.parentNode.insertBefore(shell, textarea);
  shell.append(textarea);

  const mirror = document.createElement("div");
  mirror.className = "multicursor-mirror";
  const layer = document.createElement("div");
  layer.className = "multicursor-layer";
  const badge = document.createElement("span");
  badge.className = "multicursor-badge";
  badge.hidden = true;
  shell.append(mirror, layer, badge);

  let extraCursors = [];
  let primaryBeforeAltClick = 0;
  let beforeInputState = null;
  let applyingEdits = false;

  function uniqueCursors(cursors, primary = textarea.selectionStart) {
    return [...new Set(cursors)]
      .filter((position) => Number.isInteger(position))
      .map((position) => Math.max(0, Math.min(textarea.value.length, position)))
      .filter((position) => position !== primary)
      .sort((a, b) => a - b);
  }

  function syncMirrorStyle() {
    const style = getComputedStyle(textarea);
    mirror.style.width = `${textarea.offsetWidth}px`;
    mirror.style.font = style.font;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.letterSpacing = style.letterSpacing;
    mirror.style.padding = style.padding;
    mirror.style.borderWidth = style.borderWidth;
    mirror.style.boxSizing = style.boxSizing;
    mirror.style.overflowWrap = style.overflowWrap;
    mirror.style.wordBreak = style.wordBreak;
    return style;
  }

  function getCaretPosition(position, style) {
    mirror.replaceChildren(document.createTextNode(textarea.value.slice(0, position)));
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.append(marker);

    const lineHeight = Number.parseFloat(style.lineHeight) ||
      Number.parseFloat(style.fontSize) * 1.5;
    return {
      left: marker.offsetLeft - textarea.scrollLeft,
      top: marker.offsetTop - textarea.scrollTop,
      height: lineHeight
    };
  }

  function renderCursors() {
    const style = syncMirrorStyle();
    extraCursors = uniqueCursors(extraCursors);
    layer.replaceChildren(...extraCursors.map((position) => {
      const coordinates = getCaretPosition(position, style);
      const caret = document.createElement("span");
      caret.className = "multicursor-caret";
      caret.style.left = `${coordinates.left}px`;
      caret.style.top = `${coordinates.top}px`;
      caret.style.height = `${coordinates.height}px`;
      return caret;
    }));

    const cursorCount = extraCursors.length + 1;
    badge.textContent = `${cursorCount}カーソル`;
    badge.hidden = extraCursors.length === 0;
    shell.classList.toggle("has-multicursor", extraCursors.length > 0);
  }

  function applyEdits(edits) {
    beforeInputState = null;
    const original = textarea.value;
    const grouped = new Map();

    edits.forEach((edit) => {
      const start = Math.max(0, Math.min(original.length, edit.start));
      const end = Math.max(start, Math.min(original.length, edit.end));
      const key = `${start}:${end}:${edit.text}`;
      if (!grouped.has(key)) {
        grouped.set(key, { start, end, text: edit.text, ids: [] });
      }
      grouped.get(key).ids.push(edit.id);
    });

    const ordered = [...grouped.values()].sort((a, b) =>
      a.start - b.start || a.end - b.end
    );
    const cursorPositions = new Map();
    let result = "";
    let consumedUntil = 0;

    ordered.forEach((edit) => {
      if (edit.start < consumedUntil) {
        edit.ids.forEach((id) => cursorPositions.set(id, result.length));
        return;
      }
      result += original.slice(consumedUntil, edit.start);
      result += edit.text;
      edit.ids.forEach((id) => cursorPositions.set(id, result.length));
      consumedUntil = edit.end;
    });
    result += original.slice(consumedUntil);

    applyingEdits = true;
    textarea.value = result;
    const primaryPosition = cursorPositions.get(0) ?? textarea.selectionStart;
    textarea.setSelectionRange(primaryPosition, primaryPosition);
    extraCursors = uniqueCursors(
      edits
        .filter((edit) => edit.id !== 0)
        .map((edit) => cursorPositions.get(edit.id))
        .filter((position) => position !== undefined),
      primaryPosition
    );
    applyingEdits = false;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    renderCursors();
  }

  function editEveryCursor(type, text = "") {
    const cursors = [textarea.selectionStart, ...extraCursors];
    const valueLength = textarea.value.length;
    const edits = cursors.map((position, id) => {
      if (type === "backward") {
        return { id, start: Math.max(0, position - 1), end: position, text: "" };
      }
      if (type === "forward") {
        return { id, start: position, end: Math.min(valueLength, position + 1), text: "" };
      }
      return { id, start: position, end: position, text };
    });
    applyEdits(edits);
  }

  function insertNewlineEveryCursor() {
    const cursors = [textarea.selectionStart, ...extraCursors];
    const edits = cursors.map((position, id) => ({
      id,
      start: id === 0 ? textarea.selectionStart : position,
      end: id === 0 ? textarea.selectionEnd : position,
      text: `\n${getLineIndentAt(textarea.value, position)}`
    }));
    applyEdits(edits);
  }

  function outdentEveryCursor() {
    const cursors = [textarea.selectionStart, ...extraCursors];
    const edits = cursors.map((position, id) => {
      const lineStart = position === 0
        ? 0
        : textarea.value.lastIndexOf("\n", position - 1) + 1;
      const line = textarea.value.slice(lineStart);
      const indent = /^(?:\t| {1,4})/.exec(line);
      return {
        id,
        start: lineStart,
        end: lineStart + (indent ? indent[0].length : 0),
        text: ""
      };
    });
    applyEdits(edits);
  }

  function moveCursor(position, key, byWord) {
    const value = textarea.value;
    const lineStart = position === 0
      ? 0
      : value.lastIndexOf("\n", position - 1) + 1;
    const nextBreak = value.indexOf("\n", position);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;

    if (key === "ArrowLeft") {
      if (!byWord) return Math.max(0, position - 1);
      let target = position;
      while (target > 0 && /\s/.test(value[target - 1])) target -= 1;
      while (target > 0 && !/\s/.test(value[target - 1])) target -= 1;
      return target;
    }

    if (key === "ArrowRight") {
      if (!byWord) return Math.min(value.length, position + 1);
      let target = position;
      while (target < value.length && !/\s/.test(value[target])) target += 1;
      while (target < value.length && /\s/.test(value[target])) target += 1;
      return target;
    }

    if (key === "Home") return byWord ? 0 : lineStart;
    if (key === "End") return byWord ? value.length : lineEnd;

    const column = position - lineStart;
    if (key === "ArrowUp") {
      if (lineStart === 0) return position;
      const previousLineEnd = lineStart - 1;
      const previousLineStart = previousLineEnd === 0
        ? 0
        : value.lastIndexOf("\n", previousLineEnd - 1) + 1;
      return previousLineStart + Math.min(
        column,
        previousLineEnd - previousLineStart
      );
    }

    if (key === "ArrowDown") {
      if (lineEnd === value.length) return position;
      const nextLineStart = lineEnd + 1;
      const followingBreak = value.indexOf("\n", nextLineStart);
      const nextLineEnd = followingBreak === -1 ? value.length : followingBreak;
      return nextLineStart + Math.min(column, nextLineEnd - nextLineStart);
    }

    return position;
  }

  function moveEveryCursor(key, byWord = false) {
    const positions = [textarea.selectionStart, ...extraCursors]
      .map((position) => moveCursor(position, key, byWord));
    const primaryPosition = positions[0];
    textarea.setSelectionRange(primaryPosition, primaryPosition);
    extraCursors = uniqueCursors(positions.slice(1), primaryPosition);
    renderCursors();
  }

  function clearCursors() {
    extraCursors = [];
    beforeInputState = null;
    renderCursors();
  }

  const controller = {
    hasExtraCursors() {
      return extraCursors.length > 0;
    },
    insertText(text) {
      editEveryCursor("insert", text);
    },
    outdent() {
      outdentEveryCursor();
    },
    move(key, byWord) {
      moveEveryCursor(key, byWord);
    },
    clear: clearCursors
  };
  textarea.__markdownMulticursor = controller;

  textarea.addEventListener("mousedown", (event) => {
    primaryBeforeAltClick = textarea.selectionStart;
    if (!event.altKey) clearCursors();
  });

  textarea.addEventListener("click", (event) => {
    if (!event.altKey) return;
    const clickedPosition = textarea.selectionStart;
    extraCursors = uniqueCursors(
      [...extraCursors, primaryBeforeAltClick],
      clickedPosition
    );
    renderCursors();
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && extraCursors.length > 0) {
      event.preventDefault();
      clearCursors();
      return;
    }

    const movementKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End"
    ];
    if (
      extraCursors.length > 0 &&
      movementKeys.includes(event.key) &&
      !event.altKey
    ) {
      event.preventDefault();
      moveEveryCursor(event.key, event.ctrlKey || event.metaKey);
      return;
    }

    if (extraCursors.length === 0 || event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key.length === 1) {
      event.preventDefault();
      editEveryCursor("insert", event.key);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertNewlineEveryCursor();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      editEveryCursor("backward");
    } else if (event.key === "Delete") {
      event.preventDefault();
      editEveryCursor("forward");
    }
  });

  textarea.addEventListener("paste", (event) => {
    if (extraCursors.length === 0) return;
    event.preventDefault();
    editEveryCursor("insert", event.clipboardData.getData("text/plain"));
  });

  textarea.addEventListener("beforeinput", (event) => {
    if (extraCursors.length === 0 || applyingEdits) return;
    beforeInputState = {
      value: textarea.value,
      primaryStart: textarea.selectionStart,
      primaryEnd: textarea.selectionEnd,
      extras: [...extraCursors],
      inputType: event.inputType
    };
  });

  textarea.addEventListener("input", () => {
    if (applyingEdits || !beforeInputState || beforeInputState.extras.length === 0) {
      renderCursors();
      return;
    }

    const currentValue = textarea.value;
    const original = beforeInputState.value;
    let prefix = 0;
    while (
      prefix < original.length &&
      prefix < currentValue.length &&
      original[prefix] === currentValue[prefix]
    ) {
      prefix += 1;
    }

    let originalEnd = original.length;
    let currentEnd = currentValue.length;
    while (
      originalEnd > prefix &&
      currentEnd > prefix &&
      original[originalEnd - 1] === currentValue[currentEnd - 1]
    ) {
      originalEnd -= 1;
      currentEnd -= 1;
    }

    const insertedText = currentValue.slice(prefix, currentEnd);
    const removedLength = originalEnd - prefix;
    const inputType = beforeInputState.inputType;
    const edits = [{
      id: 0,
      start: prefix,
      end: originalEnd,
      text: insertedText
    }];

    beforeInputState.extras.forEach((position, extraIndex) => {
      let start = position;
      let end = position;
      if (inputType === "deleteContentBackward") {
        start = Math.max(0, position - Math.max(1, removedLength));
      } else if (inputType === "deleteContentForward") {
        end = Math.min(original.length, position + Math.max(1, removedLength));
      } else if (removedLength > 0 && beforeInputState.primaryStart === beforeInputState.primaryEnd) {
        start = Math.max(0, position + prefix - beforeInputState.primaryStart);
        end = Math.min(original.length, start + removedLength);
      }
      edits.push({
        id: extraIndex + 1,
        start,
        end,
        text: insertedText
      });
    });

    applyingEdits = true;
    textarea.value = original;
    applyingEdits = false;
    beforeInputState = null;
    applyEdits(edits);
  });

  textarea.addEventListener("scroll", renderCursors);
  textarea.addEventListener("keyup", renderCursors);
  window.addEventListener("resize", renderCursors);
  renderCursors();
  return controller;
}

function enableMarkdownTabInput(textarea) {
  const multicursor = enableMarkdownMulticursor(textarea);

  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || multicursor.hasExtraCursors()) return;
    event.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const indent = getLineIndentAt(textarea.value, start);
    textarea.setRangeText(`\n${indent}`, start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();

    if (multicursor.hasExtraCursors()) {
      if (event.shiftKey) {
        multicursor.outdent();
      } else {
        multicursor.insertText("\t");
      }
      return;
    }

    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = start === 0
      ? 0
      : value.lastIndexOf("\n", start - 1) + 1;
    const nextBreak = value.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const spansMultipleLines = value.slice(start, end).includes("\n");

    if (spansMultipleLines) {
      const selectedLines = value.slice(lineStart, lineEnd);
      const replacement = event.shiftKey
        ? selectedLines.replace(/^(?:\t| {1,4})/gm, "")
        : selectedLines.replace(/^/gm, "\t");

      textarea.setRangeText(replacement, lineStart, lineEnd, "select");
    } else if (event.shiftKey) {
      const currentLine = value.slice(lineStart, lineEnd);
      const removableIndent = /^(?:\t| {1,4})/.exec(currentLine);

      if (removableIndent) {
        textarea.setRangeText(
          "",
          lineStart,
          lineStart + removableIndent[0].length,
          "preserve"
        );
      }
    } else {
      textarea.setRangeText("\t", start, end, "end");
    }

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function enableAutoResizeTextarea(textarea) {
  const resize = () => {
    const borderHeight = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
  };

  textarea.addEventListener("input", resize);
  window.addEventListener("resize", resize);
  resize();
  return resize;
}

function getSelectionEndWithoutTrailingSpacing(value, start, end) {
  let trimmedEnd = end;
  while (trimmedEnd > start && /[\t \u3000]/.test(value[trimmedEnd - 1])) {
    trimmedEnd -= 1;
  }
  return trimmedEnd;
}

function trimTrailingSpacingFromSelection(textarea) {
  const trimmedEnd = getSelectionEndWithoutTrailingSpacing(
    textarea.value,
    textarea.selectionStart,
    textarea.selectionEnd
  );
  if (trimmedEnd !== textarea.selectionEnd) {
    textarea.setSelectionRange(textarea.selectionStart, trimmedEnd);
  }
}
