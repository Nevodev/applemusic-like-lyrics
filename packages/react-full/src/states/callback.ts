/**
 * @fileoverview
 * 所有有关开发者需要在预设歌词组件中配置的回调函数状态在这里
 */

import { atom } from "jotai";

export interface Callback<Args extends any[], Result = void> {
	onEmit?: (...args: Args) => Result;
}

const c = <Args extends any[], Result = void>(
	onEmit: (...args: Args) => Result,
): Callback<Args, Result> => ({});

/**
 * 当任意企图打开菜单或点击菜单按钮时触发的回调函数
 */
export const onRequestOpenMenuAtom = atom(c(() => {}));

/**
 * 当触发播放或恢复播放时触发的回调函数
 */
export const onPlayOrResumeAtom = atom(c(() => {}));

/**
 * 当触发暂停播放时触发的回调函数
 */
export const onPauseAtom = atom(c(() => {}));

/**
 * 当触发上一首歌曲时触发的回调函数
 */
export const onRequestPrevSongAtom = atom(c(() => {}));

/**
 * 当触发下一首歌曲时触发的回调函数
 */
export const onRequestNextSongAtom = atom(c(() => {}));

/**
 * 当点击位于控制按钮左侧的按钮时触发的回调函数
 */
export const onClickLeftFunctionButtonAtom = atom(c(() => {}));

/**
 * 当点击位于控制按钮右侧的按钮时触发的回调函数
 */
export const onClickRightFunctionButtonAtom = atom(c(() => {}));