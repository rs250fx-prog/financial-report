import { visit } from 'unist-util-visit';

/**
 * 日本語で閉じられなかった強調記号を救済する remark プラグイン。
 *
 * CommonMark の flanking 規則では、閉じ側の `**` は
 *   「直前が句読点」かつ「直後が非空白・非句読点」
 * のとき right-flanking と判定されず、強調を閉じられない。
 *
 *   **……である。**次に  → 閉じられない（アスタリスクがそのまま出る）
 *   **……である。** 次に → 閉じられる（半角スペースがあるため）
 *
 * 英語では閉じ括弧の直後に文字が続くことが稀なので表面化しないが、
 * 日本語は句点のあとに空白を置かないため、ごく普通の文章で起きる。
 *
 * 本文にアスタリスクが出ることは、体裁の問題であると同時に
 * 「生成物をそのまま貼った」という印象を与えるため、媒体として許容しない。
 *
 * 解析後の text ノードに残っている `**` は、定義上すべて
 * 「閉じられなかった強調」である。正しく解析されたものは既に
 * strong ノードになっていて text ノードには現れない。
 * したがって、ここでの置換は誤爆しない。
 *
 * remarkFlow より先に動かす必要がある。あちらは段落を平文へ潰すため、
 * 残ったアスタリスクをそのまま HTML へ書き出してしまう。
 */

/**
 * `**…**` → strong、`*…*` → emphasis。区切りの内側に空白を許さない。
 *
 * 正規表現は呼び出しごとに作る。`g` 付きの正規表現は lastIndex を持つので、
 * 使い回すと再帰呼び出しが外側のループの位置を壊す（無限ループになる）。
 */
const PATTERNS = [
  { src: String.raw`\*\*(\S(?:[^*]*\S)?)\*\*`, type: 'strong' },
  { src: String.raw`\*(\S(?:[^*]*\S)?)\*`, type: 'emphasis' },
];

/** 1つの text ノードを、強調を復元したノード配列に展開する */
function expand(value) {
  for (const { src, type } of PATTERNS) {
    const re = new RegExp(src, 'g');
    if (!re.test(value)) continue;
    re.lastIndex = 0;

    const out = [];
    let at = 0;
    let m;
    while ((m = re.exec(value)) !== null) {
      if (m.index > at) out.push({ type: 'text', value: value.slice(at, m.index) });
      // 内側にさらに別種の記号が残ることがあるため再帰的に処理する
      out.push({ type, children: expand(m[1]) });
      at = m.index + m[0].length;
    }
    if (at < value.length) out.push({ type: 'text', value: value.slice(at) });
    return out;
  }
  return [{ type: 'text', value }];
}

export function remarkStrongFix() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null || !node.value.includes('*')) return;
      const nodes = expand(node.value);
      if (nodes.length === 1 && nodes[0].type === 'text') return;
      parent.children.splice(index, 1, ...nodes);
      return index + nodes.length;
    });
  };
}
