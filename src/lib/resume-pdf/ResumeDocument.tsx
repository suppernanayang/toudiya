import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import type { ParsedResume } from "./parse-resume-content";

const COLORS = {
  accent: "#115e59", // 深墨绿，跟产品品牌色呼应
  text: "#18211f",
  muted: "#4b5a56",
  line: "#d8e3df",
};

// 1 寸证件照标准比例（2.5cm × 3.5cm，约等于 295×413px），换算成 PDF 里的点数。
const AVATAR_WIDTH = 70;
const AVATAR_HEIGHT = Math.round((70 * 413) / 295); // ≈ 98

// 除了页边距（留白）以外的字号、行间距基准值。
// 内容偏多、需要压缩塞进 1 页时，会按 scale 系数整体缩放这些数值，
// 但页边距（page 的 padding）永远保持固定，不会被缩掉——
// 用户要的是"内容紧凑"，不是"留白变窄"。
const BASE = {
  nameFontSize: 22,
  nameMarginBottom: 4,
  subtitleFontSize: 10.5,
  subtitleMarginBottom: 4,
  contactFontSize: 9.5,
  headerDividerMargin: 14,
  sectionMarginBottom: 12,
  sectionTitleFontSize: 12,
  sectionTitleMarginBottom: 4,
  sectionTitlePaddingBottom: 3,
  entryMarginBottom: 6,
  entryHeaderFontSize: 10.5,
  entryDateFontSize: 9.5,
  bulletRowMarginTop: 2,
  bulletMarkFontSize: 10,
  bulletTextFontSize: 10,
  bodyTextFontSize: 10,
};

/** 缩放系数允许的范围，超出这个范围缩放没有意义（太小会小到不可读，太大没必要）。 */
export const MIN_RESUME_SCALE = 0.8;
export const MAX_RESUME_SCALE = 1.15;

function createStyles(scale: number) {
  const s = (value: number) => Math.round(value * scale * 100) / 100;

  return StyleSheet.create({
    page: {
      fontFamily: "NotoSansSC",
      color: COLORS.text,
      // 页边距：固定不随 scale 缩放。
      paddingTop: 36,
      paddingBottom: 36,
      paddingHorizontal: 40,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    headerText: {
      flexGrow: 1,
      flexShrink: 1,
      paddingRight: 16,
    },
    avatar: {
      width: AVATAR_WIDTH,
      height: AVATAR_HEIGHT,
      objectFit: "cover",
      borderRadius: 2,
    },
    name: {
      fontSize: s(BASE.nameFontSize),
      fontWeight: "bold",
      marginBottom: s(BASE.nameMarginBottom),
    },
    subtitle: {
      fontSize: s(BASE.subtitleFontSize),
      color: COLORS.muted,
      marginBottom: s(BASE.subtitleMarginBottom),
    },
    contactRow: {
      fontSize: s(BASE.contactFontSize),
      color: COLORS.muted,
    },
    headerDivider: {
      borderBottomWidth: 1.5,
      borderBottomColor: COLORS.accent,
      marginTop: s(BASE.headerDividerMargin),
      marginBottom: s(BASE.headerDividerMargin),
    },
    section: {
      marginBottom: s(BASE.sectionMarginBottom),
    },
    sectionTitle: {
      fontSize: s(BASE.sectionTitleFontSize),
      fontWeight: "bold",
      color: COLORS.accent,
      marginBottom: s(BASE.sectionTitleMarginBottom),
      paddingBottom: s(BASE.sectionTitlePaddingBottom),
      borderBottomWidth: 0.75,
      borderBottomColor: COLORS.line,
    },
    entry: {
      marginBottom: s(BASE.entryMarginBottom),
    },
    entryHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    entryHeaderText: {
      fontSize: s(BASE.entryHeaderFontSize),
      fontWeight: "bold",
      flexGrow: 1,
      flexShrink: 1,
      paddingRight: 8,
    },
    entryDateText: {
      fontSize: s(BASE.entryDateFontSize),
      color: COLORS.muted,
      flexShrink: 0,
      textAlign: "right",
    },
    bulletRow: {
      flexDirection: "row",
      marginTop: s(BASE.bulletRowMarginTop),
      paddingLeft: 4,
    },
    bulletMark: {
      width: 10,
      fontSize: s(BASE.bulletMarkFontSize),
    },
    bulletText: {
      flex: 1,
      fontSize: s(BASE.bulletTextFontSize),
      lineHeight: 1.5,
      color: COLORS.text,
    },
    bodyText: {
      fontSize: s(BASE.bodyTextFontSize),
      lineHeight: 1.55,
      color: COLORS.text,
    },
  });
}

export interface ResumePdfData {
  name: string;
  subtitle?: string;
  contactLine?: string;
  avatarPath?: string | null;
  resume: ParsedResume;
  /**
   * 整体缩放系数：内容偏多时用来压缩字号和分区间距，让简历尽量落在 1 页以内。
   * 不影响页边距（留白）。默认 1，即不缩放。
   */
  scale?: number;
}

export function ResumeDocument({ name, subtitle, contactLine, avatarPath, resume, scale = 1 }: ResumePdfData) {
  const styles = createStyles(scale);
  return (
    <Document title={`${name}的简历`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{name || "未填写姓名"}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            {contactLine ? <Text style={styles.contactRow}>{contactLine}</Text> : null}
          </View>
          {avatarPath ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- 这是 @react-pdf/renderer 的 Image 组件，不是 HTML <img>，没有 alt 属性
            <Image style={styles.avatar} src={avatarPath} />
          ) : null}
        </View>
        <View style={styles.headerDivider} />

        {resume.sections.map((section, sIdx) => (
          <View key={sIdx} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.entries.map((entry, eIdx) => (
              <View key={eIdx} style={styles.entry}>
                {entry.header || entry.date ? (
                  <View style={styles.entryHeaderRow}>
                    <Text style={styles.entryHeaderText}>{entry.header}</Text>
                    {entry.date ? <Text style={styles.entryDateText}>{entry.date}</Text> : null}
                  </View>
                ) : null}
                {entry.bullets.map((bullet, bIdx) => (
                  <View key={bIdx} style={styles.bulletRow}>
                    <Text style={styles.bulletMark}>·</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}

            {section.bodyText ? <Text style={styles.bodyText}>{section.bodyText}</Text> : null}
          </View>
        ))}
      </Page>
    </Document>
  );
}
