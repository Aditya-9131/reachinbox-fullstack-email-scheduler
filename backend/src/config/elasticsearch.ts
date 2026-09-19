import { Client } from '@elastic/elasticsearch';
import { config } from './env';
import { logger } from './logger';

export const esClient = new Client({
  node: config.ELASTICSEARCH_NODE,
  maxRetries: 0,
  requestTimeout: 1000,
});

export let isElasticsearchAvailable = false;

export const initElasticsearch = async (): Promise<boolean> => {
  try {
    const health = await esClient.cluster.health({});
    logger.info(`✅ Elasticsearch connected (status: ${health.status})`);
    isElasticsearchAvailable = true;

    const indexExists = await esClient.indices.exists({
      index: config.ELASTICSEARCH_INDEX,
    });

    if (!indexExists) {
      await esClient.indices.create({
        index: config.ELASTICSEARCH_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              userId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      logger.info(`✅ Elasticsearch index '${config.ELASTICSEARCH_INDEX}' created successfully`);
    } else {
      logger.info(`ℹ️ Elasticsearch index '${config.ELASTICSEARCH_INDEX}' already exists`);
    }

    return true;
  } catch (error: any) {
    logger.warn(`⚠️ Elasticsearch is not available at ${config.ELASTICSEARCH_NODE}. Search will seamlessly use DB fallback. (${error.message})`);
    isElasticsearchAvailable = false;
    return false;
  }
};
