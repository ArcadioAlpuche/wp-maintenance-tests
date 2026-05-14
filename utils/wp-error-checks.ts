export const WORDPRESS_FAILURE_STRINGS = [
  'Fatal error',
  'Parse error',
  'Warning:',
  'Deprecated:',
  'There has been a critical error',
  'Error establishing a database connection',
  'Briefly unavailable for scheduled maintenance',
  'The site is experiencing technical difficulties',
  '[gravityform',
  '[ninja_form'
];

export const BROKEN_SHORTCODE_PATTERNS = [
  '[gravityform',
  '[ninja_form',
  '[contact-form-7',
  '[elementor-template',
  '[vc_row',
  '[rev_slider'
];

export function findWordPressErrors(bodyText: string): string[] {
  const lowerBody = bodyText.toLowerCase();

  return WORDPRESS_FAILURE_STRINGS.filter((failureString) => lowerBody.includes(failureString.toLowerCase()));
}

export function findBrokenShortcodes(bodyText: string, ignoredShortcodes: string[] = []): string[] {
  const lowerBody = bodyText.toLowerCase();
  const lowerIgnored = ignoredShortcodes.map((shortcode) => shortcode.toLowerCase());

  return BROKEN_SHORTCODE_PATTERNS.filter((shortcode) => {
    const lowerShortcode = shortcode.toLowerCase();
    return lowerBody.includes(lowerShortcode) && !lowerIgnored.some((ignored) => lowerShortcode.includes(ignored) || ignored.includes(lowerShortcode));
  });
}

export function looksLikeGeneric404(title: string, bodyText: string, status: number | null): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerBody = bodyText.toLowerCase();
  const common404Text = [
    '404',
    'page not found',
    'not found',
    'nothing found',
    'oops! that page can',
    'the page you requested could not be found'
  ];

  if (status === 404) {
    return true;
  }

  return common404Text.some((text) => lowerTitle.includes(text) || lowerBody.includes(text));
}
