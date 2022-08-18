import { MayPromise } from './constants'

/**
 * use `Promise.allSettled`
 */
export async function asyncMapAllSettled<T, U>(
  arr: T[],
  mapFn: (item: T, index: number) => MayPromise<U>
): Promise<(Awaited<U> | undefined)[]> {
  return await Promise.allSettled(arr.map(async (item, idx) => await mapFn(item, idx))).then(
    (
      promiseSettled // extract from `promise.allSettled()`
    ) =>
      promiseSettled.map((promiseSettledItem) =>
        promiseSettledItem.status === 'fulfilled' /* fulfilled is promise.allSettled  */
          ? promiseSettledItem.value
          : undefined
      )
  )
}

/**
 * use `Promise.all`
 */
export async function asyncMap<T, U>(
  arr: T[],
  mapFn: (item: T, index: number) => MayPromise<U>
): Promise<Awaited<U>[]> {
  return await Promise.all(arr.map(async (item, idx) => await mapFn(item, idx)))
}

// export async function shakeUndifindedItem<T>(arr: T[]): NonNullable<T>[] {
//   return arr.filter((item) => item != null) as NonNullable<T>[]
// }