import { Router, type Request, type Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { runConversation } from '../claude/conversation.js';

const router = Router();

export function createChatRouter(client: Anthropic): Router {
  router.post('/chat', async (req: Request, res: Response) => {
    const { ssl, matrix, userMessage } = req.body;

    if (!userMessage || typeof userMessage !== 'string') {
      res.status(400).json({ error: 'userMessage is required' });
      return;
    }

    if (!Array.isArray(matrix)) {
      res.status(400).json({ error: 'matrix must be a 2D number array' });
      return;
    }

    try {
      const result = await runConversation(
        client,
        ssl || '',
        matrix,
        userMessage.slice(0, 500), // cap user message length
      );

      res.json({
        updatedMatrix: result.updatedMatrix,
        aiMessage: result.aiMessage,
        toolCalls: result.toolCalls,
        sslSent: ssl || '(empty canvas)',
      });
    } catch (err) {
      console.error('Claude API error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
