// Search-time normalization for the task search.
//
// Task data is never rewritten: text is normalized only while searching, so
// notation variants such as "HU300" / "HU-300" / "HU 300" / "HU_300" /
// "ＨＵ３００" / "hu300" are treated as the same word.
//
//   1. Unicode NFKC (full-width → half-width, half-width kana → full-width)
//   2. lower-casing
//   3. removal of separators (whitespace, hyphen/dash variants, underscore)
//
// The Japanese prolonged sound mark "ー" is intentionally kept so that
// Japanese words such as "センサー" are not damaged.
//
// Each indexed text keeps a map from normalized characters back to the
// original string so matches can still be highlighted in the original text,
// and remembers where separators were removed so that a model number such as
// "HU300" does not match inside "HU3000" (but still matches "HU300 3000").

const SEARCH_SEPARATOR_PATTERN = /^[\s\-_\u2010-\u2015\u2212\u2043\uFE58\uFE63\uFF0D\uFF3F]+$/u;
const SEARCH_COMBINING_PATTERN = /^\p{M}/u;
const SEARCH_DIGIT_PATTERN = /\p{Nd}/u;
const SEARCH_LETTER_PATTERN = /\p{L}/u;
const SEARCH_INDEX_CACHE_LIMIT = 20000;
const searchIndexCache = new Map();
const searchCharCache = new Map();

function normalizeSearchChunk(chunk) {
  if (chunk.length === 1 && chunk.charCodeAt(0) < 0x80) return chunk.toLowerCase();
  return chunk.normalize("NFKC").toLowerCase();
}

const SEARCH_CHAR_PLAIN = 0;
const SEARCH_CHAR_SEPARATOR = 1;
const SEARCH_CHAR_COMBINING = 2;

// Per-character results repeat a lot (Japanese text especially), so the
// normalized form and its kind are memoized; distinct characters are few.
function classifySearchChar(char) {
  let entry = searchCharCache.get(char);
  if (entry === undefined) {
    const norm = normalizeSearchChunk(char);
    let kind = SEARCH_CHAR_PLAIN;
    if (isSearchSeparator(norm)) kind = SEARCH_CHAR_SEPARATOR;
    else if (SEARCH_COMBINING_PATTERN.test(norm)) kind = SEARCH_CHAR_COMBINING;
    entry = { norm, kind };
    if (searchCharCache.size >= SEARCH_INDEX_CACHE_LIMIT) searchCharCache.clear();
    searchCharCache.set(char, entry);
  }
  return entry;
}

function isSearchSeparator(normalizedChunk) {
  return normalizedChunk === "" || SEARCH_SEPARATOR_PATTERN.test(normalizedChunk);
}

function isSearchDigit(char) {
  return Boolean(char) && SEARCH_DIGIT_PATTERN.test(char);
}

// Builds (and caches) the normalized form of `text` together with:
//   srcStart/srcEnd: original [start, end) range for each normalized char
//   gapBefore:       1 when a separator was removed right before that char
function createSearchIndex(text) {
  const source = String(text ?? "");
  const cached = searchIndexCache.get(source);
  if (cached) return cached;

  const parts = [];
  const srcStart = [];
  const srcEnd = [];
  const gapBefore = [];
  let pendingGap = false;
  let lastStart = -1; // original start of the last kept character group
  let lastLength = 0; // normalized length of that group
  let index = 0;
  for (const char of source) {
    const start = index;
    index += char.length;
    const { norm, kind } = classifySearchChar(char);
    if (kind === SEARCH_CHAR_COMBINING && lastStart >= 0 && !pendingGap) {
      // Recompose with the preceding character so e.g. half-width "ﾊﾟ"
      // becomes "パ" exactly like a whole-string NFKC would.
      const combined = normalizeSearchChunk(source.slice(lastStart, index));
      parts.splice(parts.length - lastLength, lastLength, ...combined);
      srcStart.length -= lastLength;
      srcEnd.length -= lastLength;
      const hadGap = gapBefore[gapBefore.length - lastLength] === 1;
      gapBefore.length -= lastLength;
      for (let offset = 0; offset < combined.length; offset += 1) {
        srcStart.push(lastStart);
        srcEnd.push(index);
        gapBefore.push(offset === 0 && hadGap ? 1 : 0);
      }
      lastLength = combined.length;
      continue;
    }
    if (kind === SEARCH_CHAR_SEPARATOR) {
      pendingGap = true;
      continue;
    }
    for (let offset = 0; offset < norm.length; offset += 1) {
      parts.push(norm[offset]);
      srcStart.push(start);
      srcEnd.push(index);
      gapBefore.push(offset === 0 && pendingGap ? 1 : 0);
    }
    lastStart = start;
    lastLength = norm.length;
    pendingGap = false;
  }

  // Typed arrays keep the cached indexes compact when there are many tasks.
  const result = {
    text: source,
    norm: parts.join(""),
    srcStart: Uint32Array.from(srcStart),
    srcEnd: Uint32Array.from(srcEnd),
    gapBefore: Uint8Array.from(gapBefore)
  };
  if (searchIndexCache.size >= SEARCH_INDEX_CACHE_LIMIT) searchIndexCache.clear();
  searchIndexCache.set(source, result);
  return result;
}

function normalizeSearchText(text) {
  return createSearchIndex(text).norm;
}

function createSearchKeyword(rawToken) {
  const norm = normalizeSearchText(rawToken);
  return {
    raw: String(rawToken).toLowerCase(),
    norm,
    // Model-number-like keywords (letters + digits) must not continue into
    // further digits: "HU300" must not hit "HU3000".  Pure numbers keep the
    // plain substring behaviour so Task番号 / date fragments still work.
    guardDigits: SEARCH_LETTER_PATTERN.test(norm) && SEARCH_DIGIT_PATTERN.test(norm)
  };
}

// Splits the query into whitespace-separated keywords (order independent,
// all must match).  The whole query with separators removed is also kept, so
// "HU 300" can match "HU300" as a single word.
function parseSearchQuery(rawQuery) {
  const trimmed = String(rawQuery ?? "").trim();
  const seen = new Set();
  const keywords = trimmed
    .normalize("NFKC")
    .split(/\s+/u)
    .map(createSearchKeyword)
    .filter((keyword) => {
      if (!keyword.norm || seen.has(keyword.norm)) return false;
      seen.add(keyword.norm);
      return true;
    });
  return {
    raw: trimmed,
    lower: trimmed.toLowerCase(),
    keywords,
    joined: createSearchKeyword(trimmed)
  };
}

function isValidSearchMatch(index, keyword, start, end) {
  if (!keyword.guardDigits) return true;
  const { norm, gapBefore } = index;
  if (isSearchDigit(keyword.norm[keyword.norm.length - 1])
      && end < norm.length && !gapBefore[end] && isSearchDigit(norm[end])) {
    return false;
  }
  if (isSearchDigit(keyword.norm[0])
      && start > 0 && !gapBefore[start] && isSearchDigit(norm[start - 1])) {
    return false;
  }
  return true;
}

// Returns the [start, end) ranges (in normalized indices) where `keyword`
// occurs in `index`.  Stops after the first hit when `firstOnly` is set.
function findSearchKeywordRanges(index, keyword, firstOnly = false) {
  const ranges = [];
  if (!keyword.norm) return ranges;
  let position = index.norm.indexOf(keyword.norm);
  while (position >= 0) {
    const end = position + keyword.norm.length;
    if (isValidSearchMatch(index, keyword, position, end)) {
      ranges.push([position, end]);
      if (firstOnly) break;
    }
    position = index.norm.indexOf(keyword.norm, position + 1);
  }
  return ranges;
}

function searchTextHasKeyword(text, keyword) {
  return findSearchKeywordRanges(createSearchIndex(text), keyword, true).length > 0;
}

// True when every keyword is found in at least one of `texts` (keywords may
// be spread across fields), or the whole query is found as one word.
function searchTextsMatchQuery(texts, query) {
  if (!query.keywords.length) return false;
  const everyKeyword = query.keywords.every((keyword) =>
    texts.some((text) => searchTextHasKeyword(text, keyword)));
  if (everyKeyword) return true;
  return query.keywords.length > 1 && texts.some((text) => searchTextHasKeyword(text, query.joined));
}

// Relevance tier of a task for `query` (smaller is better):
//   0 = a field equals the query exactly (case-insensitive)
//   1 = a field equals the query after normalization
//   2 = every keyword appears literally (case-insensitive partial match)
//   3 = partial match found only after normalization
function getSearchMatchTier(texts, query) {
  const values = texts.map((text) => String(text ?? ""));
  if (values.some((value) => value.trim().toLowerCase() === query.lower)) return 0;
  if (query.joined.norm && values.some((value) => normalizeSearchText(value) === query.joined.norm)) return 1;
  const lowerValues = values.map((value) => value.toLowerCase());
  const literalTokens = query.lower.split(/\s+/u).filter(Boolean);
  const literal = literalTokens.length > 0
    && literalTokens.every((token) => lowerValues.some((value) => value.includes(token)));
  return literal ? 2 : 3;
}

// Highlight ranges in the ORIGINAL `text`, merged and sorted.
function getSearchHighlightRanges(text, query) {
  const index = createSearchIndex(text);
  const ranges = [];
  [...query.keywords, query.joined].forEach((keyword) => {
    findSearchKeywordRanges(index, keyword).forEach(([start, end]) => {
      ranges.push([index.srcStart[start], index.srcEnd[end - 1]]);
    });
  });
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  ranges.forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  });
  return merged;
}
