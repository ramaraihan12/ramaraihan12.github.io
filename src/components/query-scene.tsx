import { HeroLand } from "./scenes/opening/hero-land";
import { OpeningScene } from "./scenes/opening/opening-scene";

/**
 * The first scene: the question, its tokens, its embedding and the notes it pulls back. The
 * landscape behind the question is drawn here on the server and handed to the client scene, so
 * its geometry ships as markup instead of JavaScript.
 */
export function QueryScene() {
  return <OpeningScene land={<HeroLand />} />;
}
