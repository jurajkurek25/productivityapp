import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { EnergyState, PriorityReport } from "@productivityapp/core";
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { DOMAIN_COLOR, DOMAIN_LABEL } from "../lib/domainColors";

export function DashboardScreen() {
  const [energy, setEnergy] = useState<EnergyState | null>(null);
  const [priority, setPriority] = useState<PriorityReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    Promise.all([api.getEnergy(), api.getPriority(7)])
      .then(([e, p]) => {
        setEnergy(e);
        setPriority(p);
      })
      .finally(() => setRefreshing(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const maxMinutes = Math.max(1, ...(priority?.domains.map((d) => d.scheduledMinutes) ?? [1]));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <Text style={styles.heading}>Dashboard</Text>

      {energy && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardLabel}>Inferred energy today</Text>
            <Text style={styles.trend}>{energy.trend}</Text>
          </View>
          <Text style={styles.score}>{energy.score}/100</Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${energy.score}%`, backgroundColor: colors.accent }]} />
          </View>
          <Text style={styles.helpText}>
            Scheduling capacity today is scaled to {Math.round(energy.loadMultiplier * 100)}% of normal, based on
            your recent completion history.
          </Text>
        </View>
      )}

      {priority && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Balance across domains (last 7 days)</Text>
          {priority.domains.map((d) => (
            <View key={d.domain} style={styles.domainRow}>
              <View style={styles.rowBetween}>
                <View style={styles.rowStart}>
                  <View style={[styles.dot, { backgroundColor: DOMAIN_COLOR[d.domain] }]} />
                  <Text style={styles.domainLabel}>{DOMAIN_LABEL[d.domain]}</Text>
                </View>
                <Text style={styles.domainMeta}>
                  {d.scheduledMinutes}m · {Math.round(d.completionRate * 100)}% done
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${(d.scheduledMinutes / maxMinutes) * 100}%`, backgroundColor: DOMAIN_COLOR[d.domain] },
                  ]}
                />
              </View>
            </View>
          ))}
          {priority.neglectedDomains.length > 0 && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>Neglected: {priority.neglectedDomains.join(", ")}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  heading: { fontSize: 24, fontWeight: "700", color: colors.text, marginBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardLabel: { fontSize: 13, fontWeight: "500", color: colors.muted },
  trend: { fontSize: 13, fontWeight: "500", color: colors.muted, textTransform: "capitalize" },
  score: { fontSize: 34, fontWeight: "700", color: colors.text, marginTop: 6 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: "#f1f5f9", marginTop: 8, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  helpText: { fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 18 },
  domainRow: { marginTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  domainLabel: { fontSize: 13, fontWeight: "500", color: colors.text },
  domainMeta: { fontSize: 12, color: colors.muted },
  warnBox: { backgroundColor: colors.warnBg, borderRadius: 8, padding: 10, marginTop: 12 },
  warnText: { color: colors.warnText, fontSize: 13 },
});
