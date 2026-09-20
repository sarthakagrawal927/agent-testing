const fill = (label, value) => ['find', 'label', label, 'fill', value];
const click = (name) => ['find', 'role', 'button', 'click', '--name', name, '--exact'];
const wait = (selector) => ['wait', selector];
export const journeys = {
  login: [
    [
      fill('Email address', 'user@example.com'),
      click('Continue'),
      wait('input[type=password]'),
      fill('Password', 'WrongPassword1!'),
      click('Continue'),
      ['wait', '--text', 'The email and password combination are invalid'],
    ],
    [
      click('Continue'),
      wait('input[type=password]'),
      fill('Password', 'SecurePass1!'),
      click('Continue'),
      ['wait', '--text', 'Enter confirmation code'],
      ...Array.from('123456', (digit, i) => ['fill', `input[aria-label="Please enter OTP character ${i + 1}"]`, digit]),
      click('Continue'),
      ['wait', '--url', '**/overview'],
    ],
  ],
  edit: [
    [
      ['find', 'text', 'HSBC', 'click', '--exact'],
      click('H Cash Savings USD $100.00K'),
      wait('input[inputmode="decimal"]'),
      fill('Balance', '75000'),
      ['click', '[data-testid="edit-asset-save"]'],
      ['wait', '--fn', '!document.querySelector("[data-testid=edit-asset-save]")'],
    ],
  ],
  search: [
    [
      ['find', 'role', 'combobox', 'fill', 'VOO', '--name', 'Search'],
      ['wait', '--text', 'Vanguard S&P 500 ETF'],
    ],
    [
      ['find', 'role', 'combobox', 'fill', 'QQQ', '--name', 'Search'],
      ['wait', '--text', 'Invesco QQQ Trust'],
      ['wait', '--fn', '!document.body.innerText.includes("Vanguard S&P 500 ETF")'],
    ],
    [
      ['find', 'role', 'combobox', 'fill', 'zz-no-match', '--name', 'Search'],
      ['wait', '--text', 'No results'],
    ],
  ],
};

// Both executors wait for Vault's blocking transition overlay before clicks.
for (const groups of Object.values(journeys))
  for (let i = 0; i < groups.length; i++) {
    groups[i] = groups[i].flatMap((command) =>
      command.includes('click')
        ? [
            [
              'wait',
              '--fn',
              '!Array.from(document.querySelectorAll(".root-loader")).some(x => x.getClientRects().length && getComputedStyle(x).visibility !== "hidden")',
            ],
            command,
          ]
        : [command],
    );
  }

export async function playwrightAction(page, command) {
  const [verb, a, b, c, d, e, f] = command;
  if (verb === 'fill') return page.locator(a).fill(b);
  if (verb === 'click') return page.locator(a).click();
  if (verb === 'find') {
    const locator =
      a === 'label'
        ? page.getByLabel(b, { exact: true })
        : a === 'text'
          ? page.getByText(b, { exact: true })
          : page.getByRole(b, { name: c === 'fill' ? f : e, exact: true });
    return c === 'fill' ? locator.fill(d) : locator.click();
  }
  if (verb === 'wait') {
    if (a === '--url') return page.waitForURL(b);
    if (a === '--fn') return page.waitForFunction(b);
    if (a === '--text') return page.getByText(b, { exact: false }).first().waitFor();
    return page.locator(a).waitFor();
  }
  throw new Error(`Unsupported command ${verb}`);
}
