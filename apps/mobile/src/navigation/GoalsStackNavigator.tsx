import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GoalsListScreen } from "../screens/GoalsListScreen";
import { GoalDetailScreen } from "../screens/GoalDetailScreen";
import type { GoalsStackParamList } from "./types";
import { colors } from "../lib/theme";

const Stack = createNativeStackNavigator<GoalsStackParamList>();

export function GoalsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="GoalsList" component={GoalsListScreen} options={{ title: "Goals" }} />
      <Stack.Screen
        name="GoalDetail"
        component={GoalDetailScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
    </Stack.Navigator>
  );
}
