import { _decorator, Component, SpriteFrame, Prefab, CCString } from 'cc';
const { ccclass, property } = _decorator;

export type HeroInfo = {
  tag: string;
  avatar: SpriteFrame | null;
  prefab: Prefab | null;
};

@ccclass('HeroInfoManager')
export class HeroInfoManager extends Component {
  @property({ type: [CCString], tooltip: '英雄标签列表（与头像、预制体索引一一对应）' })
  heroTags: string[] = [];

  @property({ type: [SpriteFrame], tooltip: '英雄头像（与标签按索引对应）' })
  avatars: SpriteFrame[] = [];

  @property({ type: [Prefab], tooltip: '英雄预制体（与标签按索引对应）' })
  prefabs: Prefab[] = [];

  getAvatar(tag: string): SpriteFrame | null {
    const i = this.heroTags.indexOf(tag);
    if (i < 0) return null;
    return this.avatars[i] ?? null;
  }

  getPrefab(tag: string): Prefab | null {
    const i = this.heroTags.indexOf(tag);
    if (i < 0) return null;
    return this.prefabs[i] ?? null;
  }

  getHeroInfo(tag: string): HeroInfo {
    return {
      tag,
      avatar: this.getAvatar(tag),
      prefab: this.getPrefab(tag),
    };
  }

  hasHero(tag: string): boolean {
    return this.heroTags.indexOf(tag) !== -1;
  }

  /**
   * 校验映射是否一致长度；返回不一致的原因字符串，null 表示通过。
   */
  validate(): string | null {
    if (this.heroTags.length !== this.avatars.length || this.heroTags.length !== this.prefabs.length) {
      return `映射长度不一致：tags=${this.heroTags.length}, avatars=${this.avatars.length}, prefabs=${this.prefabs.length}`;
    }
    return null;
  }
}

export default HeroInfoManager;