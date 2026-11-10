import { createElement } from 'react';

export default function ImportWarning({ status }) {
  if (!status?.warning) return null;
  return createElement('div', { className: 'preview-banner', role: 'status' },
    createElement('strong', null, 'Some locations were not refreshed. '),
    status.warning,
    ' Retained records keep their earlier location refresh date; check that date before acting.');
}
