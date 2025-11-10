import { _decorator, Component, CCString } from 'cc';
import { BattlePageManager } from '../BattlePageManager';
const { ccclass, property } = _decorator;

@ccclass('BattleTestConfig')
export class BattleTestConfig extends Component {
  @property({ type: BattlePageManager })
  manager!: BattlePageManager;

  @property
  stageId: string = 'test-stage';

  @property({ type: [CCString], tooltip: '玩家可选择的英雄标签列表' })
  playerCandidates: string[] = [];

  @property({ type: [CCString], tooltip: '关卡敌人标签列表' })
  enemyTags: string[] = [];

  @property
  applyOnLoad: boolean = true;

  start() {
    if (this.applyOnLoad) this.applyConfig();
  }

  applyConfig() {
    if (!this.manager) return;
    this.manager.setHeroCandidates(this.playerCandidates);
    this.manager.configureRightByStage(this.stageId, this.enemyTags);
  }

  setCandidates(tags: string[]) {
    this.playerCandidates = tags;
    this.applyConfig();
  }

  setEnemies(tags: string[]) {
    this.enemyTags = tags;
    this.applyConfig();
  }
}

export default BattleTestConfig;