import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** 上昇・下落・変わらず。数値の着色に使う */
const direction = z.enum(['up', 'down', 'flat']).default('flat');

/**
 * マーケット・スナップショット1枠。
 * value / change は文字列で受ける（"4.118%" "−3.2bp" のように
 * 単位がまちまちで、計算には使わず表示するだけのため）。
 */
const quote = z.object({
  label: z.string(),
  value: z.string(),
  change: z.string(),
  dir: direction,
});

/**
 * デイリーレポート。
 * ファイル名 = スラッグ = 日付（例: src/content/reports/2026-09-22.md）
 */
const reports = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/reports' }),
  schema: z.object({
    /** 号数。マストヘッドと一覧に出る通し番号 */
    no: z.number(),
    title: z.string(),
    /** リード文。TOPのヒーローと一覧の抜粋に使う */
    deck: z.string(),
    /** 発行日 'YYYY-MM-DD' */
    date: z.string(),
    updated: z.string().optional(),

    /** 本日の要点。TOPのサイドバーに 01..04 として並ぶ。3〜5件を想定 */
    points: z.array(z.string()).default([]),

    /** マーケット・スナップショット。TOPのグリッドとティッカーの供給元 */
    snapshot: z.array(quote).default([]),

    /**
     * 一覧の右端に出す代表値（通常は XAU/USD の変化率）。
     * 日次ログを「読み物の一覧」ではなく「記録」に見せるための1カラム。
     */
    headline: z
      .object({ value: z.string(), dir: direction })
      .optional(),

    tags: z.array(z.string()).default([]),

    // --- SEO ---
    description: z.string().default(''),
    keywords: z.array(z.string()).default([]),
    ogImage: z.string().optional(),

    // --- 公開制御 ---
    /** 下書き。ビルドに含めない */
    draft: z.boolean().default(false),
    /** URLでは見られるが、一覧・サイトマップに出さず noindex */
    unlisted: z.boolean().default(false),
    /**
     * 公開範囲。クローズ化フェーズで 'members' を使う。
     * 現時点では全て 'public'（members でも本文は出るが、
     * 一覧にバッジが付き、後から制御を差し込める場所を確保しておく）
     */
    access: z.enum(['public', 'members']).default('public'),
  }),
});

/**
 * 週次まとめ。
 * ファイル名 = スラッグ（例: src/content/weekly/2026-w38.md）
 */
const weekly = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/weekly' }),
  schema: z.object({
    /** ISO週番号 */
    week: z.number(),
    year: z.number(),
    title: z.string(),
    deck: z.string(),
    /** 対象期間 'YYYY-MM-DD' */
    start: z.string(),
    end: z.string(),
    /** 公開日。未指定なら end を使う */
    date: z.string().optional(),
    updated: z.string().optional(),

    /**
     * 各資産の週次パフォーマンス。日次の snapshot と違い、
     * 値だけでなく寸評（note）を持つ。週次の主役になる要素。
     */
    performance: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          change: z.string().default(''),
          dir: direction,
          /** 一言の解説。「4カ月ぶりに$100の大台突破」など */
          note: z.string().default(''),
        }),
      )
      .default([]),

    /**
     * 来週の主要スケジュール。日付ごとに予定を束ねる。
     * key: true の項目は★付きで強調される。
     */
    schedule: z
      .array(
        z.object({
          /** 'YYYY-MM-DD' */
          date: z.string(),
          items: z
            .array(
              z.object({
                label: z.string(),
                key: z.boolean().default(false),
              }),
            )
            .default([]),
        }),
      )
      .default([]),

    /** 来週のスタンス。冒頭に独立したブロックとして出る */
    bias: z.string().default(''),

    /** 今週の要点。日次の points と同じ扱い */
    points: z.array(z.string()).default([]),

    tags: z.array(z.string()).default([]),

    description: z.string().default(''),
    keywords: z.array(z.string()).default([]),
    ogImage: z.string().optional(),

    draft: z.boolean().default(false),
    unlisted: z.boolean().default(false),
    access: z.enum(['public', 'members']).default('public'),
  }),
});

export const collections = { reports, weekly };
