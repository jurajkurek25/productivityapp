import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { TaskInstance } from "@productivityapp/core";
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { DOMAIN_COLOR } from "../lib/domainColors";
import { addDaysISO, formatShort, todayISO } from "../lib/date";

function startOfWeek(date: string): string {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return addDaysISO(date, -dow);
}

export function CalendarScreen() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const weekEnd = addDaysISO(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

  const load = useCallback(() => {
    api.listCalendar(weekStart, weekEnd).then(setInstances);
  }, [weekStart, weekEnd]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await api.generateCalendar(weekStart, weekEnd);
      setMessage(
        `Placed ${res.placed.length} task(s). Energy: ${res.energyState.score}/100 (capacity ${Math.round(
          res.energyState.loadMultiplier * 100
        )}%).`
      );
      load();
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(instId: string, status: TaskInstance["status"]) {
    setInstances((prev) => prev.map((i) => (i.id === instId ? { ...i, status } : i)));
    await api.updateInstance(instId, { status });
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.rowStart}>
          <Pressable style={styles.navBtn} onPress={() => setWeekStart(addDaysISO(weekStart, -7))}>
            <Text style={styles.navBtnText}>{"<"}</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => setWeekStart(startOfWeek(todayISO()))}>
            <Text style={styles.navBtnText}>Today</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => setWeekStart(addDaysISO(weekStart, 7))}>
            <Text style={styles.navBtnText}>{">"}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.generateBtnText}>Generate</Text>}
        </Pressable>
      </View>

      {message && (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {days.map((date) => {
          const dayInstances = instances.filter((i) => i.scheduledDate === date);
          const isToday = date === todayISO();
          return (
            <View key={date} style={[styles.dayCard, isToday && styles.dayCardToday]}>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{formatShort(date)}</Text>
              {dayInstances.length === 0 && <Text style={styles.empty}>—</Text>}
              {dayInstances.map((inst) => (
                <View key={inst.id} style={styles.taskRow}>
                  <View style={styles.rowStart}>
                    <View style={[styles.dot, { backgroundColor: DOMAIN_COLOR[inst.domain] }]} />
                    <Text style={[styles.taskTitle, inst.status === "completed" && styles.taskDone]}>
                      {inst.title} ({inst.durationMinutes}m)
                    </Text>
                  </View>
                  {inst.status !== "completed" && (
                    <View style={styles.rowStart}>
                      <Pressable onPress={() => setStatus(inst.id, "completed")}>
                        <Text style={styles.doneLink}>Done</Text>
                      </Pressable>
                      <Pressable onPress={() => setStatus(inst.id, "skipped")}>
                        <Text style={styles.skipLink}>Skip</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 8 },
  navBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  navBtnText: { fontSize: 13, fontWeight: "500", color: colors.text },
  generateBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  generateBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  messageBox: { backgroundColor: "#f1f5f9", borderRadius: 8, padding: 10, marginBottom: 10 },
  messageText: { fontSize: 12, color: colors.text },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  dayCardToday: { borderColor: colors.accent },
  dayLabel: { fontSize: 12, fontWeight: "600", color: colors.faint, marginBottom: 6 },
  dayLabelToday: { color: colors.text },
  empty: { fontSize: 12, color: colors.faint },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  taskTitle: { fontSize: 13, color: colors.text, flexShrink: 1 },
  taskDone: { color: colors.faint, textDecorationLine: "line-through" },
  doneLink: { color: colors.success, fontSize: 11, fontWeight: "600" },
  skipLink: { color: colors.faint, fontSize: 11, fontWeight: "600" },
});
