import { Game } from './Game';
import { TitleScene } from './scenes/TitleScene';

async function main(): Promise<void> {
  const game = await Game.create();
  const titleScene = new TitleScene(game);
  await game.scenes.switchTo(titleScene);
}

main().catch(console.error);
