import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LIFE_DOMAINS, type Goal, type LifeDomain } from "@productivityapp/core";
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { DOMAIN_COLOR, DOMAIN_LABEL } from "../lib/domainColors";
import type { GoalsStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GoalsStackParamList, "GoalsList">;

export function GoalsListScreen({ navigation }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [domain, setDomain] = useState<LifeDomain>("business");
  const [title, setTitle] = useState("");

  const load = useCallback(() => {
    api.listGoals().then(setGoals);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleCreate() {
    if (!title.trim()) return;
    await api.createGoal({ domain, title: title.trim() });
    setTitle("");
    setShowForm(false);
    load();
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.heading}>Goals</Text>
        <Pressable style={styles.smallButton} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.smallButtonText}>{showForm ? "Cancel" : "New goal"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.form}>
          <View style={styles.domainPicker}>
            {LIFE_DOMAINS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDomain(d)}
                style={[styles.domainChip, domain === d && { backgroundColor: DOMAIN_COLOR[d] }]}
              >
                <Text style={[styles.domainChipText, domain === d && { color: "#fff" }]}>{DOMAIN_LABEL[d]}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. Grow my YouTube channel"
            value={title}
            onChangeText={setTitle}
          />
          <Pressable style={styles.button} onPress={handleCreate}>
            <Text style={styles.buttonText}>Create goal</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={goals}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>No goals yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.goalRow}
            onPress={() => navigation.navigate("GoalDetail", { id: item.id, title: item.title })}
          >
            <View>
              <Text style={styles.goalTitle}>{item.title}</Text>
              <View style={styles.rowStart}>
                <View style={[styles.dot, { backgroundColor: DOMAIN_COLOR[item.domain] }]} />
                <Text style={styles.goalMeta}>{DOMAIN_LABEL[item.domain]}</Text>
              </View>
            </View>
            <Text style={styles.status}>{item.status}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading: { fontSize: 24, fontWeight: "700", color: colors.text },
  smallButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  smallButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  form: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  domainPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  domainChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "#f1f5f9" },
  domainChipText: { fontSize: 12, fontWeight: "500", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  button: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
  empty: { color: colors.faint, textAlign: "center", marginTop: 40 },
  goalRow: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  goalMeta: { fontSize: 12, color: colors.muted },
  status: { fontSize: 11, color: colors.faint, textTransform: "uppercase" },
});
