export type Direction = 'up' | 'down' | 'left' | 'right';

export class InputManager {
  private keysDown = new Set<string>();
  private _direction: Direction | null = null;
  private _actionPressed = false;
  private _cancelPressed = false;
  private _menuPressed = false;

  // 方向入力のワンショット化（長押しリピート対応）
  private _lastDirection: Direction | null = null;
  private _dirHoldTime = 0;
  private _dirMoved = false;
  private static readonly DIR_INITIAL_DELAY = 12; // 初回リピートまでのフレーム数
  private static readonly DIR_REPEAT_DELAY = 6;   // リピート間隔フレーム数

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

  /** 方向入力のワンショット版（長押しリピート対応）。メニューカーソル移動に使用 */
  get directionJustPressed(): Direction | null {
    const dir = this._direction;
    if (dir === null) {
      this._lastDirection = null;
      this._dirHoldTime = 0;
      this._dirMoved = false;
      return null;
    }
    if (dir !== this._lastDirection) {
      // 新しい方向：即座に移動
      this._lastDirection = dir;
      this._dirHoldTime = 0;
      this._dirMoved = true;
      return dir;
    }
    // 同じ方向を押し続けている
    this._dirHoldTime++;
    if (!this._dirMoved) {
      this._dirMoved = true;
      return dir;
    }
    if (this._dirHoldTime >= InputManager.DIR_INITIAL_DELAY) {
      const elapsed = this._dirHoldTime - InputManager.DIR_INITIAL_DELAY;
      if (elapsed % InputManager.DIR_REPEAT_DELAY === 0) {
        return dir;
      }
    }
    return null;
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
