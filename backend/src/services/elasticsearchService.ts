import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
});

const INDEX_NAME = 'emails';

export async function initElasticsearchIndex() {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({
        index: INDEX_NAME,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`✅ Elasticsearch index "${INDEX_NAME}" created.`);
    }
  } catch (error) {
    console.error('Elasticsearch index initialization error:', error);
  }
}

export const initElasticsearch = initElasticsearchIndex;

export async function indexEmailInElasticsearch(data: {
  id: string;
  userId: string;
  senderId?: string;
  campaignId?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt?: Date | string;
  sentAt?: Date | string | null;
}) {
  try {
    await initElasticsearchIndex();

    await esClient.index({
      index: INDEX_NAME,
      id: data.id,
      refresh: 'wait_for',
      document: {
        id: data.id,
        userId: data.userId,
        senderId: data.senderId || data.userId,
        campaignId: data.campaignId || null,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        body: data.body,
        status: data.status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
        sentAt: data.sentAt ? new Date(data.sentAt) : null,
      },
    });
    console.log(`Indexed email into Elasticsearch: ${data.id}`);
  } catch (error) {
    console.error(`Error indexing email ${data.id} in Elasticsearch:`, error);
  }
}

export async function searchEmails(params: {
  userId?: string;
  query?: string;
  status?: string;
  senderId?: string;
  page?: number;
  limit?: number;
}) {
  const { userId, query, status, senderId, page = 1, limit = 10 } = params;
  const from = (page - 1) * limit;

  const mustConditions: any[] = [];

  // Match either userId OR senderId using exact term queries on keyword mapping
  const targetId = userId || senderId;
  if (targetId) {
    mustConditions.push({
      bool: {
        should: [
          { term: { userId: targetId } },
          { term: { senderId: targetId } }
        ],
        minimum_should_match: 1
      }
    });
  }

  // Exact term match for keyword status field
  if (status && status !== 'ALL') {
    mustConditions.push({ term: { status } });
  }

  // Wildcard & full-text match for text search queries
  if (query && query.trim() !== '') {
    const cleanQuery = query.trim().toLowerCase();
    mustConditions.push({
      bool: {
        should: [
          { multi_match: { query: cleanQuery, fields: ['subject^2', 'body', 'recipientEmail'], fuzziness: 'AUTO' } },
          { wildcard: { recipientEmail: `*${cleanQuery}*` } },
          { wildcard: { subject: `*${cleanQuery}*` } },
        ],
        minimum_should_match: 1
      },
    });
  }

  try {
    await initElasticsearchIndex();

    const response = await esClient.search({
      index: INDEX_NAME,
      from,
      size: limit,
      body: {
        sort: [{ scheduledAt: { order: 'desc' } }], // Keep newest emails at the top
        query: mustConditions.length > 0 ? {
          bool: {
            must: mustConditions,
          },
        } : { match_all: {} },
      },
    });

    const hits = response.hits.hits.map((hit: any) => hit._source);
    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;

    return {
      data: hits,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error: any) {
    console.error('Elasticsearch search execution error:', error);
    return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
  }
}