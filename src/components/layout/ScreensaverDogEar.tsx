'use client';

import { DogEar } from './DogEar';

/**
 * Top-right corner dog-ear. Kept as a named placement component so existing page
 * surfaces don't need to change; the action it runs is configurable in settings
 * (defaults to screensaver). See {@link DogEar}.
 */
export function ScreensaverDogEar() {
  return <DogEar corner="right" />;
}
