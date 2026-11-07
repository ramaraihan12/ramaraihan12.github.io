import { queryCopy } from "@/content/copy";
import { aiProjects, webProjects } from "@/content/projects";
import { ArrowUpRightIcon } from "./icons";
import { HeroLand } from "./scenes/opening/hero-land";
import { OpeningScene } from "./scenes/opening/opening-scene";

/** Three demos to open straight from the first screen. They open the way the project panels do. */
function HeroDemos() {
  const projects = [...aiProjects, ...webProjects];
  return (
    <div className="qs-demos">
      <p id="hero-demos" className="qs-demos-label">
        {queryCopy.demosLabel}
      </p>
      {/* role: Safari drops list semantics once the markers are removed */}
      <ul role="list" className="qs-demo-list" aria-labelledby="hero-demos">
        {queryCopy.demos.map(({ name, what }) => {
          const demo = projects.find((p) => p.name === name)?.demo;
          return demo ? (
            <li key={name}>
              <a href={demo} className="qs-demo">
                <span className="qs-demo-name">{name}</span>
                <span className="qs-demo-what">{what}</span>
                <ArrowUpRightIcon className="size-4" />
              </a>
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
}

/**
 * The first scene: the question, its tokens, its embedding and the notes it pulls back. The
 * landscape behind the question is drawn here on the server and handed to the client scene, so
 * its geometry ships as markup instead of JavaScript.
 */
export function QueryScene() {
  return <OpeningScene land={<HeroLand />} demos={<HeroDemos />} />;
}
