import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { getDb } from '../db/index.js';
import { initSocket } from '../lib/socket.js';
import { simulationQueue, reportQueue, statsQueue, alertQueue, closeAllQueues } from './queues.js';
import { processSimulationJob } from './jobs/SimulationJob.js';
import { processReportJob } from './jobs/ReportJob.js';
import { processStatsJob } from './jobs/StatsJob.js';
import type { SimulationJobData, ReportJobData, StatsJobData, AlertJobData } from '../lib/queues.js';
import * as http from 'http';

const connection = {
  host: config.redis.host,
  port: config.redis.port,
};

const workers: Worker[] = [];

const initHttpServerForSocket = () => {
  const server = http.createServer();
  initSocket(server);
  server.listen(0, () => {
    console.log('Internal socket server started');
  });
  return server;
};

const createSimulationWorker = (): Worker<SimulationJobData> => {
  const worker = new Worker<SimulationJobData>(
    'simulation',
    async (job) => {
      console.log(`[Simulation] 开始处理任务: ${job.id}, 任务ID: ${job.data.taskId}`);
      await processSimulationJob(job);
      console.log(`[Simulation] 任务完成: ${job.id}, 任务ID: ${job.data.taskId}`);
    },
    {
      connection,
      concurrency: 2,
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
        count: 5000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Simulation] Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Simulation] Job failed: ${job?.id}, error:`, err);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[Simulation] Job progress: ${job.id}, ${JSON.stringify(progress)}`);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Simulation] Job stalled: ${jobId}`);
  });

  return worker;
};

const createReportWorker = (): Worker<ReportJobData> => {
  const worker = new Worker<ReportJobData>(
    'report',
    async (job) => {
      console.log(`[Report] 开始处理任务: ${job.id}, 任务ID: ${job.data.taskId}`);
      await processReportJob(job);
      console.log(`[Report] 任务完成: ${job.id}, 任务ID: ${job.data.taskId}`);
    },
    {
      connection,
      concurrency: 3,
      removeOnComplete: {
        age: 24 * 3600,
        count: 500,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
        count: 2000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Report] Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Report] Job failed: ${job?.id}, error:`, err);
  });

  return worker;
};

const createStatsWorker = (): Worker<StatsJobData> => {
  const worker = new Worker<StatsJobData>(
    'stats',
    async (job) => {
      console.log(`[Stats] 开始处理任务: ${job.id}, 类型: ${job.data.type}`);
      await processStatsJob(job);
      console.log(`[Stats] 任务完成: ${job.id}, 类型: ${job.data.type}`);
    },
    {
      connection,
      concurrency: 1,
      removeOnComplete: {
        age: 7 * 24 * 3600,
        count: 100,
      },
      removeOnFail: {
        age: 30 * 24 * 3600,
        count: 500,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Stats] Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Stats] Job failed: ${job?.id}, error:`, err);
  });

  return worker;
};

const createAlertWorker = (): Worker<AlertJobData> => {
  const worker = new Worker<AlertJobData>(
    'alert',
    async (job) => {
      console.log(`[Alert] 开始处理预警: ${job.id}, 级别: ${job.data.level}`);
      await processAlertJob(job);
      console.log(`[Alert] 预警处理完成: ${job.id}`);
    },
    {
      connection,
      concurrency: 5,
      removeOnComplete: {
        age: 24 * 3600,
        count: 2000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
        count: 5000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Alert] Job completed: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Alert] Job failed: ${job?.id}, error:`, err);
  });

  return worker;
};

const processAlertJob = async (job: any): Promise<void> => {
  const { taskId, alertId, level, message, notifyChannels } = job.data;

  const { getSocket } = await import('../lib/socket.js');
  const io = getSocket();

  if (notifyChannels.includes('socket')) {
    io.emit('alert:new', {
      taskId,
      alertId,
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  if (notifyChannels.includes('inapp')) {
    console.log(`[Alert] 站内通知: ${message}`);
  }

  if (notifyChannels.includes('email')) {
    console.log(`[Alert] 邮件通知: ${message}`);
  }

  job.updateProgress({
    sent: true,
    channels: notifyChannels,
  });
};

const startWorkers = async (): Promise<void> => {
  console.log('Initializing BullMQ workers...');

  getDb();
  console.log('Database connected');

  initHttpServerForSocket();
  console.log('Socket.io initialized');

  workers.push(createSimulationWorker());
  console.log('Simulation worker started');

  workers.push(createReportWorker());
  console.log('Report worker started');

  workers.push(createStatsWorker());
  console.log('Stats worker started');

  workers.push(createAlertWorker());
  console.log('Alert worker started');

  console.log('All workers initialized successfully');
  console.log(`Redis connection: ${config.redis.host}:${config.redis.port}`);

  const printQueueStats = async () => {
    try {
      const [simStats, repStats, statStats, alertStats] = await Promise.all([
        simulationQueue.getJobCounts(),
        reportQueue.getJobCounts(),
        statsQueue.getJobCounts(),
        alertQueue.getJobCounts(),
      ]);

      console.log('\n=== Queue Stats ===');
      console.log(`Simulation: waiting=${simStats.waiting}, active=${simStats.active}, completed=${simStats.completed}, failed=${simStats.failed}`);
      console.log(`Report:     waiting=${repStats.waiting}, active=${repStats.active}, completed=${repStats.completed}, failed=${repStats.failed}`);
      console.log(`Stats:      waiting=${statStats.waiting}, active=${statStats.active}, completed=${statStats.completed}, failed=${statStats.failed}`);
      console.log(`Alert:      waiting=${alertStats.waiting}, active=${alertStats.active}, completed=${alertStats.completed}, failed=${alertStats.failed}`);
    } catch (err) {
      console.error('Failed to get queue stats:', err);
    }
  };

  setInterval(printQueueStats, 60000);
};

const stopWorkers = async (): Promise<void> => {
  console.log('\nShutting down workers...');

  for (const worker of workers) {
    await worker.close();
  }
  console.log('All workers closed');

  await closeAllQueues();
  console.log('All queues closed');

  process.exit(0);
};

process.on('SIGTERM', stopWorkers);
process.on('SIGINT', stopWorkers);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

startWorkers().catch((err) => {
  console.error('Failed to start workers:', err);
  process.exit(1);
});
