/*
 * Metronic
 * @author: Keenthemes
 * Copyright 2024 Keenthemes
 */

import KTDom from './helpers/dom';
import KTUtils from './helpers/utils';
import KTEventHandler from './helpers/event-handler';
import { KTMenu } from './components/menu';
import { KTDatePicker } from './components/date-picker';
import { KTColorPicker } from './components/color-picker';
import { KTDropzone } from './components/dropzone';

// Import vanilla-calendar-pro styles
import 'vanilla-calendar-pro/styles/index.css';

export { KTMenu } from './components/menu';
export { KTDatePicker } from './components/date-picker';
export { KTColorPicker } from './components/color-picker';
export { KTDropzone } from './components/dropzone';

const KTComponents = {
	init(): void {
		KTMenu.init();
		KTDatePicker.init();
		KTColorPicker.init();
		KTDropzone.init();
	},
};

declare global {
	interface Window {
		KTUtils: typeof KTUtils;
		KTDom: typeof KTDom;
		KTEventHandler: typeof KTEventHandler;
		KTMenu: typeof KTMenu;
		KTDatePicker: typeof KTDatePicker;
		KTColorPicker: typeof KTColorPicker;
		KTDropzone: typeof KTDropzone;
		KTComponents: typeof KTComponents;
	}
}

window.KTUtils = KTUtils;
window.KTDom = KTDom;
window.KTEventHandler = KTEventHandler;
window.KTMenu = KTMenu;
window.KTDatePicker = KTDatePicker;
window.KTColorPicker = KTColorPicker;
window.KTDropzone = KTDropzone;
window.KTComponents = KTComponents;

export default KTComponents;

KTDom.ready(() => {
	KTComponents.init();
});
