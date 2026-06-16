'use client';

import { DogEar } from './DogEar';

/**
 * Top-left corner dog-ear. Kept as a named placement component so existing page
 * surfaces don't need to change; the action it runs is configurable in settings
 * (defaults to immersive mode). See {@link DogEar}.
 */
export function ImmersiveDogEar() {
  return <DogEar corner="left" />;
}
