import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { StudyPlan } from "@productivityapp/core";
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { addDaysISO, todayISO } from "../lib/date";

interface MaterialRow {
  title: string;
  estimatedMinutes: string;
  difficulty: string;
}

export function StudyScreen() {
  const [goalTitle, setGoalTitle] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [examDate, setExamDate] = useState(addDaysISO(todayISO(), 14));
  const [dailyCapacity, setDailyCapacity] = useState("60");
  const [materials, setMaterials] = useState<MaterialRow[]>([{ title: "", estimatedMinutes: "60", difficulty: "3" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: StudyPlan; scheduledCount: number } | null>(null);

  function updateMaterial(i: number, patch: Partial<MaterialRow>) {
    setMaterials((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function handleSubmit() {
    setError(null);
    const cleanMaterials = materials
      .filter((m) => m.title.trim())
      .map((m) => ({
        title: m.title.trim(),
        estimatedMinutes: Number(m.estimatedMinutes) || 30,
        difficulty: Number(m.difficulty) || 3,
      }));
    if (!goalTitle.trim() || cleanMaterials.length === 0) {
      setError("Add a title and at least one study material.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createStudyPlan({
        goalTitle: goalTitle.trim(),
        examDate,
        startDate,
        materials: cleanMaterials,
        dailyCapacityMinutes: Number(dailyCapacity) || 60,
      });
      setResult({ plan: res.plan, scheduledCount: res.scheduled.length });
    } catch {
      setError("Could not build the study plan. Check your dates (YYYY-MM-DD).");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Study plan</Text>
      <Text style={styles.subheading}>
        Split material into a day-by-day plan up to the exam — scheduled through the same calendar and energy
        system as everything else.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Exam / goal title</Text>
        <TextInput style={styles.input} value={goalTitle} onChangeText={setGoalTitle} placeholder="Pass Algorithms Exam" />

        <View style={styles.rowGap}>
          <View style={styles.flex1}>
            <Text style={styles.label}>Start (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.label}>Exam (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={examDate} onChangeText={setExamDate} />
          </View>
        </View>

        <Text style={styles.label}>Daily study minutes</Text>
        <TextInput style={styles.input} value={dailyCapacity} onChangeText={setDailyCapacity} keyboardType="numeric" />

        <Text style={styles.label}>Materials / topics</Text>
        {materials.map((m, i) => (
          <View key={i} style={styles.materialRow}>
            <TextInput
              style={[styles.input, styles.flex1]}
              placeholder="Topic"
              value={m.title}
              onChangeText={(v) => updateMaterial(i, { title: v })}
            />
            <TextInput
              style={[styles.input, styles.smallInput]}
              placeholder="min"
              keyboardType="numeric"
              value={m.estimatedMinutes}
              onChangeText={(v) => updateMaterial(i, { estimatedMinutes: v })}
            />
            <TextInput
              style={[styles.input, styles.smallInput]}
              placeholder="1-5"
              keyboardType="numeric"
              value={m.difficulty}
              onChangeText={(v) => updateMaterial(i, { difficulty: v })}
            />
            <Pressable onPress={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))}>
              <Text style={styles.removeLink}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setMaterials((prev) => [...prev, { title: "", estimatedMinutes: "60", difficulty: "3" }])}>
          <Text style={styles.addLink}>+ Add material</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Build & schedule plan</Text>}
        </Pressable>
      </View>

      {result && (
        <View style={styles.card}>
          <Text style={styles.resultSummary}>
            Scheduled {result.scheduledCount} study block(s) across {result.plan.days.length} day(s).
          </Text>
          {result.plan.days.map((day) => (
            <View key={day.date} style={styles.planDay}>
              <Text style={styles.planDate}>{day.date}</Text>
              <Text style={styles.planItems}>
                {day.items.map((item) => `${item.title} (${item.minutes}m${item.isReview ? ", review" : ""})`).join(", ")}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  heading: { fontSize: 24, fontWeight: "700", color: colors.text },
  subheading: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  label: { fontSize: 12, fontWeight: "500", color: colors.text, marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  rowGap: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
  smallInput: { width: 60 },
  materialRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  removeLink: { color: colors.danger, fontSize: 14, paddingHorizontal: 4 },
  addLink: { color: colors.text, textDecorationLine: "underline", fontSize: 13, marginTop: 4 },
  error: { color: colors.danger, fontSize: 12 },
  button: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  resultSummary: { fontSize: 13, fontWeight: "500", color: colors.text },
  planDay: { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingVertical: 8 },
  planDate: { fontSize: 12, fontWeight: "600", color: colors.muted },
  planItems: { fontSize: 12, color: colors.text, marginTop: 2 },
});
