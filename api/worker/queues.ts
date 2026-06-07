import { Queue } from 'bullmq';
import { config } from '../config/index.js';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

export const simulationQueue = new Queue('simulation', {
  connection,
  defaultJobOptions: {
    attempts: config.simulation.maxRetries,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 5000,
    },
  },
});

export const reportQueue = new Queue('report', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 500,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 2000,
    },
  },
});

export const statsQueue = new Queue('stats', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600,
      count: 100,
    },
    removeOnFail: {
      age: 30 * 24 * 3600,
      count: 500,
    },
  },
});

export const alertQueue = new Queue('alert', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 2000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 5000,
    },
  },
});

export const queues = {
  simulation: simulationQueue,
  report: reportQueue,
  stats: statsQueue,
  alert: alertQueue,
};

export const getQueue = (name: keyof typeof queues): Queue => {
  return queues[name];
};

export const closeAllQueues = async (): Promise<void> => {
  await Promise.all([
    simulationQueue.close(),
    reportQueue.close(),
    statsQueue.close(),
    alertQueue.close(),
  ]);
};
