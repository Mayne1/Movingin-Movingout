/*
 * Metronic
 * @author: Keenthemes
 * Copyright 2024 Keenthemes
 */

import KTDom from './helpers/dom';
import KTUtils from './helpers/utils';
import KTEventHandler from './helpers/event-handler';
import { KTMenu } from './components/menu';
import { KTColorPicker } from './components/color-picker';

export { KTMenu } from './components/menu';
export { KTColorPicker } from './components/color-picker';

const KTComponents = {
	/**
	 * Initializes all KT components.
	 * This method is called on initial page load and after Livewire navigation.
	 */
	init(): void {
		try {
			KTMenu.init();
		} catch (error) {
			console.warn('KTMenu initialization failed:', error);
		}

		try {
			KTColorPicker.init();
		} catch (error) {
			console.warn('KTColorPicker initialization failed:', error);
		}
	},
};

declare global {
	interface Window {
		KTUtils: typeof KTUtils;
		KTDom: typeof KTDom;
		KTEventHandler: typeof KTEventHandler;
		KTMenu: typeof KTMenu;
		KTColorPicker: typeof KTColorPicker;
		KTComponents: typeof KTComponents;
	}
}

window.KTUtils = KTUtils;
window.KTDom = KTDom;
window.KTEventHandler = KTEventHandler;
window.KTMenu = KTMenu;
window.KTColorPicker = KTColorPicker;
window.KTComponents = KTComponents;

export default KTComponents;

KTDom.ready(() => {
	KTComponents.init();
});
