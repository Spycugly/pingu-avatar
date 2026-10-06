/* Pingu avatar: copy this folder into your project and import from it. See README.md. */

export { default as PinguAvatar, PINGU_AUTO, PINGU_WHITE } from "./PinguAvatar";
export type { PinguAvatarProps, PinguHandle, PinguState, Frozen } from "./PinguAvatar";
export { emitPingu, onPingu, syllableFor, type PinguEvent } from "./engine/bus";
export { SHAPE_NAMES, type ShapeName } from "./engine/shapes";
export { STATE_NAMES, resolveState, type EngineState } from "./engine/states";
