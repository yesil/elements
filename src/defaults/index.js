import { getDefaultAnchorSchema } from './a.author.js';
import { getDefaultSpButtonSchema } from './sp-button.author.js';

export function getDefaultSchemaForTag(tagName, element) {
  switch ((tagName || '').toLowerCase()) {
    case 'a':
      return getDefaultAnchorSchema(element);
    case 'sp-button':
      return getDefaultSpButtonSchema(element);
    default:
      return null;
  }
}
