import { esClient, isElasticsearchAvailable } from '../config/elasticsearch';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

export interface EmailDocument {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string | Date;
  sentAt?: string | Date | null;
  userId?: string | null;
  campaignId?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string | Date;
}

export interface SearchQueryParams {
  query: string;
  status?: string;
  sender?: string;
  page?: number;
  limit?: number;
}

class ElasticsearchService {
  /**
   * Index a scheduled or created email
   */
  async indexEmail(doc: EmailDocument): Promise<void> {
    if (!isElasticsearchAvailable) return;

    try {
      await esClient.index({
        index: config.ELASTICSEARCH_INDEX,
        id: doc.id,
        document: {
          id: doc.id,
          recipient: doc.recipient,
          sender: doc.sender,
          subject: doc.subject,
          body: doc.body,
          status: doc.status,
          scheduledAt: new Date(doc.scheduledAt).toISOString(),
          sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
          userId: doc.userId || null,
          campaignId: doc.campaignId || null,
          etherealPreviewUrl: doc.etherealPreviewUrl || null,
          createdAt: new Date(doc.createdAt).toISOString(),
        },
        refresh: 'wait_for',
      });
      logger.debug(`Elasticsearch: Indexed email ${doc.id}`);
    } catch (error: any) {
      logger.warn(`Elasticsearch indexing error for ${doc.id}: ${error.message}`);
    }
  }

  /**
   * Bulk index multiple emails
   */
  async bulkIndexEmails(docs: EmailDocument[]): Promise<void> {
    if (!isElasticsearchAvailable || docs.length === 0) return;

    try {
      const operations = docs.flatMap((doc) => [
        { index: { _index: config.ELASTICSEARCH_INDEX, _id: doc.id } },
        {
          id: doc.id,
          recipient: doc.recipient,
          sender: doc.sender,
          subject: doc.subject,
          body: doc.body,
          status: doc.status,
          scheduledAt: new Date(doc.scheduledAt).toISOString(),
          sentAt: doc.sentAt ? new Date(doc.sentAt).toISOString() : null,
          userId: doc.userId || null,
          campaignId: doc.campaignId || null,
          etherealPreviewUrl: doc.etherealPreviewUrl || null,
          createdAt: new Date(doc.createdAt).toISOString(),
        },
      ]);

      const bulkResponse = await esClient.bulk({ refresh: true, operations });
      if (bulkResponse.errors) {
        logger.warn('Elasticsearch bulk indexing had some errors');
      } else {
        logger.info(`✅ Elasticsearch: Bulk indexed ${docs.length} emails`);
      }
    } catch (error: any) {
      logger.warn(`Elasticsearch bulk index error: ${error.message}`);
    }
  }

  /**
   * Update an email document
   */
  async updateEmail(id: string, partialDoc: Partial<EmailDocument>): Promise<void> {
    if (!isElasticsearchAvailable) return;

    try {
      const docToUpdate: any = { ...partialDoc };
      if (docToUpdate.scheduledAt) docToUpdate.scheduledAt = new Date(docToUpdate.scheduledAt).toISOString();
      if (docToUpdate.sentAt) docToUpdate.sentAt = new Date(docToUpdate.sentAt).toISOString();

      await esClient.update({
        index: config.ELASTICSEARCH_INDEX,
        id,
        doc: docToUpdate,
        refresh: 'wait_for',
      });
      logger.debug(`Elasticsearch: Updated email document ${id}`);
    } catch (error: any) {
      logger.warn(`Elasticsearch update error for ${id}: ${error.message}`);
    }
  }

  /**
   * Search emails across subject, recipient, sender, and body
   */
  async searchEmails(params: SearchQueryParams) {
    const { query, status, sender, page = 1, limit = 20 } = params;
    const from = (page - 1) * limit;

    // 1. Try searching via Elasticsearch if available
    if (isElasticsearchAvailable) {
      try {
        const mustClauses: any[] = [];

        if (query && query.trim() !== '') {
          mustClauses.push({
            multi_match: {
              query,
              fields: ['subject^3', 'recipient^2', 'sender', 'body'],
              fuzziness: 'AUTO',
              operator: 'and',
            },
          });
        } else {
          mustClauses.push({ match_all: {} });
        }

        if (status) {
          mustClauses.push({ term: { status } });
        }

        if (sender) {
          mustClauses.push({ term: { 'sender.keyword': sender } });
        }

        const result = await esClient.search({
          index: config.ELASTICSEARCH_INDEX,
          from,
          size: limit,
          query: {
            bool: {
              must: mustClauses,
            },
          },
          highlight: {
            fields: {
              subject: {},
              body: {},
              recipient: {},
            },
            pre_tags: ['<mark class="bg-amber-200 text-amber-900 rounded px-1">'],
            post_tags: ['</mark>'],
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        });

        const totalHits = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0;
        const emails = result.hits.hits.map((hit: any) => ({
          ...hit._source,
          highlights: hit.highlight || {},
          searchSource: 'elasticsearch',
        }));

        return {
          source: 'elasticsearch',
          total: totalHits,
          page,
          limit,
          totalPages: Math.ceil(totalHits / limit),
          data: emails,
        };
      } catch (error: any) {
        logger.warn(`Elasticsearch query failed, falling back to database: ${error.message}`);
      }
    }

    // 2. Database Fallback (when ES is offline)
    const where: any = {};
    if (status) where.status = status;
    if (sender) where.sender = sender;

    if (query && query.trim() !== '') {
      where.OR = [
        { subject: { contains: query } },
        { recipient: { contains: query } },
        { sender: { contains: query } },
        { body: { contains: query } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.emailJob.count({ where }),
      prisma.emailJob.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: from,
        take: limit,
      }),
    ]);

    return {
      source: 'database_fallback',
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: emails.map((e) => ({ ...e, searchSource: 'database' })),
    };
  }
}

export const elasticsearchService = new ElasticsearchService();
