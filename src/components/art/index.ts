/*
  The art kit: batik and data, drawn in code. No image files. Styles live in
  src/styles/art.css. Everything here is decorative (aria-hidden); put meaning in text.
*/

export {
  BATIK_KINDS,
  BatikDefs,
  type BatikDefsProps,
  type BatikColors,
  type BatikKind,
  batikDataUri,
  batikPatternMarkup,
  batikSvg,
  batikTileSize,
  type BatikUriOptions,
} from "./patterns";
export { Landscape, LANDSCAPE_SIZE, type LandscapeProps, type LandscapeSun } from "./landscape";
export { mixHex, type Sky, skyAt, skyAtHour, type SkyPhase, SUNRISE, SUNSET } from "./sky";
export { KawungField, type KawungFieldHandle, type KawungFieldProps } from "./kawung-field";
export { Postcard, POSTCARD_NAMES, type PostcardProps, type PostcardTone } from "./postcard";
export { BatikFrame, type BatikFrameProps } from "./batik-frame";
export { Duotone, DuotoneFilter, type DuotoneFilterProps, type DuotoneProps } from "./duotone";
export { CapStamp, type CapStampProps, type CapStampState } from "./stamp";
export { fakeVector, hash, rng } from "./rng";
