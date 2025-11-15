import { _decorator, Component, Vec3, Node, Sprite, SpriteFrame, assetManager, Animation, AnimationClip, animation, UITransform, ProgressBar, Color } from 'cc';
import { DynamicShadowScaler } from '../组件/DynamicShadowScaler';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode } = _decorator;
declare const Editor: any;

/**
 * 在编辑器模式下运行：
 * - 将节点缩放设置为 0.1, 0.1
 * - 自动缩放目标子节点（默认名称：人物贴图）到指定 scale
 * 使用方法：把该组件挂到对应的角色父节点上即可。
 */
@ccclass('AutoSpriteFromName')
@executeInEditMode
export class AutoSpriteFromName extends Component {

  // @property({ tooltip: '目标缩放值（统一缩放 x=y=scale）' })
  private scale: number = 0.45;

  @property({ tooltip: '是否在每次编辑器刷新都强制重新匹配' })
  forceRefresh: boolean = false;

  @property({ tooltip: '用于挂载 Sprite 的子节点名称（默认：人物贴图）' })
  targetChildName: string = '人物贴图';

  @property({ tooltip: '资源基础路径（db://assets/人物）' })
  baseDbDir: string = 'db://assets/人物';

  @property({ tooltip: '指定文件名（不含扩展名）；留空则使用节点名' })
  fileName: string = '';

  @property({ tooltip: '图片扩展名（默认 png）' })
  ext: string = 'png';

  @property({ tooltip: '如果缺少子节点，是否自动创建并挂载 Sprite' })
  autoCreateChild: boolean = true;

  @property({ tooltip: '为 Sprite 设置 RAW 尺寸模式' })
  setRawSizeMode: boolean = true;

  @property({ tooltip: '是否自动为动作文件夹生成动画剪辑并添加到 Animation' })
  autoGenerateClips: boolean = true;

  @property({ tooltip: '动画采样率（FPS）' })
  animationSample: number = 12;

  @property({ tooltip: '目录名包含“die”时，剪辑使用一次播放（非循环）' })
  nonLoopForDie: boolean = true;

  @property({ tooltip: '阴影图片资源路径（db://assets/images/shadow/Shadow_01.png）' })
  shadowDbUrl: string = 'db://assets/images/shadow/Shadow_01.png';

  private shadowScale: number = 0.3;
  private shadowPos: Vec3 = new Vec3(0, 50, 0);

  // 技能条的 Y 坐标通过私有参数控制
  private _skillBarY: number = 160;
  private _hpBarY: number = 170;

  private _applied = false;
  private _loading = false;

  onEnable() {
    if (EDITOR) {
      // 立即尝试应用一次
      this.applyNow();
    }
  }

  update() {
    if (!EDITOR) return;
    if (this.forceRefresh || !this._applied) {
      // 异步应用，避免频繁重复加载
      void this.applyNow();
    }
  }

  private setScale(target: Node | null) {
    if (!target) return;
    const s = this.scale;
    const current = target.scale;
    if (Math.abs(current.x - s) > 1e-4 || Math.abs(current.y - s) > 1e-4) {
      target.setScale(new Vec3(s, s, current.z));
    }
  }

  private getTargetNodeOrCreate(): Node {
    const child = this.node.getChildByName(this.targetChildName);
    if (child) return child;
    if (!this.autoCreateChild) return this.node;
    const created = new Node(this.targetChildName);
    created.parent = this.node;
    return created;
  }

  private ensureSprite(target: Node): Sprite {
    let sp = target.getComponent(Sprite);
    if (!sp) sp = target.addComponent(Sprite);
    return sp;
  }

  private resolveFileName(): string {
    const name = (this.fileName && this.fileName.trim().length > 0) ? this.fileName.trim() : this.node.name.trim();
    return name;
  }

  // 在 3.x 中，子资源路径不包含扩展名：image/spriteFrame
  private buildDbBaseUrl(): string {
    const name = this.resolveFileName();
    return `${this.baseDbDir}/${name}`;
  }

  private getActorDirUrl(): string {
    // 角色目录：db://assets/人物/<角色名>
    return this.buildDbBaseUrl();
  }

  private async querySpriteFrameUuid(): Promise<string | null> {
    try {
      if (!Editor?.Message?.request) return null;
      const baseUrl = this.buildDbBaseUrl();
      const ext = this.ext.startsWith('.') ? this.ext.slice(1) : this.ext;
      // 仅保留方法五：在 baseDbDir 下检索所有 SpriteFrame，按 URL/名称匹配
      const all = await Editor.Message.request('asset-db', 'query-assets', {
        pattern: `${this.baseDbDir}/**`,
        ccType: 'cc.SpriteFrame',
      });
      if (Array.isArray(all) && all.length > 0) {
        const targetUrl1 = `${baseUrl}/spriteFrame`;
        const targetUrl2 = `${baseUrl}.${ext}/spriteFrame`;
        const found = all.find((ai: any) => ai?.url === targetUrl1 || ai?.url === targetUrl2);
        if (found?.uuid) return found.uuid;
        // 次选：按名称末尾匹配
        const name = this.resolveFileName();
        const byName = all.find((ai: any) => {
          const u = String(ai?.url || '');
          return u.endsWith(`/${name}/spriteFrame`) || u.endsWith(`/${name}.${ext}/spriteFrame`);
        });
        if (byName?.uuid) return byName.uuid;
      }
    } catch (e) {
      console.warn('[AutoSpriteFromName] 查询 SpriteFrame 失败：', e);
    }
    return null;
  }

  private loadSpriteFrameByUuid(uuid: string): Promise<SpriteFrame> {
    return new Promise<SpriteFrame>((resolve, reject) => {
      assetManager.loadAny({ uuid, ccType: SpriteFrame }, (err: Error | null, asset: any) => {
        if (err) return reject(err);
        resolve(asset as SpriteFrame);
      });
    });
  }

  private async applyNow() {
    const target = this.getTargetNodeOrCreate();
    const sprite = this.ensureSprite(target);
    if (EDITOR && !this._loading) {
      this._loading = true;
      const uuid = await this.querySpriteFrameUuid();
      if (uuid) {
        try {
          const sf = await this.loadSpriteFrameByUuid(uuid);
          sprite.spriteFrame = sf;
          if (this.setRawSizeMode) {
            sprite.sizeMode = Sprite.SizeMode.RAW;
          }
        } catch (e) {
          console.warn('[AutoSpriteFromName] 加载 SpriteFrame 失败：', e);
        }
      } else {
        console.warn(`[AutoSpriteFromName] 未找到 SpriteFrame：${this.buildDbBaseUrl()}/spriteFrame`);
      }
      // 生成并挂载动画剪辑
      if (this.autoGenerateClips) {
        await this.applyAnimationClips(target);
      }

      // 应用阴影
      await this.applyShadow();

      // 在编辑器模式下，自动挂载阴影动态缩放脚本
      this.ensureDynamicShadowScaler();

      // 创建并配置生命条和技能条
      await this.applyBars();

      this._loading = false;
    }
    this.setScale(target);
    this._applied = true;

    // 层级调整：人物贴图在最上层，其次是阴影与血/技能条
    this.adjustLayerOrder(target);
  }

  private ensureAnimation(target: Node): Animation {
    let anim = target.getComponent(Animation);
    if (!anim) anim = target.addComponent(Animation);
    return anim;
  }

  private async applyAnimationClips(target: Node) {
    try {
      if (!Editor?.Message?.request) return;
      const actorUrl = this.getActorDirUrl();
      // 在角色目录下检索所有 SpriteFrame 资源
      const all = await Editor.Message.request('asset-db', 'query-assets', {
        pattern: `${actorUrl}/**`,
        ccType: 'cc.SpriteFrame',
      });
      if (!Array.isArray(all) || all.length === 0) return;

      // 根据第一层子目录分组（动作目录）
      const groups: Map<string, any[]> = new Map();
      for (const ai of all) {
        const url = String(ai?.url || '');
        if (!url.startsWith(actorUrl + '/')) continue;
        const rest = url.slice(actorUrl.length + 1); // 形如：hero_run/xxx/spriteFrame
        const parts = rest.split('/');
        if (parts.length < 2) continue; // 排除顶层 spriteFrame
        const action = parts[0];
        if (!action || action === 'spriteFrame') continue;
        const list = groups.get(action) || [];
        list.push(ai);
        groups.set(action, list);
      }

      if (groups.size === 0) return;

      const anim = this.ensureAnimation(target);
      const existingClips: AnimationClip[] = anim.clips ? anim.clips.slice() : [];

      for (const [action, items] of groups.entries()) {
        // 按 URL 字典序排序以匹配文件名顺序
        items.sort((a: any, b: any) => String(a?.url || '').localeCompare(String(b?.url || '')));
        const uuids: string[] = items
          .map((ai: any) => String(ai?.uuid || ''))
          .filter(u => !!u);
        if (uuids.length === 0) continue;

        // 加载所有帧
        const frames: SpriteFrame[] = [];
        for (const u of uuids) {
          try {
            const sf = await this.loadSpriteFrameByUuid(u);
            frames.push(sf);
          } catch (e) {
            console.warn(`[AutoSpriteFromName] 加载帧失败（${action}）：`, u, e);
          }
        }
        if (frames.length === 0) continue;

        // 将动作目录映射到已有空剪辑名称
        const mappedName = this.mapActionToClipName(action);
        const targetClip = existingClips.find(c => c && c.name && c.name.toLowerCase() === mappedName.toLowerCase());
        if (targetClip) {
          // 编辑已有剪辑（清空并重建 spriteFrame 轨道），随后保存资产
          this.rebuildSpriteClip(targetClip, frames, /die/i.test(action));
        } 
      }

      // 应用到 Animation 组件
      anim.clips = existingClips;
      anim.playOnLoad = true;
      // 优先选择 idle/daiji 作为默认剪辑
      const idleClip = existingClips.find(c => {
        const n = String(c?.name || '').toLowerCase();
        return n === 'idle' || n === 'daiji';
      });
      if (!anim.defaultClip) {
        anim.defaultClip = idleClip || (existingClips.length > 0 ? existingClips[0] : null as any);
      }
      // 如果当前没有任何播放状态，则主动播放默认剪辑（编辑器/运行时都生效）
      try {
        const animAny: any = anim as any;
        let anyPlaying = false;
        const getStates = animAny?.getStates;
        if (typeof getStates === 'function') {
          const states: any[] = getStates.call(animAny) || [];
          anyPlaying = states.some(s => s && (s.isPlaying === true || s.playing === true));
        }
        if (!anyPlaying) {
          const name = String((anim.defaultClip as any)?.name || (idleClip as any)?.name || (existingClips[0] as any)?.name || '');
          if (name) anim.play(name);
        }
      } catch { /* 忽略播放失败 */ }
    } catch (e) {
      console.warn('[AutoSpriteFromName] 自动生成动画剪辑失败：', e);
    }
  }

  private mapActionToClipName(actionDir: string): string {
    const a = actionDir.toLowerCase();
    const map: Record<string, string> = {
      'hero_daiji': 'daiji',
      'hero_die': 'die',
      'hero_hit': 'hit',
      'hero_kill': 'kill',
      'hero_run': 'run',
    };
    if (map[a]) return map[a];
    // 兜底：去掉可能的前缀 hero_
    return a.replace(/^hero_/, '');
  }

  private rebuildSpriteClip(clip: AnimationClip, frames: SpriteFrame[], isDie: boolean) {
    try {
      const sample = this.animationSample > 0 ? this.animationSample : 12;
      // 使用引擎自带的 API 生成基于 SpriteFrame 的剪辑（确保类型识别正确）
      const generated = AnimationClip.createWithSpriteFrames(frames, sample);
      const wrap = (this.nonLoopForDie && isDie)
        ? AnimationClip.WrapMode.Normal
        : AnimationClip.WrapMode.Loop;
      generated.wrapMode = wrap;

      // 覆盖到现有空剪辑
      clip.sample = generated.sample;
      clip.duration = generated.duration;
      clip.wrapMode = wrap;
      // 直接替换内部轨道数组（不同版本可能为 _tracks 或 tracks）
      // @ts-ignore
      const genTracks = (generated as any)._tracks ?? (generated as any).tracks ?? [];
      // @ts-ignore
      clip._tracks = genTracks;
      // 不再尝试写入只读的 tracks getter，避免编辑器抛错
    } catch (e) {
      console.warn('[AutoSpriteFromName] 重建剪辑失败：', clip?.name, e);
    }
  }

  private async querySpriteFrameUuidByUrl(dbUrl: string): Promise<string | null> {
    try {
      if (!Editor?.Message?.request) return null;
      const list = await Editor.Message.request('asset-db', 'query-assets', {
        pattern: 'db://assets/images/shadow/**',
        ccType: 'cc.SpriteFrame',
      });
      if (!Array.isArray(list) || list.length === 0) return null;
      const candidates = [
        `${dbUrl}/spriteFrame`,
        `${dbUrl.replace(/\.png$/i, '')}/spriteFrame`,
      ];
      const found = list.find((ai: any) => candidates.includes(String(ai?.url || '')));
      return found?.uuid || null;
    } catch (e) {
      console.warn('[AutoSpriteFromName] 查询阴影 SpriteFrame 失败：', e);
      return null;
    }
  }

  private async applyShadow() {
    try {
      let shadow = this.node.getChildByName('阴影');
      if (!shadow) {
        shadow = new Node('阴影');
        shadow.parent = this.node;
      }
      const sp = this.ensureSprite(shadow);
      const uuid = await this.querySpriteFrameUuidByUrl(this.shadowDbUrl);
      if (uuid) {
        try {
          const sf = await this.loadSpriteFrameByUuid(uuid);
          sp.spriteFrame = sf;
          if (this.setRawSizeMode) {
            sp.sizeMode = Sprite.SizeMode.RAW;
          }
        } catch (e) {
          console.warn('[AutoSpriteFromName] 加载阴影 SpriteFrame 失败：', e);
        }
      } else {
        console.warn(`[AutoSpriteFromName] 未找到阴影 SpriteFrame：${this.shadowDbUrl}/spriteFrame`);
      }
      // 独立缩放阴影
      const s = this.shadowScale;
      const cs = shadow.scale;
      shadow.setScale(new Vec3(s, s, cs.z));
      // 设置阴影位置
      shadow.setPosition(this.shadowPos);
    } catch (e) {
      console.warn('[AutoSpriteFromName] 应用阴影失败：', e);
    }
  }

  private async ensureProgressBar(name: string, y: number, colors: { bg: Color; bar: Color }): Promise<Node> {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.parent = this.node;
    }
    const ui = node.getComponent(UITransform) || node.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    // 固定长度 50，高度 5，避免超出
    // @ts-ignore
    ui.width = 50;
    // @ts-ignore
    ui.height = 5;
    node.setPosition(0, y, node.position.z);

    // 背景
    let bg = node.getChildByName('Background');
    if (!bg) {
      bg = new Node('Background');
      bg.parent = node;
    }
    const bgUi = bg.getComponent(UITransform) || bg.addComponent(UITransform);
    bgUi.setAnchorPoint(0.5, 0.5);
    // 复用父 UITransform 的宽高
    // @ts-ignore
    bgUi.width = ui.width;
    // @ts-ignore
    bgUi.height = ui.height;
    const bgSprite = bg.getComponent(Sprite) || bg.addComponent(Sprite);

    // Bar
    let bar = node.getChildByName('Bar');
    if (!bar) {
      bar = new Node('Bar');
      bar.parent = node;
    }
    const barUi = bar.getComponent(UITransform) || bar.addComponent(UITransform);
    barUi.setAnchorPoint(0.5, 0.5);
    // 复用父 UITransform 的宽高
    // @ts-ignore
    barUi.width = ui.width;
    // @ts-ignore
    barUi.height = ui.height;
    const barSprite = bar.getComponent(Sprite) || bar.addComponent(Sprite);

    bar.setPosition(0, 0, bar.position.z);
    bg.setPosition(0, 0, bg.position.z);

    // 加载一个默认的 SpriteFrame 并应用单色
    try {
      const defUuid = await this.getDefaultSpriteFrameUuid();
      if (defUuid) {
        const defSf = await this.loadSpriteFrameByUuid(defUuid);
        // 将图片模式改为 CUSTOM，避免按原始尺寸溢出
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        barSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSprite.spriteFrame = defSf;
        barSprite.spriteFrame = defSf;
      }
    } catch (e) {
      console.warn('[AutoSpriteFromName] 加载默认 SpriteFrame 失败：', e);
    }

    // 颜色（单色）设置（在组件有效时应用，避免编辑器断言）
    try {
      // @ts-ignore
      if ((bgSprite as any).isValid) {
        bgSprite.color = colors.bg;
      }
      // @ts-ignore
      if ((barSprite as any).isValid) {
        barSprite.color = colors.bar;
      }
    } catch (e) {
      console.warn('[AutoSpriteFromName] 设置进度条颜色失败：', e);
    }

    // 作为水平填充条（需存在有效的 SpriteFrame）
    if (barSprite.spriteFrame) {
      barSprite.fillStart = 0;
      barSprite.fillRange = 1;
    }

    const pb = node.getComponent(ProgressBar) || node.addComponent(ProgressBar);
    pb.barSprite = barSprite;
    pb.mode = ProgressBar.Mode.HORIZONTAL;
    pb.reverse = false;
    return node;
  }

  private async applyBars() {
    // 生命条在上，技能条在下；高度统一 5，使用单色
    const hpBarNode = await this.ensureProgressBar('生命条', this._hpBarY, {
      bg: new Color(60, 60, 60, 255),
      bar: new Color(150, 255, 0, 255),
    });
    const skillBarNode = await this.ensureProgressBar('技能条', this._skillBarY, {
      bg: new Color(60, 60, 60, 255),
      bar: new Color(255, 214, 0, 255),
    });

    // 默认隐藏生命条与技能条，供运行时脚本或逻辑按需显示
    try {
      if (hpBarNode) hpBarNode.active = false;
      if (skillBarNode) skillBarNode.active = false;
    } catch (e) {
      console.warn('[AutoSpriteFromName] 隐藏进度条失败：', e);
    }
  }

  private adjustLayerOrder(spriteNode: Node) {
    try {
      // 目标顺序：阴影 -> 生命条 -> 技能条 -> 人物贴图（最上层）
      const shadow = this.node.getChildByName('阴影');
      const hp = this.node.getChildByName('生命条');
      const sp = this.node.getChildByName('技能条');

      const ordered: (Node | null)[] = [shadow, hp, sp, spriteNode];
      let idx = 0;
      for (const n of ordered) {
        if (n) {
          n.setSiblingIndex(idx);
          idx++;
        }
      }
    } catch (e) {
      console.warn('[AutoSpriteFromName] 层级调整失败：', e);
    }
  }

  private async getDefaultSpriteFrameUuid(): Promise<string | null> {
    try {
      if (!Editor?.Message?.request) return null;
      const list = await Editor.Message.request('asset-db', 'query-assets', {
        pattern: 'db://internal/**',
        ccType: 'cc.SpriteFrame',
      });
      if (!Array.isArray(list) || list.length === 0) return null;
      const found = list.find((ai: any) => {
        const u = String(ai?.url || '').toLowerCase();
        return u.endsWith('/default_sprite/spriteFrame'.toLowerCase()) || u.includes('default_sprite');
      });
      return found?.uuid || null;
    } catch (e) {
      console.warn('[AutoSpriteFromName] 查询默认 SpriteFrame 失败：', e);
      return null;
    }
  }

  private ensureDynamicShadowScaler() {
    try {
      let comp = this.node.getComponent(DynamicShadowScaler);
      if (!comp) {
        comp = this.node.addComponent(DynamicShadowScaler);
      }
      // 将人物贴图子节点名与阴影节点名同步给组件
      comp.actorChildName = this.targetChildName;
      comp.shadowNodeName = '阴影';
      comp.baseScale = this.shadowScale;
    } catch (e) {
      console.warn('[AutoSpriteFromName] 挂载阴影动态缩放组件失败：', e);
    }
  }
}