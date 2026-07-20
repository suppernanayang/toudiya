import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ParsedResume } from "./parse-resume-content";

const COLORS = {
  accent: "#115e59", // 深墨绿，跟产品品牌色呼应
  text: "#18211f",
  muted: "#4b5a56",
  line: "#d8e3df",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansSC",
    fontSize: 10.5,
    color: COLORS.text,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10.5,
    color: COLORS.muted,
    marginBottom: 4,
  },
  contactRow: {
    fontSize: 9.5,
    color: COLORS.muted,
    marginBottom: 14,
  },
  headerDivider: {
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.accent,
    marginBottom: 14,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.accent,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.line,
  },
  entry: {
    marginBottom: 6,
  },
  entryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  entryHeaderText: {
    fontSize: 10.5,
    fontWeight: "bold",
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  entryDateText: {
    fontSize: 9.5,
    color: COLORS.muted,
    flexShrink: 0,
    textAlign: "right",
  },
  bulletRow: {
    flexDirection: "row",
    marginTop: 2,
    paddingLeft: 4,
  },
  bulletMark: {
    width: 10,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.text,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.55,
    color: COLORS.text,
  },
});

export interface ResumePdfData {
  name: string;
  subtitle?: string;
  contactLine?: string;
  resume: ParsedResume;
}

export function ResumeDocument({ name, subtitle, contactLine, resume }: ResumePdfData) {
  return (
    <Document title={`${name}的简历`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{name || "未填写姓名"}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {contactLine ? <Text style={styles.contactRow}>{contactLine}</Text> : null}
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
