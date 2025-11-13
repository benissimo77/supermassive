// src/ui/ThemeManager.ts
export class ThemeManager {
	private static instance: ThemeManager;
	private currentTheme: string = 'default';

	private themes: any = {
		default: {
			colors: {
				// Panel and Container Backgrounds
				panelBackground: 0x1a0033,          // Dark blue/purple from body background
				panelStroke: 0xA088BB,              // Slightly lighter than panel background
				modalBackground: 0x2a0043,          // Slightly lighter than panel for contrast
				cardBackground: 0x2c0548,           // For individual cards/elements
				uiBackground: 0x444444,            // Background for UI components sliders, toggles etc
				headerBackground: 0x1a0033,         // Same as panel for consistency
				footerBackground: 0x150029,         // Slightly darker than panel

				// Button Colors
				primaryButtonBackground: 0x051C55,  // Primary buttons used in multiple-choice questions and panel buttons
				primaryButtonBackgroundHover:  0x062C66, // Slightly lighter for hover effect
				secondaryButtonBackground: 0x666666, // Gray from secondary buttons
				secondaryButtonBackgroundHover: 0x777777,
				buttonBackgroundDisabled: 0x444444,

				// Text Colors
				headingText: '#ffffff',            // White for headings
				bodyText: '#e0e0e0',               // Slightly dimmed for body text
				textStroke: '#000000',          // Black stroke for text
				primaryButtonText: '#ffffff',      // White for button text
				secondaryButtonText: '#ffffff',    // White for secondary buttons
				accentText: '#ff3366',             // Pink for emphasized text
				mutedText: '#aaaaaa',              // Gray for less important text

				// Functional Colors
				correctAnswer: 0x66cc33,           // Green for correct answers
				wrongAnswer: 0xff3366,             // Using the pink accent for wrong answers
				neutralHighlight: 0x3399ff,        // Blue highlight

				// Accent Colors
				accentBright: 0xffcc00,            // Yellow accent from landing page
				accentDark: 0x9933cc,            // Purple accent for variety

				// Decorative Elements
				divider: 0x333333,                 // Subtle divider color
				cardStroke: 0x3a0066,              // Slightly lighter than background
				inputStroke: 0x444444,             // Subtle border for inputs

				// Game-specific Elements
				timerBackground: 0xff3366,         // Pink for timer emphasis
				timerBackgroundWarning: 0xffcc00,  // Yellow when time is running low
				scorePositive: 0x66cc33,           // Green for positive scores
				scoreNegative: 0xff3366,           // Pink for negative scores

				uiControl: 0xcccccc,            // Any UI element that can be interacted with
				uiControlIndicator: 0x669933,      // Indicators for UI controls eg slider indicator, toggle switch

				// Overlay and Modal
				overlayBackground: 0x0d001a,       // Dark semi-transparent overlay (use with alpha)
				tooltipBackground: 0x2a0043,       // For tooltips and popovers

				// Navigation
				navActiveItem: 0xff3366,           // Pink for active nav items
				navHoverItem: 0x9933cc,            // Purple for hover states
			},

			fonts: {
				title: '"Titan One", Arial',
				body: 'Arial'
			},

			// UI layout properties
			panelRoundness: 40,
			buttonRoundness: 10,

			spacing: 10,

			// Panel properties
			panelStrokeThickness: 10,
			textStrokeThickness: 2
		},

		dark: {
			colors: {
				background: 0x121212,
				panelBackground: 0x1e1e1e,
				modalBackground: 0x2c2c2c,
				headerBackground: 0x3b3b3b,
				buttonBackground: 0x4a4a4a,
				buttonBackgroundHover: 0x5a5a5a,
				buttonBackgroundDisabled: 0x333333,
				timerBackground: 0x6b6b6b,
				cardBackground: 0x2c2c2c,

				titleText: '#ffffff',
				bodyText: '#e0e0e0',
				buttonText: '#ffffff',
				questionText: '#ffffff',
				answerText: '#e0e0e0',
				scoreText: '#ffffff',
				timerText: '#ffffff',
				textStroke: '#000000',

				correctAnswer: 0x4caf50,
				wrongAnswer: 0xf44336,
				neutralHighlight: 0x2196f3,

				divider: 0x666666,
				cardBorder: 0x7b5e8a,
				inputBorder: 0x555555,

			},

			fonts: {
				title: '"Titan One", Arial',
				body: 'Arial'
			},

			roundness: 10,
			spacing: 10,

			panelStrokeThickness: 4
		}

		// Add other themes here
	};

	private constructor() { } // Singleton pattern

	static getInstance(): ThemeManager {
		if (!ThemeManager.instance) {
			ThemeManager.instance = new ThemeManager();
		}
		return ThemeManager.instance;
	}

	getTheme(name?: string): any {
		return this.themes[name || this.currentTheme] || this.themes['default'];
	}

	setTheme(name: string): void {
		if (this.themes[name]) {
			this.currentTheme = name;
		}
	}

	// Get specific theme properties
	getColor(key: string): number {
		return this.getTheme().colors[key] || 0xffffff;
	}

	// getFont(type: 'title' | 'body'): any {
	//     return this.getTheme().fonts[type] || this.getTheme().fonts.body;
	// }
	getFont(size: number = 16, isBold: boolean = false): any {
		const theme = this.getTheme();
		return {
			fontFamily: theme.fonts.title.fontFamily,
			fontSize: size ? `${size}px` : theme.fonts.body.fontSize,
			fontWeight: isBold ? 'bold' : 'normal',
			color: theme.fonts.body.color
		};
	}
}