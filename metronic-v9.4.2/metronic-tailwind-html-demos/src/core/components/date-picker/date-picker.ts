import { Calendar, type Options } from 'vanilla-calendar-pro';
import KTComponent from '../component';
import KTDom from '../../helpers/dom';
import KTData from '../../helpers/data';
import {
	KTDatePickerConfigInterface,
	KTDatePickerInterface,
} from './types';

declare global {
	interface Window {
		KT_DATE_PICKER_INITIALIZED: boolean;
	}
}

// Action buttons HTML template
const ACTION_BUTTONS_HTML = `
	<div class="vc-actions">
		<button type="button" class="kt-btn kt-btn-sm kt-btn-outline" data-kt-date-picker-action="reset">Reset</button>
		<button type="button" class="kt-btn kt-btn-sm kt-btn-primary" data-kt-date-picker-action="apply">Apply</button>
	</div>
`;

export class KTDatePicker
	extends KTComponent
	implements KTDatePickerInterface
{
	// Timeout delay constants for action button re-injection
	private static readonly REINJECTION_DELAY_MS = 10;
	private static readonly TITLE_CLICK_DELAY_MS = 50;

	// Use 'ktDatePicker' to match data-kt-date-picker-* attributes
	protected override _name: string = 'ktDatePicker';
	protected override _defaultConfig: KTDatePickerConfigInterface = {
		lazy: false,
	};
	protected override _config: KTDatePickerConfigInterface =
		this._defaultConfig;
	protected _calendar: Calendar | null = null;
	protected _initialized: boolean = false;
	protected _pendingDates: string[] = [];
	protected _actionButtonsObserver: MutationObserver | null = null;
	protected _injectionTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

	constructor(element: HTMLElement, config?: KTDatePickerConfigInterface) {
		super();

		if (KTData.has(element as HTMLElement, this._name)) return;

		this._init(element);
		this._buildConfig(config);

		// Check if lazy initialization is enabled
		const lazy = this._getOption('lazy') as boolean;

		if (!lazy) {
			this.init();
		}
	}

	/**
	 * Inject action buttons into the calendar if they don't already exist
	 * @param calendar The calendar instance
	 * @returns true if buttons were injected or already exist, false otherwise
	 */
	protected _injectActionButtons(calendar: Calendar): boolean {
		if (!calendar?.context?.mainElement) return false;

		// Check if buttons already exist
		const existingActions = calendar.context.mainElement.querySelector('.vc-actions');
		if (existingActions) return true;

		// Inject buttons
		const actionsDiv = document.createElement('div');
		actionsDiv.innerHTML = ACTION_BUTTONS_HTML.trim();
		const actionsContainer = actionsDiv.firstElementChild as HTMLElement;
		if (actionsContainer) {
			calendar.context.mainElement.appendChild(actionsContainer);
			return true;
		}

		return false;
	}

	protected _buildCalendarOptions(): Options {
		const options: Options = {};
		const self = this;

		// Calendar type options
		const type = this._getOption('type');
		if (type) options.type = type as Options['type'];

		const displayMonthsCount = this._getOption('displayMonthsCount');
		if (displayMonthsCount) options.displayMonthsCount = displayMonthsCount as Options['displayMonthsCount'];

		const monthsToSwitch = this._getOption('monthsToSwitch');
		if (monthsToSwitch) options.monthsToSwitch = monthsToSwitch as Options['monthsToSwitch'];

		// Selection mode
		const selectionDatesMode = this._getOption('selectionDatesMode');
		if (selectionDatesMode !== undefined) options.selectionDatesMode = selectionDatesMode as Options['selectionDatesMode'];

		// Check if action buttons are enabled
		const actionButtons = this._getOption('actionButtons') === true;
		const isRangeMode = selectionDatesMode === 'multiple-ranged';

		// Input mode options
		const inputMode = this._getOption('inputMode') === true;
		const dateFormat = this._getOption('dateFormat') as string | undefined;

		if (inputMode) {
			options.inputMode = true;
			options.positionToInput = (this._getOption('positionToInput') as Options['positionToInput']) || 'left';

			// For action buttons mode, don't auto-close - let buttons handle it
			if (actionButtons) {
				options.onChangeToInput = function(calendar) {
					// Store selected dates but don't close or update input
					self._pendingDates = [...calendar.context.selectedDates];
					self._fireEvent('select', {
						dates: calendar.context.selectedDates,
						element: calendar.context.inputElement,
					});
				};
			} else if (isRangeMode) {
				// For range mode without action buttons - close when range is complete (2 dates)
				options.onChangeToInput = function(calendar) {
					if (!calendar.context.inputElement) return;
					const dates = calendar.context.selectedDates;
					const selectionTimeMode = self._getOption('selectionTimeMode');
					const selectedTime = calendar.context.selectedTime;
					const timeMode = self._getTimeMode(selectionTimeMode);

					if (dates.length >= 2) {
						// Range complete - update input
						let formattedDates: string[];
						if (dateFormat) {
							formattedDates = dates.map(d => self._formatDate(d, dateFormat, selectedTime, timeMode));
						} else if (selectedTime && timeMode) {
							const timeStr = self._formatTime(selectedTime, timeMode);
							formattedDates = dates.map(d => d + ' ' + timeStr);
						} else {
							formattedDates = dates;
						}
						calendar.context.inputElement.value = formattedDates.join(' - ');

						// Fire change events
						self._fireEvent('change', {
							dates: dates,
							element: calendar.context.inputElement,
						});
						self._dispatchEvent('kt.date-picker.change', {
							dates: dates,
							element: calendar.context.inputElement,
						});

						// Only auto-close if time mode is NOT enabled
						// When time mode is enabled, keep calendar open so user can select time
						if (!timeMode) {
							calendar.hide();
						}
					} else if (dates.length === 1) {
						// First date selected - update input but keep open
						let formattedDate: string;
						if (dateFormat) {
							formattedDate = self._formatDate(dates[0], dateFormat, selectedTime, timeMode);
						} else if (selectedTime && timeMode) {
							const timeStr = self._formatTime(selectedTime, timeMode);
							formattedDate = dates[0] + ' ' + timeStr;
						} else {
							formattedDate = dates[0];
						}
						calendar.context.inputElement.value = formattedDate + ' - ...';
					} else {
						calendar.context.inputElement.value = '';
					}
				};
			} else {
				// Standard single date mode
				options.onChangeToInput = function(calendar) {
					if (!calendar.context.inputElement) return;
					if (calendar.context.selectedDates[0]) {
						const selectionTimeMode = self._getOption('selectionTimeMode');
						const selectedTime = calendar.context.selectedTime;
						const timeMode = self._getTimeMode(selectionTimeMode);

						if (dateFormat) {
							const formattedDates = calendar.context.selectedDates.map(d => {
								return self._formatDate(d, dateFormat, selectedTime, timeMode);
							});
							calendar.context.inputElement.value = formattedDates.join(', ');
						} else if (selectedTime && timeMode) {
							// If time mode is enabled but no custom format, append time to date
							const timeStr = self._formatTime(selectedTime, timeMode);
							calendar.context.inputElement.value = calendar.context.selectedDates.join(', ') + ' ' + timeStr;
						} else {
							calendar.context.inputElement.value = calendar.context.selectedDates.join(', ');
						}

						// Only auto-close if time mode is NOT enabled
						// When time mode is enabled, keep calendar open so user can select time
						if (!timeMode) {
							calendar.hide();
						}
					} else {
						calendar.context.inputElement.value = '';
					}
					self._fireEvent('change', {
						dates: calendar.context.selectedDates,
						element: calendar.context.inputElement,
					});
					self._dispatchEvent('kt.date-picker.change', {
						dates: calendar.context.selectedDates,
						element: calendar.context.inputElement,
					});
				};
			}
		}

		// Add action buttons and time change listeners via onInit callback
		const existingOnInit = options.onInit;
		options.onInit = (calendar) => {
			// Call existing onInit if it exists
			if (existingOnInit) {
				existingOnInit(calendar);
			}

			// Inject action buttons if enabled
			if (actionButtons) {
				self._injectActionButtons(calendar);

				// Set up MutationObserver to watch for action buttons removal
				if (calendar.context.mainElement) {
					// Clean up existing observer if any
					if (self._actionButtonsObserver) {
						self._actionButtonsObserver.disconnect();
					}

					self._actionButtonsObserver = new MutationObserver((mutations) => {
						// Add null check to prevent errors if calendar context becomes invalid
						if (!calendar?.context?.mainElement) return;

						for (const mutation of mutations) {
							// Check if action buttons were removed
							if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
								const hasActionsRemoved = Array.from(mutation.removedNodes).some((node) => {
									if (node.nodeType === Node.ELEMENT_NODE) {
										const element = node as HTMLElement;
										return element.classList.contains('vc-actions') ||
										       element.querySelector('.vc-actions') !== null;
									}
									return false;
								});

								// Check if action buttons still exist in the main element
								const actionsExist = calendar.context.mainElement.querySelector('.vc-actions');

								if (hasActionsRemoved && !actionsExist) {
									// Re-inject buttons after a short delay to allow calendar to finish re-rendering
									const timeoutId = setTimeout(() => {
										self._injectionTimeouts.delete(timeoutId);
										// Verify calendar is still valid before injecting
										if (calendar?.context?.mainElement) {
											self._injectActionButtons(calendar);
										}
									}, KTDatePicker.REINJECTION_DELAY_MS);
									self._injectionTimeouts.add(timeoutId);
								}
							}
						}
					});

					// Start observing for child removals
					self._actionButtonsObserver.observe(calendar.context.mainElement, {
						childList: true,
						subtree: false
					});
				}
			}

			// Setup click handlers for action buttons
			const handleClick = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				if (target.closest('[data-kt-date-picker-action="apply"]')) {
					self._applySelection();
				} else if (target.closest('[data-kt-date-picker-action="reset"]')) {
					self._resetSelection();
				}
			};

			// Function to update input with current time
			const updateInputWithTime = () => {
				if (!calendar.context.inputElement || !calendar.context.selectedDates[0]) return;

				const selectionTimeMode = self._getOption('selectionTimeMode');
				const selectedTime = calendar.context.selectedTime;
				const timeMode = self._getTimeMode(selectionTimeMode);
				const dateFormat = self._getOption('dateFormat') as string | undefined;

				if (dateFormat) {
					const formattedDates = calendar.context.selectedDates.map(d => {
						return self._formatDate(d, dateFormat, selectedTime, timeMode);
					});
					calendar.context.inputElement.value = formattedDates.join(', ');
				} else if (selectedTime && timeMode) {
					const timeStr = self._formatTime(selectedTime, timeMode);
					calendar.context.inputElement.value = calendar.context.selectedDates.join(', ') + ' ' + timeStr;
				} else {
					calendar.context.inputElement.value = calendar.context.selectedDates.join(', ');
				}
			};

			// Listen for time changes
			const handleTimeInteraction = (e: Event) => {
				const target = e.target as HTMLElement;
				if (target.closest('.vc-time') || target.closest('[data-vc-time]')) {
					setTimeout(() => {
						updateInputWithTime();
					}, 10);
				}
			};

			calendar.context.mainElement.addEventListener('click', handleClick);
			calendar.context.mainElement.addEventListener('click', handleTimeInteraction);
			calendar.context.mainElement.addEventListener('input', handleTimeInteraction);
		};

		// Reposition calendar to .kt-input parent container on show
		if (inputMode) {
			options.onShow = (calendar) => {
				self._repositionToParentContainer(calendar);
			};
		}

		// Re-inject action buttons when calendar view changes (e.g., clicking title to select year)
		if (actionButtons) {
			const existingOnClickTitle = options.onClickTitle;
			options.onClickTitle = (calendar, event) => {
				// Call existing onClickTitle if it exists
				if (existingOnClickTitle) {
					existingOnClickTitle(calendar, event);
				}

				// Re-inject action buttons after view change (with delay to allow calendar to re-render)
				const timeoutId = setTimeout(() => {
					self._injectionTimeouts.delete(timeoutId);
					// Verify calendar is still valid before injecting
					if (calendar?.context?.mainElement) {
						self._injectActionButtons(calendar);
					}
				}, KTDatePicker.TITLE_CLICK_DELAY_MS);
				self._injectionTimeouts.add(timeoutId);
			};
		}

		// Date constraints
		const dateMin = this._getOption('dateMin');
		if (dateMin) options.dateMin = dateMin as Options['dateMin'];

		const dateMax = this._getOption('dateMax');
		if (dateMax) options.dateMax = dateMax as Options['dateMax'];

		const displayDateMin = this._getOption('displayDateMin');
		if (displayDateMin) options.displayDateMin = displayDateMin as Options['displayDateMin'];

		const displayDateMax = this._getOption('displayDateMax');
		if (displayDateMax) options.displayDateMax = displayDateMax as Options['displayDateMax'];

		const displayDisabledDates = this._getOption('displayDisabledDates');
		if (displayDisabledDates !== undefined) options.displayDisabledDates = displayDisabledDates as boolean;

		const displayDatesOutside = this._getOption('displayDatesOutside');
		if (displayDatesOutside !== undefined) options.displayDatesOutside = displayDatesOutside as boolean;

		// Disable options
		const disableDates = this._getOption('disableDates');
		if (disableDates) options.disableDates = disableDates as Options['disableDates'];

		const disableAllDates = this._getOption('disableAllDates');
		if (disableAllDates !== undefined) options.disableAllDates = disableAllDates as boolean;

		const disableDatesPast = this._getOption('disableDatesPast');
		if (disableDatesPast !== undefined) options.disableDatesPast = disableDatesPast as boolean;

		const disableDatesGaps = this._getOption('disableDatesGaps');
		if (disableDatesGaps !== undefined) options.disableDatesGaps = disableDatesGaps as boolean;

		const disableWeekdays = this._getOption('disableWeekdays');
		if (disableWeekdays) options.disableWeekdays = disableWeekdays as Options['disableWeekdays'];

		const disableToday = this._getOption('disableToday');
		if (disableToday !== undefined) options.disableToday = disableToday as boolean;

		// Enable options
		const enableDates = this._getOption('enableDates');
		if (enableDates) options.enableDates = enableDates as Options['enableDates'];

		const enableWeekNumbers = this._getOption('enableWeekNumbers');
		if (enableWeekNumbers !== undefined) options.enableWeekNumbers = enableWeekNumbers as boolean;

		const enableDateToggle = this._getOption('enableDateToggle');
		if (enableDateToggle !== undefined) options.enableDateToggle = enableDateToggle as Options['enableDateToggle'];

		const enableMonthChangeOnDayClick = this._getOption('enableMonthChangeOnDayClick');
		if (enableMonthChangeOnDayClick !== undefined) options.enableMonthChangeOnDayClick = enableMonthChangeOnDayClick as boolean;

		const enableJumpToSelectedDate = this._getOption('enableJumpToSelectedDate');
		if (enableJumpToSelectedDate !== undefined) options.enableJumpToSelectedDate = enableJumpToSelectedDate as boolean;

		// Selection options (already handled above for selectionDatesMode)
		const selectionMonthsMode = this._getOption('selectionMonthsMode');
		if (selectionMonthsMode !== undefined) options.selectionMonthsMode = selectionMonthsMode as Options['selectionMonthsMode'];

		const selectionYearsMode = this._getOption('selectionYearsMode');
		if (selectionYearsMode !== undefined) options.selectionYearsMode = selectionYearsMode as Options['selectionYearsMode'];

		const selectionTimeMode = this._getOption('selectionTimeMode');
		if (selectionTimeMode !== undefined) options.selectionTimeMode = selectionTimeMode as Options['selectionTimeMode'];

		// Selected values
		const selectedDates = this._getOption('selectedDates');
		if (selectedDates) options.selectedDates = selectedDates as Options['selectedDates'];

		const selectedMonth = this._getOption('selectedMonth');
		if (selectedMonth !== undefined) options.selectedMonth = selectedMonth as Options['selectedMonth'];

		const selectedYear = this._getOption('selectedYear');
		if (selectedYear !== undefined) options.selectedYear = selectedYear as Options['selectedYear'];

		const selectedHolidays = this._getOption('selectedHolidays');
		if (selectedHolidays) options.selectedHolidays = selectedHolidays as Options['selectedHolidays'];

		const selectedWeekends = this._getOption('selectedWeekends');
		if (selectedWeekends) options.selectedWeekends = selectedWeekends as Options['selectedWeekends'];

		const selectedTime = this._getOption('selectedTime');
		if (selectedTime) options.selectedTime = selectedTime as Options['selectedTime'];

		const selectedTheme = this._getOption('selectedTheme');
		options.selectedTheme = (selectedTheme as Options['selectedTheme']) || 'light';

		// Time options
		const timeMinHour = this._getOption('timeMinHour');
		if (timeMinHour !== undefined) options.timeMinHour = timeMinHour as Options['timeMinHour'];

		const timeMaxHour = this._getOption('timeMaxHour');
		if (timeMaxHour !== undefined) options.timeMaxHour = timeMaxHour as Options['timeMaxHour'];

		const timeMinMinute = this._getOption('timeMinMinute');
		if (timeMinMinute !== undefined) options.timeMinMinute = timeMinMinute as Options['timeMinMinute'];

		const timeMaxMinute = this._getOption('timeMaxMinute');
		if (timeMaxMinute !== undefined) options.timeMaxMinute = timeMaxMinute as Options['timeMaxMinute'];

		const timeControls = this._getOption('timeControls');
		if (timeControls) options.timeControls = timeControls as Options['timeControls'];

		const timeStepHour = this._getOption('timeStepHour');
		if (timeStepHour !== undefined) options.timeStepHour = timeStepHour as Options['timeStepHour'];

		const timeStepMinute = this._getOption('timeStepMinute');
		if (timeStepMinute !== undefined) options.timeStepMinute = timeStepMinute as Options['timeStepMinute'];

		// Locale and weekday options
		const locale = this._getOption('locale');
		if (locale) options.locale = locale as Options['locale'];

		const firstWeekday = this._getOption('firstWeekday');
		if (firstWeekday !== undefined) options.firstWeekday = firstWeekday as Options['firstWeekday'];

		// Theme
		const themeAttrDetect = this._getOption('themeAttrDetect');
		if (themeAttrDetect) options.themeAttrDetect = themeAttrDetect as Options['themeAttrDetect'];

		return options;
	}

	/**
	 * Safely convert time mode option to string | number | undefined
	 */
	protected _getTimeMode(timeMode: any): string | number | undefined {
		if (timeMode === undefined || timeMode === null) return undefined;
		if (typeof timeMode === 'string' || typeof timeMode === 'number') return timeMode;
		return undefined;
	}

	/**
	 * Format time value from calendar context
	 * Handles both object format {hours, minutes} and string format "HH:mm" or "HH:mm AM/PM"
	 */
	protected _formatTime(time: any, timeMode?: string | number): string {
		if (!time) return '';

		let hours: number;
		let minutes: number;

		// Handle different time formats from vanilla-calendar-pro
		if (typeof time === 'string') {
			// Check if string already contains AM/PM (12-hour format from vanilla-calendar-pro)
			const hasPeriod = /AM|PM/i.test(time);
			if (hasPeriod) {
				// String is already in 12-hour format like "04:29 PM" or "12:00 AM"
				// Just return it as-is since it's already formatted correctly
				return time;
			}

			// Otherwise parse as 24-hour format "HH:mm"
			const parts = time.split(':');
			hours = parseInt(parts[0], 10);
			minutes = parseInt(parts[1] || '0', 10);
		} else if (typeof time === 'object' && time.hours !== undefined) {
			hours = time.hours;
			minutes = time.minutes || 0;
		} else {
			return '';
		}

		if (isNaN(hours) || isNaN(minutes)) return '';

		const timeModeNum = timeMode ? (typeof timeMode === 'string' ? parseInt(timeMode, 10) : timeMode) : 24;

		if (timeModeNum === 12) {
			// 12-hour format with AM/PM
			const period = hours >= 12 ? 'PM' : 'AM';
			const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
			return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
		} else {
			// 24-hour format
			return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
		}
	}

	/**
	 * Format a date string (YYYY-MM-DD) to a custom format
	 * Supported tokens: YYYY, YY, MM, M, DD, D, dddd, ddd, MMMM, MMM
	 * Optionally includes time if provided
	 */
	protected _formatDate(dateStr: string, format: string, time?: any, timeMode?: string | number): string {
		const date = new Date(dateStr);
		if (isNaN(date.getTime())) return dateStr;

		const year = date.getFullYear();
		const month = date.getMonth();
		const day = date.getDate();
		const weekday = date.getDay();

		const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'];
		const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
			'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

		const tokens: { [key: string]: string } = {
			'YYYY': String(year),
			'YY': String(year).slice(-2),
			'MMMM': monthNames[month],
			'MMM': monthNamesShort[month],
			'MM': String(month + 1).padStart(2, '0'),
			'M': String(month + 1),
			'dddd': dayNames[weekday],
			'ddd': dayNamesShort[weekday],
			'DD': String(day).padStart(2, '0'),
			'D': String(day),
		};

		// Replace tokens in order (longest first to avoid partial matches)
		let result = format;
		const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);
		for (const token of sortedTokens) {
			result = result.replace(new RegExp(token, 'g'), tokens[token]);
		}

		// Append time if provided
		if (time) {
			const formattedTime = this._formatTime(time, timeMode);
			if (formattedTime) {
				result = result + ' ' + formattedTime;
			}
		}

		return result;
	}

	protected _repositionToParentContainer(calendar: Calendar): void {
		// Check if input is inside a .kt-input container
		const inputElement = calendar.context.inputElement;
		if (!inputElement) return;

		const ktInputContainer = inputElement.closest('.kt-input') as HTMLElement;
		if (!ktInputContainer) return;

		const mainElement = calendar.context.mainElement;
		if (!mainElement) return;

		// Get positions
		const containerRect = ktInputContainer.getBoundingClientRect();
		const inputRect = inputElement.getBoundingClientRect();
		const calendarRect = mainElement.getBoundingClientRect();

		// Get the position setting
		const positionToInput = this._getOption('positionToInput') as string || 'left';

		// Calculate the vertical offset - position below the container instead of the input
		const topOffset = containerRect.bottom - inputRect.bottom;
		const currentTop = parseFloat(mainElement.style.top) || 0;
		mainElement.style.top = `${currentTop + topOffset}px`;

		// Calculate horizontal position based on setting
		let newLeft: number;

		switch (positionToInput) {
			case 'left':
				// Align calendar's left edge with container's left edge
				newLeft = containerRect.left;
				break;
			case 'right':
				// Align calendar's right edge with container's right edge
				newLeft = containerRect.right - calendarRect.width;
				break;
			case 'center':
				// Center calendar relative to container
				newLeft = containerRect.left + (containerRect.width - calendarRect.width) / 2;
				break;
			case 'auto':
			default:
				// For auto, keep the original position but adjust for container
				const leftOffset = inputRect.left - containerRect.left;
				const currentLeft = parseFloat(mainElement.style.left) || 0;
				newLeft = currentLeft - leftOffset + containerRect.left;
				break;
		}

		mainElement.style.left = `${newLeft}px`;
	}

	protected _applySelection(): void {
		if (!this._calendar) return;

		const inputElement = this._calendar.context.inputElement;
		const dates = this._calendar.context.selectedDates;
		const selectedTime = this._calendar.context.selectedTime;
		const selectionMode = this._getOption('selectionDatesMode');
		const dateFormat = this._getOption('dateFormat') as string | undefined;
		const selectionTimeMode = this._getOption('selectionTimeMode');
		const timeMode = this._getTimeMode(selectionTimeMode);

		if (inputElement) {
			let formattedDates: string[];

			if (dateFormat) {
				formattedDates = dates.map(d => this._formatDate(d, dateFormat, selectedTime, timeMode));
			} else if (selectedTime && timeMode) {
				// If time mode is enabled but no custom format, append time to date
				const timeStr = this._formatTime(selectedTime, timeMode);
				formattedDates = dates.map(d => d + ' ' + timeStr);
			} else {
				formattedDates = dates;
			}

			if (selectionMode === 'multiple-ranged' && dates.length >= 2) {
				inputElement.value = formattedDates[0] + ' - ' + formattedDates[formattedDates.length - 1];
			} else {
				inputElement.value = formattedDates.join(', ');
			}
		}

		this._calendar.hide();

		this._fireEvent('apply', {
			dates: dates,
			element: inputElement,
		});
		this._dispatchEvent('kt.date-picker.apply', {
			dates: dates,
			element: inputElement,
		});
		this._fireEvent('change', {
			dates: dates,
			element: inputElement,
		});
		this._dispatchEvent('kt.date-picker.change', {
			dates: dates,
			element: inputElement,
		});
	}

	protected _resetSelection(): void {
		if (!this._calendar) return;

		const inputElement = this._calendar.context.inputElement;

		// Reset the calendar using update with reset options
		this._calendar.update({ dates: true });
		this._pendingDates = [];

		if (inputElement) {
			inputElement.value = '';
		}

		this._fireEvent('reset', {
			element: inputElement,
		});
		this._dispatchEvent('kt.date-picker.reset', {
			element: inputElement,
		});
	}

	public init(): void {
		if (this._initialized || !this._element) return;

		// Only add ID if element doesn't have one
		if (!this._element.id) {
			this._element.id = `kt-date-picker-${this._uid}`;
		}

		const selector = `#${this._element.id}`;
		const options = this._buildCalendarOptions();

		this._calendar = new Calendar(selector, options);
		this._calendar.init();

		this._initialized = true;

		this._fireEvent('init', { element: this._element });
		this._dispatchEvent('kt.date-picker.init', { element: this._element });
	}

	public dispose(): void {
		// Clean up pending timeouts to prevent memory leaks
		this._injectionTimeouts.forEach(timeoutId => window.clearTimeout(timeoutId));
		this._injectionTimeouts.clear();

		// Clean up MutationObserver
		if (this._actionButtonsObserver) {
			this._actionButtonsObserver.disconnect();
			this._actionButtonsObserver = null;
		}

		if (this._calendar) {
			this._calendar = null;
		}
		this._initialized = false;
		this._pendingDates = [];
		super.dispose();
	}

	public show(): void {
		if (this._calendar && this._initialized) {
			this._calendar.show();
		}
	}

	public hide(): void {
		if (this._calendar && this._initialized) {
			this._calendar.hide();
		}
	}

	public update(): void {
		if (!this._element) return;
		this._buildConfig();
		if (this._initialized) {
			this.dispose();
			this.init();
		}
	}

	public reset(): void {
		this._resetSelection();
	}

	public apply(): void {
		this._applySelection();
	}

	public getCalendar(): Calendar | null {
		return this._calendar;
	}

	public getSelectedDates(): string[] {
		return this._calendar?.context.selectedDates || [];
	}

	public static getInstance(
		element: HTMLElement | string
	): KTDatePicker | null {
		const targetElement = KTDom.getElement(element);
		if (!targetElement) return null;
		return KTData.get(targetElement, 'ktDatePicker') as KTDatePicker | null;
	}

	public static createInstances(): void {
		const elements = document.querySelectorAll(
			'[data-kt-date-picker]:not([data-kt-date-picker=false])'
		);
		elements.forEach((element) => {
			new KTDatePicker(element as HTMLElement);
		});
	}

	public static init(): void {
		KTDatePicker.createInstances();

		if (window.KT_DATE_PICKER_INITIALIZED !== true) {
			window.KT_DATE_PICKER_INITIALIZED = true;
		}
	}
}
