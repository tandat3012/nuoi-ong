export type ModuleStatus = 'foundation' | 'ready-for-api';

export type ModuleDefinition = {
  title: string;
  description: string;
  status: ModuleStatus;
  capabilities: readonly string[];
  primaryAction: string;
};
