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

export function findWordPressErrors(bodyText: string): string[] {
  const lowerBody = bodyText.toLowerCase();

  return WORDPRESS_FAILURE_STRINGS.filter((failureString) => lowerBody.includes(failureString.toLowerCase()));
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
