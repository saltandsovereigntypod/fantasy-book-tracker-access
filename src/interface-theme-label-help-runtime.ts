const HELP: Record<string, { label: string; help: string }> = {
  'Page background': {
    label: 'App background color',
    help: 'The base color behind your background image and all translucent interface glass.',
  },
  'Sidebar / topbar': {
    label: 'Navigation glass color',
    help: 'Colors the left sidebar and the top header bar.',
  },
  'Panel': {
    label: 'Main content glass',
    help: 'Colors the large dashboard, library, profile, and content panels, including the theme-colored areas behind book cards.',
  },
  'Secondary panel': {
    label: 'Controls & raised surfaces',
    help: 'Colors search fields, dropdowns, smaller controls, popovers, and secondary raised surfaces.',
  },
  'Accent': {
    label: 'Accent & active color',
    help: 'Used for selected navigation items, primary buttons, highlights, and theme emphasis.',
  },
  'Border': {
    label: 'Glass border color',
    help: 'Controls outlines around panels, fields, cards containers, and interface surfaces.',
  },
  'Text': {
    label: 'Primary text color',
    help: 'The main readable text throughout the interface. Book-card text is not changed.',
  },
  'Muted text': {
    label: 'Secondary text color',
    help: 'Used for descriptions, labels, metadata, and less-prominent interface text.',
  },
  'Navigation opacity': {
    label: 'Sidebar & topbar transparency',
    help: 'Lower values show more of the background through the navigation glass.',
  },
  'Content opacity': {
    label: 'Panel transparency',
    help: 'Lower values show more of the background through main panels and the containers behind book cards.',
  },
  'Blur strength': {
    label: 'Background blur through glass',
    help: 'Controls how soft or sharp the background looks through translucent interface surfaces.',
  },
};

function enhance(): void {
  document.querySelectorAll<HTMLLabelElement>('.interface-theme-color-field, .interface-theme-range-field').forEach((field) => {
    if (field.dataset.helpEnhanced === 'true') return;
    const heading = field.querySelector<HTMLElement>(':scope > span');
    if (!heading) return;
    const raw = Array.from(heading.childNodes).find((node) => node.nodeType === Node.TEXT_NODE)?.textContent?.trim()
      || heading.textContent?.trim()
      || '';
    const match = HELP[raw];
    if (!match) return;

    const textNode = Array.from(heading.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
    if (textNode) textNode.textContent = match.label;
    else heading.prepend(match.label);

    const help = document.createElement('small');
    help.className = 'interface-theme-field-help';
    help.textContent = match.help;
    heading.insertAdjacentElement('afterend', help);
    field.dataset.helpEnhanced = 'true';
  });
}

function start(): void {
  enhance();
  const observer = new MutationObserver(enhance);
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
