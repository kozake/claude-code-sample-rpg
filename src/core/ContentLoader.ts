import type { ChapterData, PartyMember } from '../data/types';

const BASE = import.meta.env.BASE_URL;

interface ContentIndex {
  chapters: ChapterData[];
  partyMembers: PartyMember[];
}

export class ContentLoader {
  private content: Partial<ContentIndex> = {};

  async loadInitial(): Promise<void> {
    try {
      const membersRes = await fetch(`${BASE}content/party/members.json`);
      if (membersRes.ok) {
        this.content.partyMembers = await membersRes.json();
      }
    } catch {
      // content がまだ無い場合はスキップ
    }

    try {
      const chaptersRes = await fetch(`${BASE}content/story/chapters.json`);
      if (chaptersRes.ok) {
        this.content.chapters = await chaptersRes.json();
      }
    } catch {
      // content がまだ無い場合はスキップ
    }
  }

  async loadJson<T>(path: string): Promise<T | null> {
    try {
      const url = path.startsWith('http') ? path : `${BASE}content/${path}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  getPartyMembers(): PartyMember[] {
    return this.content.partyMembers ?? [];
  }

  getChapters(): ChapterData[] {
    return this.content.chapters ?? [];
  }
}
