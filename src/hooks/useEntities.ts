'use client';

import { useHomeAssistantSelector } from './useHomeAssistant';
import type { HassEntity } from '@/types';

function areSameEntity(previous: HassEntity | undefined, next: HassEntity | undefined): boolean {
  return previous === next || (
    !!previous &&
    !!next &&
    previous.entity_id === next.entity_id &&
    previous.state === next.state &&
    previous.last_updated === next.last_updated
  );
}

function areEntityListsEqual(previous: HassEntity[], next: HassEntity[]): boolean {
  if (previous.length !== next.length) return false;

  for (let index = 0; index < previous.length; index += 1) {
    if (!areSameEntity(previous[index], next[index])) {
      return false;
    }
  }

  return true;
}

export function useEntitiesByDomain(domain: string): HassEntity[] {
  return useHomeAssistantSelector(
    (entities) => Object.values(entities).filter((entity) =>
      entity.entity_id.startsWith(`${domain}.`)
    ),
    areEntityListsEqual
  );
}

export function useEntitiesCount(domain: string, state?: string): number {
  const domainEntities = useEntitiesByDomain(domain);
  if (!state) return domainEntities.length;
  return domainEntities.filter((entity) => entity.state === state).length;
}

export function useLightsOn(): number {
  return useEntitiesCount('light', 'on');
}

export function useDoorsOpen(): number {
  const binarySensors = useEntitiesByDomain('binary_sensor');
  return binarySensors.filter(
    (entity) =>
      entity.attributes.device_class === 'door' && entity.state === 'on'
  ).length;
}

export function useAverageTemperature(): number | null {
  return useHomeAssistantSelector((entities) => {
    const tempEntities = Object.values(entities).filter(
      (entity) =>
        entity.entity_id.startsWith('sensor.') &&
        entity.attributes.device_class === 'temperature' &&
        !isNaN(parseFloat(entity.state))
    );

    if (tempEntities.length === 0) return null;

    const sum = tempEntities.reduce(
      (acc, entity) => acc + parseFloat(entity.state),
      0
    );
    return Math.round(sum / tempEntities.length);
  });
}
