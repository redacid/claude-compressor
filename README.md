# compressor

Claude Code плагін, що автоматично стискає вивід shell-команд агента через rtk, з архітектурою для інших компресорів.

Хук `PreToolUse` перехоплює кожен виклик інструмента Bash і, якщо команду можна стиснути,
непомітно для агента переписує її: `git status` → `rtk git status`, `cd x && git diff` → `cd x && rtk git diff`.
Агент отримує той самий результат, але в рази коротший. На великих репозиторіях це 50–90% токенів
виводу (див. [вимір ефекту](docs/benchmark.md)).

## Вимоги

- Claude Code з підтримкою плагінів.
- Node.js ≥ 18 (лише вбудовані модулі, без npm-залежностей).
- [rtk](https://github.com/rtk-ai/rtk) у `PATH` (перевірено з 0.49.0). Без rtk плагін нічого не робить.

Не вмикайте одночасно глобальний хук самого rtk (`rtk init -g`): команди переписувалися б двічі.

## Встановлення

З локальної копії:

```bash
make install
```

Це те саме, що:

```bash
claude plugin marketplace add /path/to/compressor
claude plugin install compressor@compressor
```

Або всередині Claude Code: `/plugin marketplace add /path/to/compressor`, потім `/plugin install compressor@compressor`.
Видалити: `make uninstall`. Спробувати без встановлення: `make run` (це `claude --plugin-dir .`).

## Як це працює

```
Bash tool call ─► hooks/dispatch.js ─► src/dispatcher.js ─► компресори з конфігу по порядку
                                                            перший, що переписав команду, виграє
                       ◄─ updatedInput.command (+ allow, якщо оригінал уже дозволено)
```

- Компресори лежать у `src/compressors/`, вмикаються і впорядковуються в `config/compressors.json`.
- Будь-яка помилка означає, що хук нічого не виводить і команда виконується як є (fail open).
- Адаптер rtk (`src/compressors/rtk.js`) питає саме rtk (`rtk rewrite`), чи має команда стислий відповідник,
  і додає власні запобіжники. Не переписуються:
  - команди, що вже використовують `rtk`;
  - heredoc, `$(...)` і бектики;
  - редирект у файл (`2>&1` і `/dev/null` дозволені) і `tee`, щоб у файл не потрапив стиснений вивід;
  - інтерактивні команди: `vim`, `less`, `ssh`, `git add -p`, `git rebase -i`, `docker/kubectl exec -it`;
  - режими стеження: `tail -f`, `kubectl logs -f`.

Стиснення rtk **втратне**: великий diff обрізається з підказкою, як отримати повний
(`rtk git diff --no-compact`), у `git log` з'являються маркери `[+N lines omitted]`.

## Дозволи

Claude Code перевіряє правила дозволів для **переписаної** команди, тож правило `Bash(git status:*)` саме по собі
не покриває `rtk git status`. Плагін робить так само, як власний хук rtk:

| `rtk rewrite` | Значення | Що робить плагін |
|---|---|---|
| код 0 | ваші правила в settings.json уже дозволяють оригінал повністю (усі частини ланцюжка) | переписує і ставить `permissionDecision: "allow"` |
| код 3 | правила нема або воно `ask` | переписує, рішення лишає Claude Code (буде звичайний запит) |
| код 2 | оригінал заборонено | не переписує, deny-правило спрацьовує на оригіналі |

Права плагін не розширює. rtk читає `~/.claude/settings.json` і `.claude/settings.json` проєкту,
але **не бачить** правил із `--allowedTools` і вбудованого автодозволу Claude Code для команд лише для читання
(`ls`, `git diff`, ...). Щоб такі команди стискалися без запитів, додайте явні правила для **оригіналів**:

```json
{
  "permissions": {
    "allow": ["Bash(ls:*)", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git log:*)", "Bash(grep:*)", "Bash(find:*)"]
  }
}
```

Не додавайте `Bash(rtk:*)`: `rtk run` і `rtk proxy` виконують довільні команди.

## Налаштування

Порядок застосування (пізніше перекриває раннє):

1. `config/compressors.json` у плагіні: `{ "compressors": ["rtk"] }`.
2. Користувацький конфіг `~/.config/compressor/config.json` (або `$XDG_CONFIG_HOME/compressor/config.json`):
   `{ "enabled": true, "compressors": ["rtk"] }`.
3. Змінні середовища.

| Змінна | Що робить |
|---|---|
| `COMPRESSOR_DISABLE=1` | вимкнути плагін повністю |
| `COMPRESSOR_COMPRESSORS=rtk,foo` | список і порядок компресорів (порожньо = жодного) |
| `COMPRESSOR_CONFIG=/path.json` | інший шлях до користувацького конфігу |
| `COMPRESSOR_RTK_BIN=/path/rtk` | явний шлях до rtk |
| `COMPRESSOR_LOG=/path.log` | дописувати рішення хука у файл |
| `COMPRESSOR_DEBUG=1` | писати рішення хука в stderr |

Змінні середовища треба задати для процесу `claude`, наприклад `COMPRESSOR_DISABLE=1 claude`.

## Розробка

```
.claude-plugin/   plugin.json, marketplace.json
hooks/            hooks.json, dispatch.js (точка входу хука)
src/              dispatcher.js, registry.js, config.js, shell.js, log.js
src/compressors/  rtk.js (адаптери компресорів)
config/           compressors.json (увімкнені компресори та порядок)
scripts/          benchmark.js
test/             node:test, фейковий rtk у test/fixtures/bin
docs/             benchmark.md, adding-compressor.md
AGENTS.md         інструкції для AI-агентів (англійською; .claude/CLAUDE.md імпортує його)
```

| Ціль | Що робить |
|---|---|
| `make` / `make help` | список цілей |
| `make check-deps` | перевірити node, git, rtk |
| `make lint` | `node --check` усіх JS і перевірка JSON |
| `make test` | усі тести (`npm test`), інтеграційні зі справжнім rtk, якщо він є |
| `make test-unit` | лише юніт-тести |
| `make validate` | `claude plugin validate` для plugin.json і marketplace.json |
| `make check` | lint + test + validate |
| `make bench` / `make bench-md` | вимір економії, `BENCH_REPOS="dir1 dir2"` |
| `make build` | check, потім zip плагіна в `dist/` (з `HEAD`) |
| `make run` | `claude --plugin-dir .` з логом у `compressor.log` |
| `make run-print` | один прогін `claude -p`, `PROMPT="..."` |
| `make hook-test` | прогнати хук на команді, `CMD="git log -5"` |
| `make install` / `make update` / `make uninstall` | локальний marketplace і плагін |
| `make clean` | прибрати `dist/` і логи |

Як додати свій компресор: [docs/adding-compressor.md](docs/adding-compressor.md).
Інструкції для AI-агентів, що працюють із репозиторієм: [AGENTS.md](AGENTS.md) (Claude Code читає його через `.claude/CLAUDE.md`).

## Вимір ефекту

`make bench` на трьох локальних репозиторіях (токени ≈ символи / 4):

| Репозиторій | До | Після | Економія |
|---|---:|---:|---:|
| compressor (малий) | 6370 | 5721 | 10% |
| obot-mcp-catalog | 7224 | 3304 | 54% |
| kubeconform | 353401 | 39946 | 89% |

Деталі по командах і результати живого прогону в `claude -p`: [docs/benchmark.md](docs/benchmark.md).

## План розробки

1. ✅ Каркас плагіна й архітектура компресорів: plugin.json, хук PreToolUse для Bash, диспетчер і реєстр компресорів.
2. ✅ Адаптер rtk: перевірка наявності rtk, переписування підтримуваних команд, обробка пайпів, heredoc і ланцюжків.
3. ✅ Тести й вимір ефекту: юніт-тести переписування, прогін у claude -p, порівняння обсягу виводу.
4. ✅ Пакування: marketplace.json, README, інструкція з додавання компресора.
