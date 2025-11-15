import { _decorator, Component, Node, Animation, Vec3, AnimationClip } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 阴影动态缩放组件：
 * - 根据当前动画名称与动画时间，按设定范围对阴影进行周期性缩放。
 * - run 动作：在50% 范围内变化；die 动作5%；其他20%。
 * - 基准缩放取自阴影节点初始缩放（或通过 baseScale 指定）。
 */
@ccclass('DynamicShadowScaler')
export class DynamicShadowScaler extends Component {
  @property({ tooltip: '动画子节点名称（默认：人物贴图）' })
  actorChildName: string = '人物贴图';

  @property({ tooltip: '阴影子节点名称（默认：阴影）' })
  shadowNodeName: string = '阴影';

  baseScale: number;

  private _shadowNode: Node | null = null;
  private _anim: Animation | null = null;
  private _initialized = false;

  onEnable() {
    this.initRefs();
  }

  start() {
    this.initRefs();

    try {
      // 尝试获取当前播放状态；若没有，则回退到默认剪辑
      const cur = this.getCurrentState();
      const anim = this._anim as Animation | null;
      const clipAny: any = (cur?.clip as any) || (anim?.defaultClip as any) || null;
      const stateAny: any = cur?.state || null;

      const name = String(clipAny?.name || '(无剪辑)');
      const wrapMode = clipAny?.wrapMode;
      const sample = Number(clipAny?.sample ?? NaN);
      const duration = Number(clipAny?.duration ?? NaN);

      // 兼容不同版本：通过枚举或位掩码判断是否循环
      const WM: any = (AnimationClip as any)?.WrapMode;
      const isLoop = (() => {
        try {
          if (WM && typeof wrapMode === 'number') {
            return wrapMode === WM.Loop || ((wrapMode & WM.Loop) === WM.Loop);
          }
          const s = String(wrapMode ?? '').toLowerCase();
          return s.includes('loop');
        } catch { return false; }
      })();

      const isPlaying = !!(stateAny && (stateAny.isPlaying === true || stateAny.playing === true));

      // 输出关键信息到控制台
      console.log(
        `[DynamicShadowScaler] start: 剪辑="${name}", wrapMode=${wrapMode}, 是否循环=${isLoop}, 是否播放中=${isPlaying}, sample=${isNaN(sample) ? '-' : sample}, duration=${isNaN(duration) ? '-' : duration}`
      );
    } catch (e) {
      console.log('[DynamicShadowScaler] start: 读取动画状态失败', e);
    }
  }

  private initRefs() {
    try {
      // 阴影节点在同级下查找
      this._shadowNode = this.node.getChildByName(this.shadowNodeName) || null;
      // 动画组件在指定子节点下查找
      const actorNode = this.node.getChildByName(this.actorChildName) || null;
      this._anim = actorNode ? (actorNode.getComponent(Animation) || null) : null;
      if (this._shadowNode && !this._initialized) {
        const s = this._shadowNode.scale;
        // 若用户未显式设置 baseScale，则以当前缩放为基准
        if (!this.baseScale || this.baseScale <= 0) {
          this.baseScale = s.x;
        }
        this._initialized = true;
      }
    } catch (e) {
      // 保底，不抛异常以免影响其他逻辑
    }
  }

  update(deltaTime: number) {
    if (!this._shadowNode) return;

    const current = this.getCurrentState();
    let amplitude = 0.1; // 默认 ±20%
    let phase = 0;       // 0 表示不变化

    if (current) {
      const name = (current.clip?.name || '').toLowerCase();
      if (name.includes('run')) amplitude = 0.25;
      else if (name.includes('die')) amplitude = 0.025;
      else amplitude = 0.1;



      const clip = current.clip as any;
      const sample: number = Math.max(1, Number(clip?.sample) || 12);
      const duration: number = Math.max(0.001, Number(clip?.duration) || 1);
      const framesCount = Math.max(1, Math.floor(sample * duration));
      const time = Number(current.state?.time) || 0;
      const frameIndex = Math.floor(time * sample) % framesCount;
      phase = (frameIndex / framesCount) * Math.PI * 2;
    }

    // 在指定范围内以正弦波周期变化：scale = base * (1 + amp * sin(phase))
    const factor = 1 + amplitude * Math.sin(phase);
    const next = Math.max(0.001, this.baseScale * factor);
    const z = this._shadowNode.scale.z;
    // 使用数值重载避免频繁分配 Vec3
    this._shadowNode.setScale(next, next, z);
  }

  private getCurrentState(): { clip: any; state: any } | null {
    if (!this._anim) return null;

    // 1) 首选读取当前激活状态（私有字段，兼容不同版本）
    const animAny = this._anim as any;
    const cur = animAny?._curState ?? animAny?._currentState ?? animAny?._activeState;
    try {
      if (cur && (cur.isPlaying === true || cur.playing === true)) {
        const c = (cur.clip || null);
        if (c) return { clip: c, state: cur };
      }
    } catch { /* 忽略 */ }

    // 2) 次选：如果有公开的 getStates() 方法，挑选正在播放的
    try {
      const getStates = animAny?.getStates;
      if (typeof getStates === 'function') {
        const states: any[] = getStates.call(animAny) || [];
        for (const s of states) {
          if (s && (s.isPlaying === true || s.playing === true) && s.clip) {
            return { clip: s.clip, state: s };
          }
        }
      }
    } catch { /* 忽略 */ }

    // 3) 兜底：遍历剪辑，尝试按名称或剪辑对象获取状态
    try {
      const clips = (this._anim.clips || []) as any[];
      for (const clip of clips) {
        const name = String(clip?.name || '');
        let st: any = null;
        try { st = this._anim.getState(clip); } catch { /* 有些版本支持传对象 */ }
        if (!st && name) {
          try { st = this._anim.getState(name); } catch { /* 有些版本只支持传名称 */ }
        }
        if (st && (st.isPlaying === true || st.playing === true)) {
          return { clip, state: st };
        }
      }
    } catch { /* 忽略 */ }

    // 4) 最后：尝试默认剪辑
    try {
      const dc = this._anim.defaultClip as any;
      if (dc) {
        const st = ((): any => {
          try { return this._anim.getState(dc); } catch { /* 忽略 */ }
          try { return this._anim.getState(String(dc?.name || '')); } catch { /* 忽略 */ }
          return null;
        })();
        if (st && (st.isPlaying === true || st.playing === true)) {
          return { clip: dc, state: st };
        }
      }
    } catch { /* 忽略 */ }

    return null;
  }
}

export default DynamicShadowScaler;