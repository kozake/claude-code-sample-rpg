import type { ChapterData, PartyMember } from '../data/types';

interface ContentIndex {
  chapters: ChapterData[];
  partyMembers: PartyMember[];
}

export class ContentLoader {
  private content: Partial<ContentIndex> = {};

  async loadInitial(): Promise<void> {
    // 起動時は最低限（chapters, party）のみ読み込み
    // マップ・NPC・敵は該当シーン進入時にオンデマンドロード
    try {
      const membersRes = await fetch('/content/party/members.json');
      if (membersRes.ok) {
        this.content.partyMembers = await membersRes.json();
      }
    } catch {
      // content がまだ無い場合はスキップ
    }

    try {
      const chaptersRes = await fetch('/content/story/chapters.json');
      if (chaptersRes.ok) {
        this.content.chapters = await chaptersRes.json();
      }
    } catch {
      // content がまだ無い場合はスキップ
    }
  }

  async loadJson<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(path);
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
