import { _decorator, Component, Vec3, Node, Sprite, SpriteFrame, assetManager } from 'cc';
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

  @property({ tooltip: '目标缩放值（统一缩放 x=y=scale）' })
  scale: number = 0.1;

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
      this._loading = false;
    }
    this.setScale(target);
    this._applied = true;
  }
}