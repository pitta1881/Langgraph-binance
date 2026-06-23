import type { AdminRepository } from './admin.repository.ts';

interface SessionSummary {
  session_id: string;
  user_email: string;
  started_at: string;
  ended_at: string;
  message_count: number;
  /** True when the user soft-deleted this session. */
  deleted: boolean;
  deleted_at: string | null;
}

const MAX_SESSIONS = 100;

export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  /**
   * Lists the top 100 most recently active sessions across ALL users — used
   * by the admin dashboard. Grouping happens in memory because PostgREST
   * doesn't expose window functions.
   */
  async listSessions(): Promise<SessionSummary[]> {
    const rows = await this.repo.listRecentChatSummaries();
    const map = new Map<string, Omit<SessionSummary, 'session_id'>>();

    for (const row of rows) {
      const existing = map.get(row.session_id);
      if (!existing) {
        map.set(row.session_id, {
          user_email: row.user_email,
          started_at: row.created_at,
          ended_at: row.created_at,
          message_count: 1,
          deleted: row.deleted_at != null,
          deleted_at: row.deleted_at ?? null,
        });
        continue;
      }
      if (row.created_at < existing.started_at) existing.started_at = row.created_at;
      if (row.created_at > existing.ended_at) existing.ended_at = row.created_at;
      existing.message_count += 1;
      // Mark the session deleted if ANY row in the group has been soft-deleted,
      // and track the most recent deletion timestamp.
      if (row.deleted_at != null) {
        existing.deleted = true;
        if (existing.deleted_at == null || row.deleted_at > existing.deleted_at) {
          existing.deleted_at = row.deleted_at;
        }
      }
    }

    return Array.from(map.entries())
      .map(([session_id, v]) => ({ session_id, ...v }))
      .sort((a, b) => b.ended_at.localeCompare(a.ended_at))
      .slice(0, MAX_SESSIONS);
  }

  listSessionChats(sessionId: string) {
    return this.repo.listSessionChats(sessionId);
  }

  listChatTraces(chatId: string) {
    return this.repo.listChatTraces(chatId);
  }
}
