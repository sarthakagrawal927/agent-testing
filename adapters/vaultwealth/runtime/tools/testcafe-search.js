import { ClientFunction, Selector } from 'testcafe';

const setAuthenticatedSession = ClientFunction(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('token', 'mock-login-token-final');
});

fixture('Vaultwealth expanded driver screen').page('http://127.0.0.1:18790/login');

test('dynamic search reaches the independently verifiable final state', async (t) => {
  await setAuthenticatedSession();
  await t.navigateTo('http://127.0.0.1:18790/plan/assets/add');

  const input = Selector('input[role="combobox"]');
  const body = Selector('body');
  const searches = [
    ['VOO', 'Vanguard S&P 500 ETF', null],
    ['QQQ', 'Invesco QQQ Trust', 'Vanguard S&P 500 ETF'],
    ['zz-no-match', 'No results', 'Invesco QQQ Trust'],
  ];

  for (const [query, present, absent] of searches) {
    await t.typeText(input, query, { replace: true });
    await t.expect(body.innerText).contains(present, { timeout: 10000 });
    if (absent) await t.expect(body.innerText).notContains(absent, { timeout: 10000 });
  }

  const finalText = await body.innerText;
  console.log(JSON.stringify({ finalText }));
});

