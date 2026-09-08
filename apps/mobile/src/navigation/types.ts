export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type GoalsStackParamList = {
  GoalsList: undefined;
  GoalDetail: { id: string; title: string };
};

export type RootTabParamList = {
  Dashboard: undefined;
  GoalsTab: undefined;
  Calendar: undefined;
  Study: undefined;
};
