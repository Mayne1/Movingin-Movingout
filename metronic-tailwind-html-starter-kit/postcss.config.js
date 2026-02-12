export const plugins = {
	'postcss-import': {
		path: ['./node_modules'],
	},
	'postcss-nesting': {},
	'postcss-preset-env': {
		features: { 'nesting-rules': false },
	},
	'@tailwindcss/postcss': {},
	autoprefixer: {},
};
