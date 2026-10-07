# PurposeLock

MVP цільових зборів у USDC для Arc Microgrants. Solidity escrow + English-first web UI з EN/UA (Vite / ethers), із вузьким read-only RPC backend, без бази даних або зберігання wallet secrets.

**Стан:** контракт розгорнуто в Arc Mainnet: `0xca986d006b0a07f3f31c6087cb38cdbf3aedfa0d`. Production frontend підключено до нього через приватний серверний RPC. Публічна версія — connection-only: Mainnet-транзакції тимчасово заблоковані до окремо погодженого live-тесту; live lifecycle test і source verification очікують завершення. Незалежного аудиту немає.

Актуальні параметри та обмеження: [deployment record](docs/DEPLOYMENT.md), [mainnet release instructions](docs/MAINNET-RELEASE.md). Раніше зафіксований 403/1009 офіційного RPC більше не блокує роботу: використовується приватний QuickNode endpoint.

## Запуск за кілька хвилин

Потрібен Node.js **22.13+** (рекомендовано актуальну Node 22 LTS) та npm.

```sh
npm ci
npm test
npm run demo
```

В іншому терміналі, у цій самій папці:

```sh
npm run dev
```

Відкрийте [локальний PurposeLock](http://127.0.0.1:5173). Demo запускає Hardhat на `127.0.0.1:8545`, створює mock USDC, контракт і два збори, записує публічні налаштування до ignored `.env.local`. У UI перемикайте Creator / Donor A / Donor B / Merchant. Жодних справжніх коштів чи гаманця не потрібно. Адреса merchant друкується при запуску, ключі — ні.

Demo зберігається лише в пам’яті. Перезапуск очищає його історію; перезапустіть також web server і оновіть вкладку. Скрипт не перезаписує `.env.local`, якщо той містить іншу мережу. Зупинка: Ctrl+C в обох терміналах. Не відкривайте локальний RPC для інших машин; його акаунти розблоковані лише для тестів.

Для запуску мережі й UI одним процесом замість двох терміналів використайте `npm run demo:web`.

## Новий frontend

Default language — English. Перемикач **EN / UA** працює через словник `src/i18n.js`; мова зберігається локально. Назви й описи, написані авторами, автоматично не перекладаються.

- [Demo campaign](http://127.0.0.1:5173/#/fund/1): **New PC for my stream**, 735 / 1,000 USDC, Gaming/Streaming PC, Example PC Store. 735 USDC — реальні внески в локальному mock-контракті (500 + 235), не статична ілюстрація. Після власних транзакцій сума змінюється.
- [Explore Funds](http://127.0.0.1:5173/#/explore): список зборів і відкриття за ID.
- [Create Fund](http://127.0.0.1:5173/#/create): окрема форма.
- [My Funds](http://127.0.0.1:5173/#/dashboard): лише збори підключеного creator, статистика та перехід до `#/dashboard/<id>` з історією і дозволеними діями.
- `#/fund/<id>`: публічна shareable-сторінка з Donate USDC / Claim Refund. Для обраного merchant на цій сторінці є Accept Campaign Terms / Refund to PurposeLock.

Темні graphite surfaces, violet accent, restrained glass, адаптивна donor panel. Зелені позначки означають захист маршруту чи успішний стан, **не перевірену особу продавця**. У мобільному заголовку призначення та merchant видно перед формою внеску.

Solidity і файл усіх 17 контрактних тестів не змінені. Нові чотири текстові поля кодуються як `PL1:[title,purpose,description,merchantName]` в існуючому полі `purpose`, спільний ліміт — 240 UTF-8 байтів. Старий plain-text формат підтримується. Жодна metadata не зберігається лише в браузері; посилання відкриває ті самі дані з контракту на іншому пристрої.

Історія читається з подій контракту, по 5,000 блоків із Load earlier activity. Якщо завантажено тільки частину, UI явно показує діапазон. Dashboard початково переглядає 20 останніх зборів і пропонує Load more; статистика позначена як така, що стосується завантажених зборів.

## Що реалізовано

- Creator одночасно є beneficiary товару. Створює мету (до 240 UTF-8 байтів), goal, deadline до 365 днів і фіксовану адресу merchant.
- Merchant окремою транзакцією приймає умови. До цього внески заборонено.
- Donor робить точний ERC-20 approval, потім `donate`. Суми — цілі micro-USDC, **6 decimals**. Перевищення залишку goal відхиляється.
- Після досягнення goal будь-хто може викликати `payMerchant`. Весь goal надходить виключно зафіксованому merchant, включно після дедлайну.
- Якщо `block.timestamp >= deadline` і goal не досягнуто, `claimRefund` повертає донору лише його власний внесок. Повторний claim заборонено.
- Після оплати merchant може виконати **повний** `merchantRefund`: exact approval + transferFrom у контракт. Потім первинні донори забирають свої внески. Часткові refund у MVP не підтримуються.
- UI: створення збору, підтвердження merchant, внески, settlement, обидва refunds, баланс, дедлайн, latest 20 campaigns + пошук за ID, explorer links, pending/error/success, обробка зміни акаунта/мережі, локальний deployment helper.

### Стани

| Поточний стан | Умова / дія | Результат |
|---|---|---|
| Funding, merchant не прийняв | `acceptMerchant` від зафіксованого merchant | Відкрито внески |
| Funding | До deadline, внесок ≤ залишок goal | Зростає внесок і escrow |
| Funding | Raised = goal, `payMerchant` | Paid; кошти merchant |
| Funding | Deadline настав, raised < goal, donor claim | Refunding; кошти первинному донору |
| Paid | Повний `merchantRefund` від merchant | Refunding; кошти знову в escrow |
| Refunding | Первинний donor claim | Повернення власного внеску |

`raised` — історична сума збору, не поточний баланс. `refunded` — уже виплачені donor refunds. `totalEscrowed` — сума зобов’язань усіх зборів, що зараз знаходяться в контракті. На Failed campaign жоден окремий finalize не потрібен.

## Межа гарантії та модель довіри

Контракт гарантує дозволені адреси виплат **усередині своїх функцій**. Немає owner/admin, upgrade, sweep, beneficiary withdrawal або зміни merchant. Якщо creator сам донатив, він має тільки звичайне право повернути власний внесок, як інші донори.

**Approved merchant означає обраний creator, а не перевірений PurposeLock.** Різні адреси можуть належати одній людині. Merchant може змовитися з creator, не доставити товар, відмовитися від refund або переказати кошти beneficiary поза системою. Onchain acceptance не примушує до реального повернення. Для реальних товарів потрібна окрема домовленість із магазином про refund виключно через `merchantRefund`, перевірка продавця та доставки. Це не механізм доведеної AML-перевірки.

Не надсилайте USDC напряму на контракт: звичайний ERC-20 transfer не створює внесок і не відкриває refund. Неприв’язані перекази залишаться без recovery; адміністративного sweep немає. Native-value виклики нашого контракту не підтримуються. Користуйтеся `donate` / `merchantRefund`.

USDC blocklist або збої мережі можуть блокувати окремі виплати. Claim одного донора не залежить від іншого. Якщо merchant заблокований після повного funding, payout може бути недоступним: альтернативного recipient/cancellation у цій версії немає. SafeERC20, ReentrancyGuard та checks-effects-interactions захищають accounting, але не скасовують обмежень мережі.

## Перевірені вимоги Arc Microgrants

Перевірено **30 вересня 2026** за [офіційною сторінкою програми](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq):

- 20 microgrants по 500 USDC; загальний пул 10 000 USDC.
- На момент подання потрібні **працюючий deployment на Arc mainnet**, публічний repository, короткий опис та публічний builder profile.
- Testnet-only, mockups і роботи, вже профінансовані Circle/Arc, не підходять.
- Дедлайн — **14 жовтня 2026, 23:59 ET**; рішення — до 21 жовтня. Перевірте сторінку знову перед поданням: дати можуть змінюватися.
- Є screening юрисдикцій і перевірка отримувача перед виплатою. Результат і фінансування не гарантовані.

Деталі технічних рішень і суперечностей документації: [docs/RESEARCH.md](docs/RESEARCH.md). План демонстрації та текст заявки: [docs/SUBMISSION.md](docs/SUBMISSION.md).

## Arc: конфігурація

| Параметр | Mainnet | Testnet |
|---|---|---|
| `VITE_NETWORK` | `arc` | `arcTestnet` |
| Chain ID | 5042 | 5042002 |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| Explorer | `https://explorer.arc.io` | `https://explorer.testnet.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | Та сама адреса |
| ERC-20 decimals | 6 | 6 |
| Native gas decimals | 18 | 18 |

Джерела: [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [Contract addresses](https://docs.arc.io/arc/references/contract-addresses). Це **один USDC баланс** через два інтерфейси. Внески не використовують `msg.value`. Потрібен додатковий USDC для gas, зокрема merchant не повинен витрачати всю суму перед повним refund.

Read-only перевірка без wallet:

```sh
npm run check:arc
npm run check:arc -- --mainnet
```

Скрипт перевіряє chain ID та USDC decimals, читає symbol і block number. При 403/1009 перевірте доступність офіційного RPC та умови доступу з оператором мережі; не вважайте цей результат успішною перевіркою mainnet.

## Deployment через ваш гаманець — без експорту ключів

1. Пройдіть тести. Спершу перевірте повний сценарій на Arc Testnet; локальний Hardhat не емулює специфічні precompiles та native USDC Arc.
2. Зупиніть demo/dev. Збережіть за потреби свій `.env.local` і створіть його з `.env.example`. Для testnet залиште `VITE_NETWORK=arcTestnet`; для mainnet використайте `arc`. `VITE_CONTRACT_ADDRESS` на першому deployment порожній, `VITE_RPC_URL` порожній для офіційного endpoint. Не залишайте localhost RPC від demo.
3. Запустіть `npm run dev`. Відкрийте `http://127.0.0.1:5173` у браузері з EVM-гаманцем. Підключіть wallet; UI пропонує правильну мережу. Поповнення USDC і будь-які підписи виконуєте самостійно у wallet. Для testnet використовуйте [Circle faucet](https://faucet.circle.com).
4. Developer helper збережено за адресою `http://127.0.0.1:5173/#/deploy` (тільки localhost dev із Arc-конфігурацією), поза основною навігацією. Перевірте мережу, canonical USDC address та вихідний контракт; спочатку натисніть «Estimate deployment (no transaction)». Підписання за замовчуванням вимкнено. Лише після окремого явного погодження реального deployment локально встановіть публічний прапорець `VITE_ENABLE_DEPLOYMENT=YES`, перезапустіть dev, повторіть оцінку, позначте checkbox і натисніть «Deploy PurposeLock». Перегляньте gas у wallet і самостійно підтвердьте або відхиліть транзакцію.
5. Після receipt UI покаже `VITE_CONTRACT_ADDRESS=0x…`. Внесіть цю публічну адресу в `.env.local`, перезапустіть dev і звірте адресу/транзакцію в explorer. Налаштування testnet і mainnet не взаємозамінні.
6. Verify source у explorer: compiler **0.8.37+commit.f401782d**, optimizer **enabled, 200 runs**, EVM **Shanghai**, contract `contracts/PurposeLock.sol:PurposeLock`, constructor `address` canonical USDC. `npm run compile` генерує повний `artifacts/standard-input.json` для Standard JSON verification. Explorer UI/API можуть змінюватися; verification ще не виконано.
7. На testnet, а потім із мінімальною сумою на mainnet, перевірте два сценарії: goal → merchant payment → merchant refund → donor claims; failed deadline → donor claims. Підписуйте вручну. Зафіксуйте contract address, deployment tx, campaign IDs та transaction links у [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Deployment helper доступний лише на **localhost у dev mode**; він не входить до production UI. Немає форми для seed phrase/private key, немає secret env variables або script signer. Не вводьте їх у чат, terminal, `.env`, GitHub або Vercel.

## GitHub та Vercel

Публікуйте чистий export із `npm run check:release -- --export` (папка `release-mainnet/`), без локальних артефактів та батьківського ChatGPT project. Оригінальна папка є root для розробки. `.gitignore` виключає локальні налаштування, залежності, артефакти й звіти тестів. `sources/` батьківського ChatGPT project не входить до проєкту та не змінюється.

1. Створіть публічний GitHub repository з вмістом **тільки чистої папки `release-mainnet/`**; включіть `package-lock.json`. Можна використати GitHub Desktop. Наявність repo сама по собі не означає deployment.
2. GitHub Actions запускається вручну через workflow_dispatch і виконує `npm ci`, contract tests, build smoke check і Playwright E2E. Підписів wallet та секретів CI не потребує.
3. Імпортуйте repository у Vercel. Framework: **Vite**. Якщо завантажили батьківську папку, Root Directory: `purposelock`; якщо вміст цієї папки — root repo, залиште Root Directory порожнім. Build: `npm run build:production`; output: `dist`; Node: 22.x.
4. Додайте лише server-only `ARC_MAINNET_RPC_URL` у приватні Vercel environment settings. Production build сам задає mainnet address і `/api/rpc`. Не додавайте приватні URL до `VITE_*`: вони потрапляють у bundle.
5. Розгорніть preview, перевірте UI та правильну мережу. Потім publish production. Налаштування змінюються лише після rebuild. `vercel.json` уже готовий; серверний RPC потребує приватної змінної вище.
6. Додайте live URL / repo / explorer у deployment record і заявку.

`npm run build` навмисно відмовляється публікувати `VITE_NETWORK=local`. Для compile/build smoke test, залишаючи локальний demo налаштованим:

```sh
VITE_NETWORK=arcTestnet VITE_CONTRACT_ADDRESS= VITE_RPC_URL= npm run build
```

Це build без deployment address, **не готовий grant submission**. Джерела Vercel workflow: [Vite deployment](https://vite.dev/guide/static-deploy.html#vercel), [Vercel Git](https://vercel.com/docs/git).

## Тести

```sh
npm test
npm run build  # для arc/arcTestnet конфігурації, не local
npx playwright install chromium
npm run test:ui
npm audit
```

E2E автоматично запускає локальний demo та web server, якщо вони ще не працюють. Запускайте його з локальною конфігурацією; поточні non-local `.env.local` потрібно зберегти окремо. Якщо Google Chrome вже встановлено, можна `PW_CHANNEL=chrome npm run test:ui` замість завантаження Chromium.

17 contract tests: terms/consent, roles, cap, allowance/balance failure, deadline boundary, fixed recipient, repeated calls, full merchant refund, atomic rollback, blocklisted transfer simulation, reentrancy, fee-token rejection, isolated accounting, unsolicited transfers, micro-unit precision та mixed-campaign accounting invariant. 3 browser tests: повний цикл merchant refund, failed deadline + escaping, mobile layout. Тести використовують локальні mock funds; реальний browser extension, Arc runtime та mainnet signatures потребують окремого ручного smoke test.

## Структура

- `contracts/PurposeLock.sol` — escrow; `contracts/test/MockUSDC.sol` — лише тести.
- `src/` — UI, мережі; `scripts/compile.mjs` — pinned compiler / ABI / verification input.
- `scripts/demo.mjs` — локальна мережа; `scripts/check-arc.mjs` — read-only preflight.
- `test/` — contract tests; `e2e/` — UI tests.
- `docs/` — research, deployment evidence, submission draft, verification results.

Ліцензія: MIT. Для реальних великих зборів потрібні незалежний аудит і перевірена інтеграція merchant.
