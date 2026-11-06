import type { EngineSettings } from './types';

// ค่าตั้งต้นตามเอกสาร แอดมินแก้ได้ในหน้าตั้งค่าระบบ (เก็บในตาราง settings)

export const DEFAULT_SETTINGS: EngineSettings = {
  psuHeadroom: 0.3,
  motherboardDefaultWatt: 50,
  usageWeights: {
    gaming: { cpu: 0.3, gpu: 0.7 },
    office: { cpu: 0.8, gpu: 0.2 },
    creator: { cpu: 0.5, gpu: 0.5 },
    streaming: { cpu: 0.45, gpu: 0.55 },
  },
};

export function resolveSettings(partial: Partial<EngineSettings> | undefined): EngineSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    usageWeights: { ...DEFAULT_SETTINGS.usageWeights, ...partial?.usageWeights },
  };
}
