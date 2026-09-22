import { visit } from 'unist-util-visit';

/**
 * 本文中の「資金の流れ」を表す行を、フロー表示に変換する remark プラグイン。
 *
 * 執筆側の書式は変えない。レポートは note にも流用するため、
 * 素の Markdown として読んでも意味が通る形を保つ必要がある。
 *
 * 変換する3種類:
 *
 *   1. 資金フロー      資金　株・短期資金 → 米国債
 *   2. 因果チェーン    → 原油続落 → 金利低下継続 → 株高継続。残りは注記
 *   3. 本日の総括      **原油 → 米国債 → ハイテク株**（段落全体が太字）
 *
 * 矢印を含まない行は変換しない（「→ 総括：…」のような結論行は
 * 連鎖ではないため、別の見た目で出す）。
 */

/** 「資金」＋全角/半角スペース で始まる行 */
const FUNDS = /^資金[ 　]+(.+)$/;
/** 「→」で始まる行 */
const CHAIN = /^(?:→|->|⇒)\s*(.+)$/;
/** 矢印の区切り */
const ARROW = /\s*(?:→|->|⇒)\s*/;

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 段落の子ノードを平文に潰す */
function plainText(node) {
  let out = '';
  visit(node, (child) => {
    if (child.type === 'text' || child.type === 'inlineCode') out += child.value;
  });
  return out;
}

/**
 * 連鎖の最終要素は「株高継続。金は…を試す。」のように
 * 注記が続くことがある。最初の句点で切り、後半を注記として分離する。
 */
function splitTail(last) {
  const at = last.indexOf('。');
  if (at === -1 || at === last.length - 1) return [last.replace(/。$/, ''), ''];
  return [last.slice(0, at), last.slice(at + 1)];
}

/** 矢印で分割し、ノード配列と注記に分ける。連鎖でなければ null */
function parseChain(body) {
  const parts = body.split(ARROW).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const [lastNode, note] = splitTail(parts.pop());
  return { nodes: [...parts, lastNode].filter(Boolean), note: note.trim() };
}

function renderChain({ nodes, note }, { label, variant } = {}) {
  const chain = nodes
    .map((n) => `<span class="flow-node">${escapeHtml(n)}</span>`)
    .join('<span class="flow-arrow" aria-hidden="true">→</span>');

  return (
    `<div class="flow${variant ? ` ${variant}` : ''}">` +
    `<div class="flow-line">` +
    (label ? `<span class="flow-label">${escapeHtml(label)}</span>` : '') +
    `<span class="flow-chain">${chain}</span>` +
    `</div>` +
    (note ? `<p class="flow-note">${escapeHtml(note)}</p>` : '') +
    `</div>`
  );
}

export function remarkFlow() {
  return (tree) => {
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === null) return;

      const text = plainText(node).trim();
      if (!text) return;

      // 3. 段落全体が太字で、矢印を含む行を「本日の総括」として扱う
      const onlyStrong =
        node.children.length === 1 && node.children[0].type === 'strong';
      if (onlyStrong) {
        const parsed = parseChain(text);
        if (!parsed) return;
        parent.children[index] = {
          type: 'html',
          value: renderChain(parsed, { variant: 'flow-primary' }),
        };
        return;
      }

      // 1. 資金フロー
      const funds = FUNDS.exec(text);
      if (funds) {
        const parsed = parseChain(funds[1]);
        if (!parsed) return; // 矢印がなければ通常の段落のまま（誤爆を避ける）
        parent.children[index] = {
          type: 'html',
          value: renderChain(parsed, { label: '資金' }),
        };
        return;
      }

      // 2. 因果チェーン。矢印が1つしかない結論行は連鎖ではないので別扱い
      const chain = CHAIN.exec(text);
      if (chain) {
        const parsed = parseChain(chain[1]);
        if (parsed) {
          parent.children[index] = {
            type: 'html',
            value: renderChain(parsed, { variant: 'flow-causal' }),
          };
        } else {
          parent.children[index] = {
            type: 'html',
            value:
              `<p class="flow-lead">` +
              `<span class="flow-arrow" aria-hidden="true">→</span>` +
              `<span>${escapeHtml(chain[1])}</span>` +
              `</p>`,
          };
        }
      }
    });
  };
}
