import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  LIFE_DOMAINS,
  type Goal,
  type GoalStatus,
  type LifeDomain,
  type RecurrenceFrequency,
  type Step,
  type SuggestedStep,
} from "@productivityapp/core";
import { api } from "../lib/api";
import { colors } from "../lib/theme";
import { DOMAIN_COLOR, DOMAIN_LABEL } from "../lib/domainColors";
import { todayISO } from "../lib/date";
import type { GoalsStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<GoalsStackParamList, "GoalDetail">;

function recurrenceLabel(step: Pick<Step, "recurrence">): string {
  const { freq } = step.recurrence;
  return freq[0].toUpperCase() + freq.slice(1);
}

const FREQ_OPTIONS: RecurrenceFrequency[] = ["once", "daily", "weekly", "monthly"];
const STATUS_OPTIONS: GoalStatus[] = ["active", "paused", "completed", "abandoned"];

interface GoalFormState {
  domain: LifeDomain;
  title: string;
  targetDate: string;
  status: GoalStatus;
}

interface StepFormState {
  domain: LifeDomain;
  title: string;
  estimatedMinutes: string;
  priority: number;
  freq: RecurrenceFrequency;
}

function DomainPicker({ value, onChange }: { value: LifeDomain; onChange: (d: LifeDomain) => void }) {
  return (
    <View style={styles.chipRow}>
      {LIFE_DOMAINS.map((d) => (
        <Pressable
          key={d}
          onPress={() => onChange(d)}
          style={[styles.chip, value === d && { backgroundColor: DOMAIN_COLOR[d] }]}
        >
          <Text style={[styles.chipText, value === d && { color: "#fff" }]}>{DOMAIN_LABEL[d]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function GoalDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [goal, setGoal] = useState<(Goal & { steps: Step[] }) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedStep[] | null>(null);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalForm, setGoalForm] = useState<GoalFormState | null>(null);

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState<StepFormState | null>(null);

  const load = useCallback(() => {
    api.getGoal(id).then(setGoal);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function loadSuggestions() {
    setSuggestions(await api.suggestSteps(id));
  }

  async function acceptSuggestion(s: SuggestedStep) {
    if (!goal) return;
    await api.createStep({
      goalId: goal.id,
      domain: goal.domain,
      title: s.title,
      estimatedMinutes: s.estimatedMinutes,
      priority: s.priority,
      recurrence: s.recurrence,
      earliestDate: todayISO(),
      aiSuggested: true,
    });
    setSuggestions((prev) => prev?.filter((x) => x.title !== s.title) ?? null);
    load();
  }

  async function removeStep(stepId: string) {
    await api.deleteStep(stepId);
    load();
  }

  function confirmDeleteGoal() {
    if (!goal) return;
    Alert.alert("Delete goal", `Delete "${goal.title}" and all its steps?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteGoal(goal.id);
          navigation.goBack();
        },
      },
    ]);
  }

  function startEditGoal() {
    if (!goal) return;
    setGoalForm({ domain: goal.domain, title: goal.title, targetDate: goal.targetDate ?? "", status: goal.status });
    setEditingGoal(true);
  }

  async function saveGoal() {
    if (!goal || !goalForm || !goalForm.title.trim()) return;
    await api.updateGoal(goal.id, {
      domain: goalForm.domain,
      title: goalForm.title.trim(),
      targetDate: goalForm.targetDate || undefined,
      status: goalForm.status,
    });
    setEditingGoal(false);
    load();
  }

  function startEditStep(step: Step) {
    setEditingStepId(step.id);
    setStepForm({
      domain: step.domain,
      title: step.title,
      estimatedMinutes: String(step.estimatedMinutes),
      priority: step.priority,
      freq: step.recurrence.freq,
    });
  }

  async function saveStep() {
    if (!editingStepId || !stepForm || !stepForm.title.trim()) return;
    await api.updateStep(editingStepId, {
      domain: stepForm.domain,
      title: stepForm.title.trim(),
      estimatedMinutes: Number(stepForm.estimatedMinutes) || 30,
      priority: stepForm.priority,
      recurrence: { freq: stepForm.freq },
    });
    setEditingStepId(null);
    load();
  }

  if (!goal) return null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {editingGoal && goalForm ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Edit goal</Text>
          <DomainPicker value={goalForm.domain} onChange={(d) => setGoalForm({ ...goalForm, domain: d })} />
          <TextInput
            style={styles.input}
            value={goalForm.title}
            onChangeText={(v) => setGoalForm({ ...goalForm, title: v })}
          />
          <TextInput
            style={styles.input}
            placeholder="Target date (YYYY-MM-DD)"
            value={goalForm.targetDate}
            onChangeText={(v) => setGoalForm({ ...goalForm, targetDate: v })}
          />
          <View style={styles.chipRow}>
            {STATUS_OPTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setGoalForm({ ...goalForm, status: s })}
                style={[styles.chip, goalForm.status === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, goalForm.status === s && { color: "#fff" }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.rowStart}>
            <Pressable style={styles.smallButtonDark} onPress={saveGoal}>
              <Text style={styles.smallButtonDarkText}>Save</Text>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={() => setEditingGoal(false)}>
              <Text style={styles.smallButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <Text style={styles.goalMeta}>
              {DOMAIN_LABEL[goal.domain]}
              {goal.targetDate ? ` · ${goal.targetDate}` : ""} · {goal.status}
            </Text>
          </View>
          <View style={styles.rowStart}>
            <Pressable onPress={startEditGoal}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
            <Pressable onPress={confirmDeleteGoal}>
              <Text style={styles.deleteLink}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>Steps</Text>
          <Pressable style={styles.smallButton} onPress={loadSuggestions}>
            <Text style={styles.smallButtonText}>Suggest steps</Text>
          </Pressable>
        </View>

        {suggestions && suggestions.length > 0 && (
          <View style={styles.suggestBox}>
            {suggestions.map((s) => (
              <View key={s.title} style={styles.suggestRow}>
                <Text style={styles.suggestText}>
                  {s.title} · {s.estimatedMinutes}m · {s.recurrence.freq}
                </Text>
                <Pressable onPress={() => acceptSuggestion(s)}>
                  <Text style={styles.addLink}>Add</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {goal.steps.length === 0 ? (
          <Text style={styles.empty}>No steps yet.</Text>
        ) : (
          goal.steps.map((step) =>
            editingStepId === step.id && stepForm ? (
              <View key={step.id} style={styles.editStepBox}>
                <TextInput
                  style={styles.input}
                  value={stepForm.title}
                  onChangeText={(v) => setStepForm({ ...stepForm, title: v })}
                />
                <DomainPicker value={stepForm.domain} onChange={(d) => setStepForm({ ...stepForm, domain: d })} />
                <View style={styles.rowStart}>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    keyboardType="numeric"
                    value={stepForm.estimatedMinutes}
                    onChangeText={(v) => setStepForm({ ...stepForm, estimatedMinutes: v })}
                  />
                  <View style={styles.chipRow}>
                    {FREQ_OPTIONS.map((f) => (
                      <Pressable
                        key={f}
                        onPress={() => setStepForm({ ...stepForm, freq: f })}
                        style={[styles.chip, stepForm.freq === f && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, stepForm.freq === f && { color: "#fff" }]}>{f}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.rowStart}>
                  <Pressable style={styles.smallButtonDark} onPress={saveStep}>
                    <Text style={styles.smallButtonDarkText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.smallButton} onPress={() => setEditingStepId(null)}>
                    <Text style={styles.smallButtonText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View key={step.id} style={styles.stepRow}>
                <View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepMeta}>
                    {step.estimatedMinutes}m · {recurrenceLabel(step)}
                    {step.aiSuggested ? " · AI" : ""}
                  </Text>
                </View>
                <View style={styles.rowStart}>
                  <Pressable onPress={() => startEditStep(step)}>
                    <Text style={styles.editLink}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => removeStep(step.id)}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            )
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  goalMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  editLink: { color: colors.text, fontSize: 13, fontWeight: "500" },
  deleteLink: { color: colors.danger, fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  rowBetween2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardLabel: { fontSize: 13, fontWeight: "500", color: colors.muted },
  smallButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  smallButtonText: { fontSize: 12, fontWeight: "500", color: colors.text },
  smallButtonDark: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  smallButtonDarkText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  smallInput: { width: 70 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, backgroundColor: "#f1f5f9" },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 11, fontWeight: "500", color: colors.text },
  suggestBox: { backgroundColor: "#eef2ff", borderRadius: 8, padding: 10, marginBottom: 10, gap: 6 },
  suggestRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  suggestText: { fontSize: 12, color: colors.text, flex: 1, marginRight: 8 },
  addLink: { color: "#4338ca", fontWeight: "600", fontSize: 12 },
  empty: { color: colors.faint, fontSize: 13 },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  stepTitle: { fontSize: 14, fontWeight: "500", color: colors.text },
  stepMeta: { fontSize: 12, color: colors.faint, marginTop: 2 },
  removeLink: { color: colors.danger, fontSize: 12 },
  editStepBox: { borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingVertical: 10, gap: 8 },
});
