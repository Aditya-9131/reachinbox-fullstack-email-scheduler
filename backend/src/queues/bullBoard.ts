import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue, initEmailQueue } from './emailQueue';

export const setupBullBoard = () => {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queue = emailQueue || initEmailQueue();

  createBullBoard({
    queues: [new BullMQAdapter(queue as any) as any],
    serverAdapter,
  });

  return serverAdapter.getRouter();
};
