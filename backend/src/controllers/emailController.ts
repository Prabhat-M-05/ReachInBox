import { Request, Response } from 'express';
import { searchEmails } from '../services/elasticsearchService';

export async function handleSearchEmails(req: Request, res: Response) {
  try {
    const { q, query, status, senderId, userId, page, limit } = req.query;

    // Bridge property name differences between frontend and backend
    const searchQuery = (query || q) as string;
    const activeUserId = (userId || senderId) as string;

    const results = await searchEmails({
      query: searchQuery,
      status: status as string,
      senderId: activeUserId,
      userId: activeUserId, // Pass both in case elasticsearchService checks either
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return res.json(results);
  } catch (error: any) {
    console.error('Search API error:', error);
    return res.status(500).json({ error: 'Failed to execute email search' });
  }
}