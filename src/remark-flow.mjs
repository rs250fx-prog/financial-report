import { visit } from 'unist-util-visit';

/**
 * 本文中の「資金　A → B」という行を、資金フロー表示に変換する remark プラグイン。
 *
 *   資金　株・短期資金 → 米国債
 *     ↓
 *   <p class="flow">
 *     <span class="flow-label">資金</span>
 *     <span class="flow-node">株・短期資金</span>
 *     <span class="flow-arrow">→</span>
 *     <span class="flow-node">米国債</span>
 *   </p>
 *
 * 執筆側の書式は変えない。レポートは note にも流用するため、
 * 素の Markdown として読んでも意味が通る形を保つ必要がある。
 */

// 「資金」＋全角/半角スペース で始まる段落だけを対象にする
const HEAD = /^資金[ 　]+(.+)$/;

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 段落の子ノードを平文に潰す。対象行は装飾を含まない前提 */
function plainText(node) {
  let out = '';
  visit(node, (child) => {
    if (child.type === 'text' || child.type === 'inlineCode') out += child.value;
  });
  return out;
}

export function remarkFlow() {
  return (tree) => {
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === null) return;

      const match = HEAD.exec(plainText(node).trim());
      if (!match) return;

      // 矢印で分割。全角矢印・半角矢印の両方を受ける
      const nodes = match[1]
        .split(/\s*(?:→|->|⇒)\s*/)
        .map((s) => s.trim())
        .filter(Boolean);

      // 矢印がなければ通常の段落のまま残す（誤爆を避ける）
      if (nodes.length < 2) return;

      const chain = nodes
        .map((n) => `<span class="flow-node">${escapeHtml(n)}</span>`)
        .join('<span class="flow-arrow" aria-hidden="true">→</span>');

      parent.children[index] = {
        type: 'html',
        value:
          `<p class="flow">` +
          `<span class="flow-label">資金</span>` +
          `<span class="flow-chain">${chain}</span>` +
          `</p>`,
      };
    });
  };
}
