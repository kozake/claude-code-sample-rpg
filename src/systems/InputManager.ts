export type Direction = 'up' | 'down' | 'left' | 'right';

export class InputManager {
  private keysDown = new Set<string>();
  private _direction: Direction | null = null;
  private _actionPressed = false;
  private _cancelPressed = false;
  private _menuPressed = false;

  // タッチ入力（DPad等から設定される）
  private touchDirection: Direction | null = null;
  private touchAction = false;
  private touchCancel = false;
  private touchMenu = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.key);
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') this._actionPressed = true;
      if (e.key === 'Escape' || e.key === 'x') this._cancelPressed = true;
      if (e.key === 'm') this._menuPressed = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
    });
  }

  update(): void {
    // キーボードから方向を取得
    let kbDir: Direction | null = null;
    if (this.keysDown.has('ArrowUp') || this.keysDown.has('w')) kbDir = 'up';
    else if (this.keysDown.has('ArrowDown') || this.keysDown.has('s')) kbDir = 'down';
    else if (this.keysDown.has('ArrowLeft') || this.keysDown.has('a')) kbDir = 'left';
    else if (this.keysDown.has('ArrowRight') || this.keysDown.has('d')) kbDir = 'right';

    // タッチ優先、なければキーボード
    this._direction = this.touchDirection ?? kbDir;
  }

  /** 毎フレーム末尾で呼ぶ: ワンショット入力をリセット */
  resetOneShot(): void {
    this._actionPressed = false;
    this._cancelPressed = false;
    this._menuPressed = false;
    this.touchAction = false;
    this.touchCancel = false;
    this.touchMenu = false;
  }

  // --- タッチ入力用セッター（DPad / ActionButton から呼ばれる） ---
  setTouchDirection(dir: Direction | null): void {
    this.touchDirection = dir;
  }

  setTouchAction(): void {
    this.touchAction = true;
    this._actionPressed = true;
  }

  setTouchCancel(): void {
    this.touchCancel = true;
    this._cancelPressed = true;
  }

  setTouchMenu(): void {
    this.touchMenu = true;
    this._menuPressed = true;
  }

  // --- ゲッター ---
  get direction(): Direction | null {
    return this._direction;
  }

  get isActionPressed(): boolean {
    return this._actionPressed || this.touchAction;
  }

  get isCancelPressed(): boolean {
    return this._cancelPressed || this.touchCancel;
  }

  get isMenuPressed(): boolean {
    return this._menuPressed || this.touchMenu;
  }
}
