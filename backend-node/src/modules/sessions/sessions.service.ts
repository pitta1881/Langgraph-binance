import type { SessionsRepository } from './sessions.repository.ts';
import type { ChatSession, SessionMessage } from './sessions.schema.ts';

const FIRST_MESSAGE_MAX_LEN = 60;
const MAX_SESSIONS = 50;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export class SessionsService {
  constructor(private readonly repo: SessionsRepository) {}

  /**
   * Groups the user's recent chats by session_id and returns the latest 50
   * sessions, each labeled with the first user message truncated to 60 chars.
   */
  async listSessionsForUser(userId: string): Promise<ChatSession[]> {
    const rows = await this.repo.listRecentChatsForUser(userId);

    const map = new Map<string, {
      first_message: string;
      first_at: string;
      started_at: string;
      ended_at: string;
      message_count: number;
    }>();

    for (const row of rows) {
      const existing = map.get(row.session_id);
      if (!existing) {
        map.set(row.session_id, {
          first_message: row.message,
          first_at: row.created_at,
          started_at: row.created_at,
          ended_at: row.created_at,
          message_count: 1,
        });
        continue;
      }
      existing.message_count += 1;
      if (row.created_at < existing.started_at) existing.started_at = row.created_at;
      if (row.created_at > existing.ended_at) existing.ended_at = row.created_at;
      if (row.created_at < existing.first_at) {
        existing.first_at = row.created_at;
        existing.first_message = row.message;
      }
    }

    return Array.from(map.entries())
      .map(([session_id, v]) => ({
        session_id,
        first_message: truncate(v.first_message, FIRST_MESSAGE_MAX_LEN),
        started_at: v.started_at,
        ended_at: v.ended_at,
        message_count: v.message_count,
      }))
      .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
      .slice(0, MAX_SESSIONS);
  }

  getSessionMessages(sessionId: string, userId: string): Promise<SessionMessage[]> {
    return this.repo.listSessionMessages(sessionId, userId);
  }

  deleteSession(sessionId: string, userId: string): Promise<void> {
    return this.repo.softDeleteSession(userId, sessionId);
  }

  deleteAllSessions(userId: string): Promise<void> {
    return this.repo.softDeleteAllForUser(userId);
  }
}
