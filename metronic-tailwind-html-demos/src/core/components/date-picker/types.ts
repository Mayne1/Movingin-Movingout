import { Options } from 'vanilla-calendar-pro';

export interface KTDatePickerConfigInterface extends Partial<Options> {
	// KT-specific options
	lazy?: boolean;
	actionButtons?: boolean;
	dateFormat?: string;
}

export interface KTDatePickerInterface {
	init(): void;
	dispose(): void;
	show(): void;
	hide(): void;
	update(): void;
	reset(): void;
	apply(): void;
	getCalendar(): unknown;
	getSelectedDates(): string[];
}
