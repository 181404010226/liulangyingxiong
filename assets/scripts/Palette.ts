/*******************************************************************************
 * 创建: 2024年08月28日
 * 作者: 水煮肉片饭(27185709@qq.com)
 * 描述: 调色板，实现Sprite或Label颜色渐变
*******************************************************************************/
import { _decorator, UIRenderer, Component, Color, clamp, director, Director, Sprite, Label } from 'cc';
import { DEV, JSB } from 'cc/env';
const { ccclass, property, executeInEditMode, requireComponent, menu } = _decorator;
@ccclass
@executeInEditMode
@requireComponent(UIRenderer)
@menu('Public/Palette')
export class Palette extends Component {
    @property
    private _colorLB: Color = new Color(255, 255, 255, 255);
    @property({ displayName: DEV && '↙ 左下' })
    private get colorLB() { return this._colorLB };
    private set colorLB(value: Color) {
        this._colorLB = value;
        this.updateColor();
    }
    @property
    private _colorRB: Color = new Color(255, 255, 255, 255);
    @property({ displayName: DEV && '↘ 右下' })
    private get colorRB() { return this._colorRB };
    private set colorRB(value: Color) {
        this._colorRB = value;
        this.updateColor();
    }
    @property
    private _colorLT: Color = new Color(255, 255, 255, 255);
    @property({ displayName: DEV && '↖ 左上' })
    private get colorLT() { return this._colorLT };
    private set colorLT(value: Color) {
        this._colorLT = value;
        this.updateColor();
    }
    @property
    private _colorRT: Color = new Color(255, 255, 255, 255);
    @property({ displayName: DEV && '↗ 右上' })
    private get colorRT() { return this._colorRT };
    private set colorRT(value: Color) {
        this._colorRT = value;
        this.updateColor();
    }
    @property
    private _hueRatio: number = 1;
    @property({ range: [0, 1], step: 0.01, slide: true, displayName: '🌈 色相' })
    get hueRatio() { return this._hueRatio; }
    set hueRatio(val) {
        this._hueRatio = clamp(val, 0, 1);
        this.updateHueRatio();
        this.updateColor();
    }
    @property
    private _darkness: number = 1;
    @property({ range: [0, 1], step: 0.01, slide: true, displayName: '🌞 暗度' })
    get darkness() { return this._darkness; }
    set darkness(val) {
        this._darkness = clamp(val, 0, 1);
        this.updateColor();
    }
    private ur: UIRenderer = null;
    private hue: number[] = [1, 1, 1];      //色相分量
    protected onLoad() {
        this.ur = this.node.getComponent(UIRenderer);
        if (!(this.ur instanceof Sprite || this.ur instanceof Label)) {
            console.warn('Palette只对Sprite和Label有效！');
            this.destroy();
            return;
        }
        this.ur['_useVertexOpacity'] = true;  //启用顶点透明度（否则透明度只受color.a影响）
    }
    protected onEnable() {
        this.updateHueRatio();
        director.once(Director.EVENT_AFTER_DRAW, this.updateColor, this);
    }
    protected onDisable() {
        if (!this.ur['_renderData']) return;
        let vb = this.ur['_renderData'].chunk.vb;
        let color = this.ur.color;
        vb[5] = vb[14] = vb[23] = vb[32] = color.r / 255;
        vb[6] = vb[15] = vb[24] = vb[33] = color.g / 255;
        vb[7] = vb[16] = vb[25] = vb[34] = color.b / 255;
        vb[8] = vb[17] = vb[26] = vb[35] = color.a / 255;
    }
    private updateColor() {
        let vb = this.ur['_renderData'].chunk.vb;
        let lb = this._colorLB, rb = this._colorRB, lt = this._colorLT, rt = this._colorRT;
        let d = this._darkness / 255, h = this.hue, r = h[0] * d, g = h[1] * d, b = h[2] * d;
        vb[5] = lb.r * r; vb[6] = lb.g * g; vb[7] = lb.b * b; vb[8] = lb.a / 255;
        vb[14] = rb.r * r; vb[15] = rb.g * g; vb[16] = rb.b * b; vb[17] = rb.a / 255;
        vb[23] = lt.r * r; vb[24] = lt.g * g; vb[25] = lt.b * b; vb[26] = lt.a / 255;
        vb[32] = rt.r * r; vb[33] = rt.g * g; vb[34] = rt.b * b; vb[35] = rt.a / 255;
    }
    private updateHueRatio(): void {
        const step = 1 / 7;
        let hueRatio = this._hueRatio;
        if (hueRatio < step) this.hue = [1, hueRatio / step, 0];
        else if (hueRatio < step * 2) this.hue = [2 - hueRatio / step, 1, 0];
        else if (hueRatio < step * 3) this.hue = [0, 1, hueRatio / step - 2];
        else if (hueRatio < step * 4) this.hue = [0, 4 - hueRatio / step, 1];
        else if (hueRatio < 5 * step) this.hue = [hueRatio / step - 4, 0, 1];
        else if (hueRatio < 6 * step) this.hue = [1, 0, 6 - hueRatio / step];
        else { this.hue = [1, hueRatio / step - 6, hueRatio / step - 6]; }
    }
}