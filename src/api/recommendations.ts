import { apiClient } from './client';
import type { Recommendation } from '@shared/types';

interface GetRecommendationRequest {
  targetId: string;
  ligandSize?: number;
  proteinType?: string;
  desiredAccuracy?: number;
  availableComputeHours?: number;
}

export const recommendationsApi = {
  getRecommendation: (params: GetRecommendationRequest) => {
    return apiClient.get<Recommendation>('/recommendations', { params });
  },

  getMethodPerformance: (params?: {
    method?: string;
    targetId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    return apiClient.get<
      {
        method: string;
        averageError: number;
        successRate: number;
        sampleSize: number;
        averageRuntime: number;
      }[]
    >('/recommendations/method-performance', { params });
  },

  getParameterSuggestions: (params: {
    targetId: string;
    feMethod: string;
  }) => {
    return apiClient.get<{
      forceField: string;
      temperature: number;
      saltConcentration: number;
      rmsdThreshold: number;
      equilibrationTime: number;
      productionTime: number;
      replicaCount: number;
      lambdaWindows: number;
    }>('/recommendations/parameter-suggestions', { params });
  }
};

export default recommendationsApi;
