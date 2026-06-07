import { BaseRepository } from './BaseRepository.js';
import type { FreeEnergyResult } from '../../shared/types.js';

export class ResultRepository extends BaseRepository<FreeEnergyResult> {
  constructor() {
    super('free_energy_results');
  }

  createWithComponents(data: Omit<FreeEnergyResult, 'id'>): FreeEnergyResult {
    const resultData = {
      ...data,
      energyComponents: JSON.stringify(data.energyComponents),
      decompositionPerResidue: JSON.stringify(data.decompositionPerResidue),
      interactionFingerprint: JSON.stringify(data.interactionFingerprint)
    };

    const created = super.create(resultData as unknown as Partial<FreeEnergyResult>);
    return this.deserialize(created);
  }

  findByTaskId(taskId: string): FreeEnergyResult[] {
    const results = this.queryMany(
      'SELECT * FROM free_energy_results WHERE task_id = ? ORDER BY calculated_at DESC',
      [taskId]
    );
    return results.map(r => this.deserialize(r));
  }

  findById(id: string): FreeEnergyResult | undefined {
    const result = super.findById(id);
    return result ? this.deserialize(result) : undefined;
  }

  findAll(): FreeEnergyResult[] {
    const results = super.findAll();
    return results.map(r => this.deserialize(r));
  }

  private deserialize(result: FreeEnergyResult): FreeEnergyResult {
    return {
      ...result,
      energyComponents: typeof result.energyComponents === 'string'
        ? JSON.parse(result.energyComponents as unknown as string)
        : result.energyComponents,
      decompositionPerResidue: typeof result.decompositionPerResidue === 'string'
        ? JSON.parse(result.decompositionPerResidue as unknown as string)
        : result.decompositionPerResidue,
      interactionFingerprint: typeof result.interactionFingerprint === 'string'
        ? JSON.parse(result.interactionFingerprint as unknown as string)
        : result.interactionFingerprint
    };
  }
}

export const resultRepository = new ResultRepository();
